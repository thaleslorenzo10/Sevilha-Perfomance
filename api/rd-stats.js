'use strict';

/**
 * Sevilha Performance — RD Station CRM
 * GET /api/rd-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Devolve os deals de cada funil distribuídos pelas etapas, na ordem em que
 * elas existem no RD.
 *
 * As etapas são lidas do próprio CRM, não escritas no código: antes os nomes
 * estavam fixos aqui ("Novos Leads", "Solicitação de Agendamento"), e bastava
 * alguém renomear uma etapa no RD para o card zerar sem nenhum aviso.
 *
 * Variáveis de ambiente:
 *   RD_CRM_TOKEN        — token da API do RD Station CRM
 *   RD_MARKETING_TOKEN  — opcional, só para o total de contatos por tag
 */

const CRM = 'https://crm.rdstation.com/api/v1';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Funis acompanhados. O id é o que aparece na URL do funil no RD.
const FUNIS = {
  SE: { id: '68d152fa949ae20022df32cb', nome: 'Sessão Estratégica' },
  CP: { id: '69d52f54c0b8000015d2e7b9', nome: 'Clube da Performance' },
};

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new Error(`RD ${res.status}: ${corpo.slice(0, 160)}`);
  }
  return res.json();
}

/**
 * Todos os deals do funil no período. A API entrega no máximo 200 por página
 * e o código antigo pedia uma página só — acima disso o número exibido era
 * silenciosamente menor que o real.
 */
async function fetchDeals(token, pipelineId, periodoQS, maxPaginas = 15) {
  const deals = [];
  for (let page = 1; page <= maxPaginas; page++) {
    const url = `${CRM}/deals?token=${token}&deal_pipeline_id=${pipelineId}`
              + `&limit=200&page=${page}${periodoQS}`;
    const json = await getJSON(url);
    const lote = json.deals || [];
    deals.push(...lote);
    if (lote.length < 200) break;
  }
  return deals;
}

/** Etapas de cada funil, na ordem configurada no RD. */
async function fetchEtapas(token) {
  const json = await getJSON(`${CRM}/deal_pipelines?token=${token}`);
  const porFunil = {};
  for (const p of json.deal_pipelines || json.pipelines || []) {
    const id = p._id || p.id;
    porFunil[id] = (p.deal_stages || [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(s => s.name);
  }
  return porFunil;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = process.env.RD_CRM_TOKEN;
  if (!token) return res.status(500).json({ error: 'RD_CRM_TOKEN não configurado no Vercel' });

  const params = new URL(req.url, 'http://localhost').searchParams;
  const from = params.get('from');
  const to   = params.get('to');
  const temPeriodo = DATE_RE.test(from || '') && DATE_RE.test(to || '');

  // Recorte por data de criação do deal (parâmetros da API v1 do RD CRM).
  const periodoQS = temPeriodo
    ? `&created_at_period=true&start_date=${from}&end_date=${to}`
    : '';

  try {
    const etapasPorFunil = await fetchEtapas(token).catch(e => {
      console.warn('[rd-stats] etapas indisponíveis:', e.message);
      return {};
    });

    const funis = {};
    await Promise.all(Object.entries(FUNIS).map(async ([chave, f]) => {
      const deals = await fetchDeals(token, f.id, periodoQS);

      const contagem = {};
      let ganhos = 0, perdidos = 0, valor = 0;
      for (const d of deals) {
        const etapa = d.deal_stage?.name || 'Sem etapa';
        contagem[etapa] = (contagem[etapa] || 0) + 1;
        if (d.win === true)  ganhos++;
        if (d.win === false) perdidos++;
        valor += parseFloat(d.amount_total || d.amount_unique || 0) || 0;
      }

      // Ordem vem do RD; etapas com deal que não constam na configuração
      // entram no fim para nenhum deal sumir da soma.
      const ordem = etapasPorFunil[f.id] || [];
      const extras = Object.keys(contagem).filter(n => !ordem.includes(n));
      const etapas = [...ordem, ...extras].map(nome => ({ nome, deals: contagem[nome] || 0 }));

      funis[chave] = {
        nome: f.nome,
        total: deals.length,
        etapas,
        ganhos,
        perdidos,
        valor: Math.round(valor * 100) / 100,
      };
    }));

    return res.status(200).json({
      periodo: temPeriodo ? { from, to } : null,
      acumulado: !temPeriodo,
      funis,
      gerado_em: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[api/rd-stats]', err.message);
    return res.status(502).json({ error: err.message });
  }
};
