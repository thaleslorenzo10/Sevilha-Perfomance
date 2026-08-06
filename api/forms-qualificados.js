'use strict';

/**
 * Sevilha Performance — LeadQualificado do formulário instantâneo do Meta
 * GET /api/forms-qualificados   (cron diário, ver vercel.json)
 *
 * Os leads do formulário nativo não passam por servidor nosso: eles nascem
 * dentro do Meta e chegam aqui pelo export na planilha [CENTRAL DE EVENTOS].
 * Esta varredura lê esse export e devolve ao Meta quais desses leads têm 10 ou
 * mais colaboradores, usando o `lead_id` — o identificador que o próprio Meta
 * atribui ao lead — como chave de correspondência.
 *
 * Variáveis de ambiente:
 *   CRON_SECRET                                = segredo do cron (Vercel envia em Authorization)
 *   META_CAPI_TOKEN                            = System User Access Token
 *   SUPABASE_URL / SUPABASE_SERVICE_KEY        = trava de reenvio
 *   LEADS_SHEET_ID / LEADS_SHEET_GID_FORMS     = a planilha, como no dashboard
 */

const crypto = require('crypto');

const { readAllTabs } = require('../lib/sheets');
const { ehQualificado } = require('../lib/porte');
const { enviarEvento, montarUserData } = require('../lib/capi');
const registro = require('../lib/eventos-enviados');

const EVENTO = 'LeadQualificado';

/**
 * O CAPI recusa evento com mais de 7 dias. Como a varredura é diária, a janela
 * existe para não gastar chamada com lead antigo — e, na primeira execução,
 * para deixar claro que histórico não tem como ser recuperado por aqui.
 */
const JANELA_DIAS = 7;

/** Largura fixa do registro no export do Meta (id … lead_status). */
const LARGURA_EXPORT = 23;

/* ── Leitura do export ───────────────────────────────────────────────── */

const RE_ID_LEAD = /^l:(\d+)$/;
const RE_EMAIL   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mesma assinatura de resposta que a leitura do dashboard usa para achar a
// pergunta de colaboradores dentro do registro.
const RE_COLABORADORES = /^(de\s+\d+\s+a\s+\d+|\d+\s*(a|à)\s*\d+|mais de\s+\d+|acima de\s+\d+.*)$/i;

function ehLeadDeTeste(celulas) {
  const blob = celulas.join(' ').toLowerCase();
  return blob.includes('<test lead') || blob.includes('test@meta.com');
}

/**
 * Localiza os registros pelo próprio id ("l:123…"), como a leitura do
 * dashboard já faz: a ordem das colunas do export é fixa, mas a linha de
 * cabeçalho pode faltar quando alguém cola blocos na planilha.
 *
 * As respostas do formulário mudam de posição conforme o formulário, e e-mail
 * e telefone idem — por isso são achados pelo formato do valor dentro do
 * registro, não por índice.
 */
function extrairLeads(rows) {
  const out = [];

  for (const row of rows) {
    if (!row || !row.length) continue;

    for (let off = 0; off < row.length; off++) {
      const m = RE_ID_LEAD.exec(String(row[off] || '').trim());
      if (!m) continue;

      const rec = row.slice(off, off + LARGURA_EXPORT).map(v => String(v ?? '').trim());
      off += LARGURA_EXPORT - 1;

      if (ehLeadDeTeste(rec)) continue;

      const quandoMs = Date.parse(rec[1]);
      if (Number.isNaN(quandoMs)) continue;

      const respostas = rec.slice(12);

      out.push({
        leadId:        m[1],
        quandoMs,
        colaboradores: respostas.find(v => RE_COLABORADORES.test(v)) || '',
        email:         respostas.find(v => RE_EMAIL.test(v)) || '',
        // O export prefixa o telefone com "p:" ("p:+5551999998888").
        telefone:      (respostas.find(v => /^p:\+?\d[\d\s()-]{8,}$/.test(v)) || '').replace(/^p:/, ''),
        campanha:      rec[7] || '',
        anuncio:       rec[3] || '',
        plataforma:    rec[11] || '',
      });
    }
  }
  return out;
}

/* ── Autenticação ────────────────────────────────────────────────────── */

function segredoConfere(req) {
  const esperado = process.env.CRON_SECRET || '';
  if (!esperado) return false;

  const auth    = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  const daQuery = new URL(req.url || '/', 'http://localhost').searchParams.get('token') || '';
  const recebido = auth || daQuery;
  if (!recebido) return false;

  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ── Handler ─────────────────────────────────────────────────────────── */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!segredoConfere(req)) {
    console.warn('[forms-qualificados] rejeitado: segredo ausente ou inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const tabs  = await readAllTabs();
    const leads = tabs.flatMap(t => extrairLeads(t.rows || []));

    const limite = Date.now() - JANELA_DIAS * 86400000;
    const qualificados = leads.filter(l => ehQualificado(l.colaboradores));
    const naJanela     = qualificados.filter(l => l.quandoMs >= limite);
    const foraDaJanela = qualificados.length - naJanela.length;

    // A trava é consultada em bloco: uma chamada em vez de uma por lead.
    const idsEvento = naJanela.map(l => `forms:${l.leadId}`);
    const enviadosAntes = await registro.jaEnviados(idsEvento);
    const pendentes = naJanela.filter(l => !enviadosAntes.has(`forms:${l.leadId}`));

    const enviados = [];
    for (const lead of pendentes) {
      const eventId = `forms:${lead.leadId}`;
      await enviarEvento({
        evento:  EVENTO,
        eventId,
        quando:  Math.floor(lead.quandoMs / 1000),
        userData: montarUserData({
          leadId:   lead.leadId,
          email:    lead.email,
          telefone: lead.telefone,
          pais:     'br',
        }),
        customData: {
          colaboradores: lead.colaboradores,
          utm_campaign:  lead.campanha,
          utm_content:   lead.anuncio,
          utm_source:    lead.plataforma,
        },
        // O lead nasceu dentro do Meta e este evento é gerado pela varredura,
        // não por navegação — é o que `system_generated` descreve.
        actionSource: 'system_generated',
      });
      enviados.push({ event_id: eventId, evento: EVENTO, fonte: 'FORMS' });
    }

    // Só registra depois do envio: se o CAPI falhar, o lead volta amanhã.
    await registro.marcarEnviados(enviados);

    const resumo = {
      ok: true,
      analisados:     leads.length,
      qualificados:   qualificados.length,
      fora_da_janela: foraDaJanela,
      ja_enviados:    enviadosAntes.size,
      enviados:       enviados.length,
    };
    console.log('[forms-qualificados]', JSON.stringify(resumo));
    return res.status(200).json(resumo);

  } catch (err) {
    console.error('[forms-qualificados]', err.message);
    return res.status(502).json({ error: err.message });
  }
};

// Exportado para o teste conferir a extração contra um export real.
module.exports.extrairLeads = extrairLeads;
module.exports.JANELA_DIAS  = JANELA_DIAS;
