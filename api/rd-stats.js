'use strict';

/**
 * GET /api/rd-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns RD Marketing contacts + RD CRM deals for both campaigns
 *
 * O período é aplicado nos deals do CRM (a API v1 aceita recorte por data de
 * criação). O total de contatos do RD Marketing é acumulado — a API de
 * contatos não filtra por data —, por isso vai marcado como `acumulado: true`
 * para o dashboard não apresentar esse número como se fosse do período.
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const RM = process.env.RD_MARKETING_TOKEN;
  const RC = process.env.RD_CRM_TOKEN;

  if (!RM || !RC) {
    return res.status(500).json({ error: 'Missing RD tokens' });
  }

  const params = new URL(req.url, 'http://localhost').searchParams;
  const from = params.get('from');
  const to   = params.get('to');
  const temPeriodo = DATE_RE.test(from || '') && DATE_RE.test(to || '');

  // Recorte por data de criação do deal (parâmetros da API v1 do RD CRM).
  const periodoQS = temPeriodo
    ? `&created_at_period=true&start_date=${from}&end_date=${to}`
    : '';

  async function fetchAll(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) {
        console.warn('[rd-stats]', r.status, url.replace(/(token|api_key)=[^&]+/g, '$1=***'));
        return null;
      }
      return r.json();
    } catch (e) {
      console.warn('[rd-stats] exception', e.message);
      return null;
    }
  }

  const [
    cpContacts,
    seContacts,
    cpDeals,
    seDeals,
    crmStages,
  ] = await Promise.all([
    // RD Marketing — Clube da Performance leads
    fetchAll(`https://api.rd.services/platform/contacts?api_key=${RM}&tags=pre-inscricao&page_size=100`),
    // RD Marketing — Sessão Estratégica leads (tag: sessao-estrategica)
    fetchAll(`https://api.rd.services/platform/contacts?api_key=${RM}&tags=sessao-estrategica&page_size=100`),
    // RD CRM — Clube da Performance pipeline
    fetchAll(`https://crm.rdstation.com/api/v1/deals?token=${RC}&deal_pipeline_id=69d52f54c0b8000015d2e7b9&limit=200${periodoQS}`),
    // RD CRM — Funil Padrão (SE)
    fetchAll(`https://crm.rdstation.com/api/v1/deals?token=${RC}&deal_pipeline_id=68d152fa949ae20022df32cb&limit=200${periodoQS}`),
    // Pipeline stages
    fetchAll(`https://crm.rdstation.com/api/v1/deal_pipelines?token=${RC}`),
  ]);

  // Aggregate CRM deals by stage
  function dealsByStage(dealsData) {
    if (!dealsData?.deals) return {};
    const map = {};
    for (const d of dealsData.deals) {
      const stage = d.deal_stage?.name || 'Sem etapa';
      map[stage] = (map[stage] || 0) + 1;
    }
    return map;
  }

  return res.status(200).json({
    periodo: temPeriodo ? { from, to } : null,
    rd_marketing: {
      // A API de contatos do RD Marketing não recorta por data.
      acumulado: true,
      cp: { total: cpContacts?.total ?? 0 },
      se: { total: seContacts?.total ?? 0 },
    },
    rd_crm: {
      acumulado: !temPeriodo,
      cp: {
        total: cpDeals?.total ?? 0,
        by_stage: dealsByStage(cpDeals),
      },
      se: {
        total: seDeals?.total ?? 0,
        by_stage: dealsByStage(seDeals),
      },
    },
    generated_at: new Date().toISOString(),
  });
};
