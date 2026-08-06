'use strict';

/**
 * Sevilha Performance — LeadQualificado dos dois funis
 * GET /api/eventos-qualificados   (cron diário, ver vercel.json)
 *
 * Varre as duas planilhas e devolve ao Meta quais leads têm 10 ou mais
 * colaboradores. Nenhum dos dois funis passa por servidor nosso no momento da
 * conversão, então a varredura é o único caminho que não exige mexer em
 * infraestrutura de terceiros:
 *
 *   • FORMS — o lead nasce dentro do Meta e chega pelo export na planilha
 *     [CENTRAL DE EVENTOS]. Correspondência pelo `lead_id`, o identificador que
 *     o próprio Meta atribui.
 *   • LP — o formulário é hospedado pelo Respondi, que aceita um webhook só por
 *     formulário; o existente é do workflow n8n que alimenta Sheets e Pipedrive.
 *     Em vez de disputar esse webhook (ou pôr o nosso código no caminho crítico
 *     dos leads), lemos a planilha que o Respondi preenche. Correspondência por
 *     e-mail, telefone e fbclid.
 *
 * O atraso de até 24h não custa nada aqui: o volume medido (~10 qualificados por
 * semana nos dois funis) está muito abaixo dos ~50 semanais que o Meta pede para
 * otimizar, então este evento serve para leitura e público, não para otimização.
 *
 * `api/respondi.js` faz o mesmo para LP em tempo real, caso um dia haja um
 * webhook disponível. Os dois usam a mesma chave de deduplicação, então rodar os
 * dois não conta a conversão duas vezes.
 *
 * Variáveis de ambiente:
 *   CRON_SECRET                             = segredo do cron (Vercel envia em Authorization)
 *   META_CAPI_TOKEN                         = System User Access Token
 *   SUPABASE_URL / SUPABASE_SERVICE_KEY     = trava de reenvio
 *   LEADS_SHEET_ID / LEADS_SHEET_GID_FORMS  = planilha de FORMS, como no dashboard
 *   LEADS_SHEET_LP_ID                       = planilha de LP (padrão no código)
 */

const crypto = require('crypto');

const { readAllTabs, readLPTabs } = require('../lib/sheets');
const { norm } = require('../lib/texto');
const { ehQualificado } = require('../lib/porte');
const { enviarEvento, montarUserData, eventIdPorContato } = require('../lib/capi');
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

/* ── Leitura da planilha de LP (Respondi) ────────────────────────────── */

/**
 * Os leads da landing page também entram por aqui, e não pelo webhook: o
 * Respondi aceita um webhook só por formulário, e ele já é do workflow que
 * alimenta o Sheets e o Pipedrive. Como este evento não serve para otimização
 * (medido: ~10 qualificados por semana, contra os ~50 que o Meta pede), esperar
 * a varredura diária não custa nada — e evita pôr o nosso código no caminho
 * crítico dos leads.
 */
const CAMPOS_LP = {
  data:     ['data entrada', 'data'],
  email:    ['qual seu e-mail', 'qual seu email'],
  telefone: ['qual seu whatsapp', 'telefone'],
  colab:    ['quantos colaboradores', 'numero de colaboradores'],
  campanha: ['utm_campaign', 'utm campaign'],
  origem:   ['utm_source', 'utm source'],
  anuncio:  ['utm_content', 'utm content'],
  fbclid:   ['fbclid'],
};

/** Casa o cabeçalho por igualdade antes de aceitar prefixo, para "DATA STATUS"
 *  não ser escolhida quando o alvo é "DATA ENTRADA". */
function indiceColuna(head, nomes) {
  for (const n of nomes) {
    for (let i = 0; i < head.length; i++) if (norm(head[i]) === n) return i;
  }
  for (const n of nomes) {
    for (let i = 0; i < head.length; i++) if (norm(head[i]).startsWith(n)) return i;
  }
  return -1;
}

function extrairLP(rows) {
  const hIdx = rows.findIndex(r => (r || []).some(c => norm(c).startsWith('qual seu nome')));
  if (hIdx < 0) return [];

  const head = rows[hIdx];
  const idx = {};
  for (const [campo, nomes] of Object.entries(CAMPOS_LP)) idx[campo] = indiceColuna(head, nomes);

  const out = [];
  for (let r = hIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    if (ehLeadDeTeste(row.map(v => String(v ?? '')))) continue;

    const cel = i => (i >= 0 && i < row.length ? String(row[i] ?? '').trim() : '');

    // A planilha grava "2026-08-05 12:00:00"; Date.parse exige o T.
    const quandoMs = Date.parse(cel(idx.data).replace(' ', 'T'));
    if (Number.isNaN(quandoMs)) continue;

    // Mesma regra do dashboard: sem contato não é lead — e sem contato não há
    // chave de deduplicação estável, já que a planilha não traz id de submissão.
    const email = cel(idx.email);
    const telefone = cel(idx.telefone);
    if (!email && !telefone) continue;

    out.push({
      fonte:         'LP',
      eventId:       eventIdPorContato('respondi', email || telefone),
      actionSource:  'website',
      quandoMs,
      colaboradores: cel(idx.colab),
      email,
      telefone,
      fbclid:        cel(idx.fbclid),
      campanha:      cel(idx.campanha),
      anuncio:       cel(idx.anuncio),
      plataforma:    cel(idx.origem),
    });
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
    console.warn('[eventos-qualificados] rejeitado: segredo ausente ou inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const [tabsCentral, tabsLP] = await Promise.all([readAllTabs(), readLPTabs()]);

    // O lead do formulário nativo nasce dentro do Meta e é identificado pelo
    // lead_id; o evento é gerado pela varredura, não por navegação, que é o que
    // `system_generated` descreve. O de LP veio de um formulário na web.
    const forms = tabsCentral.flatMap(t => extrairLeads(t.rows || [])).map(l => ({
      ...l, fonte: 'FORMS', eventId: `forms:${l.leadId}`, actionSource: 'system_generated',
    }));
    const lp = tabsLP.flatMap(t => extrairLP(t.rows || []));
    const leads = [...forms, ...lp];

    const limite = Date.now() - JANELA_DIAS * 86400000;
    const qualificados = leads.filter(l => ehQualificado(l.colaboradores));
    const naJanela     = qualificados.filter(l => l.quandoMs >= limite);
    const foraDaJanela = qualificados.length - naJanela.length;

    // A trava é consultada em bloco: uma chamada em vez de uma por lead.
    const enviadosAntes = await registro.jaEnviados(naJanela.map(l => l.eventId));
    const pendentes = naJanela.filter(l => !enviadosAntes.has(l.eventId));

    const enviados = [];
    for (const lead of pendentes) {
      await enviarEvento({
        evento:  EVENTO,
        eventId: lead.eventId,
        quando:  Math.floor(lead.quandoMs / 1000),
        userData: montarUserData({
          leadId:   lead.leadId,
          email:    lead.email,
          telefone: lead.telefone,
          fbclid:   lead.fbclid,
          quandoMs: lead.quandoMs,
          pais:     'br',
        }),
        customData: {
          colaboradores: lead.colaboradores,
          utm_campaign:  lead.campanha,
          utm_content:   lead.anuncio,
          utm_source:    lead.plataforma,
        },
        actionSource: lead.actionSource,
      });
      enviados.push({ event_id: lead.eventId, evento: EVENTO, fonte: lead.fonte });
    }

    // Só registra depois do envio: se o CAPI falhar, o lead volta amanhã.
    await registro.marcarEnviados(enviados);

    const contarFonte = f => enviados.filter(e => e.fonte === f).length;
    const resumo = {
      ok: true,
      analisados:     leads.length,
      qualificados:   qualificados.length,
      fora_da_janela: foraDaJanela,
      ja_enviados:    enviadosAntes.size,
      enviados:       enviados.length,
      por_fonte:      { FORMS: contarFonte('FORMS'), LP: contarFonte('LP') },
    };
    console.log('[eventos-qualificados]', JSON.stringify(resumo));
    return res.status(200).json(resumo);

  } catch (err) {
    console.error('[eventos-qualificados]', err.message);
    return res.status(502).json({ error: err.message });
  }
};

// Exportado para o teste conferir a extração contra um export real.
module.exports.extrairLeads = extrairLeads;
module.exports.extrairLP    = extrairLP;
module.exports.JANELA_DIAS  = JANELA_DIAS;
