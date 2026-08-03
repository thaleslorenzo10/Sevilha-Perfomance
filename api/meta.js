'use strict';

/**
 * Sevilha Performance — Meta Ads (server-side)
 * GET /api/meta?since=YYYY-MM-DD&until=YYYY-MM-DD
 *
 * Substitui as chamadas que o dashboard fazia direto do navegador para a
 * Graph API. O access token fica só no servidor (env META_ACCESS_TOKEN).
 *
 * Devolve:
 *   totais da conta, por grupo ([CP]/[SE]/OUTROS), por formato (FORMS/LP),
 *   lista de campanhas e a série diária.
 */

const {
  extractLeads,
  extractOnsiteLeads,
  extractPixelLeads,
  classifyCampaign,
  fetchCampaignInsights,
  fetchDailyInsights,
} = require('../lib/meta');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function emptyBucket() {
  return { spend: 0, leads: 0, leads_onsite: 0, leads_pixel: 0, impressions: 0, clicks: 0 };
}

function addToBucket(bucket, row) {
  bucket.spend        += parseFloat(row.spend || 0);
  bucket.leads        += extractLeads(row);
  bucket.leads_onsite += extractOnsiteLeads(row);
  bucket.leads_pixel  += extractPixelLeads(row);
  bucket.impressions  += parseFloat(row.impressions || 0);
  bucket.clicks       += parseFloat(row.clicks || 0);
  return bucket;
}

/** Deriva CPL, CTR e CPM a partir dos totais somados (nunca a média das médias). */
function withDerived(bucket) {
  const { spend, leads, impressions, clicks } = bucket;
  return {
    ...bucket,
    spend:  round2(spend),
    cpl:    leads > 0       ? round2(spend / leads)              : null,
    ctr:    impressions > 0 ? round2((clicks / impressions) * 100) : null,
    cpm:    impressions > 0 ? round2((spend / impressions) * 1000) : null,
    cpc:    clicks > 0      ? round2(spend / clicks)             : null,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Todos os dias do intervalo, inclusive. Em UTC, para não pular dia no horário de verão. */
function eachDay(since, until) {
  const dias = [];
  const cur = new Date(`${since}T00:00:00Z`);
  const fim = new Date(`${until}T00:00:00Z`);
  // Teto de segurança: um intervalo absurdo não deve gerar série infinita.
  for (let i = 0; cur <= fim && i < 400; i++) {
    dias.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dias;
}

/**
 * Monta o payload do Meta para um período. Exportado à parte do handler para
 * o resumo do WhatsApp usar exatamente os mesmos números do dashboard — se
 * cada um calculasse por conta, os dois divergiriam com o tempo.
 */
async function montarMeta(since, until) {
  {
    const [rows, dailyRows] = await Promise.all([
      fetchCampaignInsights(since, until),
      fetchDailyInsights(since, until),
    ]);

    // ── Campanhas ────────────────────────────────────────────────────────
    const campanhas = rows.map(r => {
      const meta = classifyCampaign(r.campaign_name);
      const spend = parseFloat(r.spend || 0);
      const leads = extractLeads(r);
      const impressions = parseFloat(r.impressions || 0);
      const clicks = parseFloat(r.clicks || 0);
      return {
        id:           r.campaign_id,
        nome:         r.campaign_name,
        ...meta,
        spend:        round2(spend),
        leads,
        leads_onsite: extractOnsiteLeads(r),
        leads_pixel:  extractPixelLeads(r),
        impressions,
        clicks,
        cpl: leads > 0       ? round2(spend / leads)                : null,
        ctr: impressions > 0 ? round2((clicks / impressions) * 100) : null,
        cpm: impressions > 0 ? round2((spend / impressions) * 1000) : null,
      };
    }).sort((a, b) => b.spend - a.spend);

    // ── Agregados ────────────────────────────────────────────────────────
    const conta    = emptyBucket();
    const grupos   = { CP: emptyBucket(), SE: emptyBucket(), OUTROS: emptyBucket() };
    // Formato só faz sentido dentro das campanhas de captação ([CP]/[SE]).
    const formatos = { FORMS: emptyBucket(), LP: emptyBucket() };

    for (const r of rows) {
      const { grupo, formato } = classifyCampaign(r.campaign_name);
      addToBucket(conta, r);
      addToBucket(grupos[grupo], r);
      if (grupo !== 'OUTROS') addToBucket(formatos[formato], r);
    }

    // ── Série diária ─────────────────────────────────────────────────────
    // Uma entrada por dia com investimento e leads por grupo e por formato.
    // O intervalo é pré-preenchido: o Meta omite os dias sem entrega, e um dia
    // ausente sumia do gráfico em vez de aparecer como zero — a linha ligava
    // os dois vizinhos e escondia a interrupção.
    const diaVazio = dia => ({
      data:  dia,
      spend: 0,
      leads: 0,
      CP:    { spend: 0, leads: 0 },
      SE:    { spend: 0, leads: 0 },
      FORMS: { spend: 0, leads: 0 },
      LP:    { spend: 0, leads: 0 },
    });

    const dias = {};
    for (const dia of eachDay(since, until)) dias[dia] = diaVazio(dia);

    for (const r of dailyRows) {
      const dia = r.date_start;
      if (!dia) continue;
      if (!dias[dia]) dias[dia] = diaVazio(dia);
      const d = dias[dia];
      const { grupo, formato } = classifyCampaign(r.campaign_name);
      const spend = parseFloat(r.spend || 0);
      const leads = extractLeads(r);

      d.spend += spend;
      d.leads += leads;
      if (grupo === 'CP' || grupo === 'SE') {
        d[grupo].spend += spend;
        d[grupo].leads += leads;
        d[formato].spend += spend;
        d[formato].leads += leads;
      }
    }

    const serie = Object.values(dias)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(d => ({
        ...d,
        spend: round2(d.spend),
        CP:    { spend: round2(d.CP.spend),    leads: d.CP.leads },
        SE:    { spend: round2(d.SE.spend),    leads: d.SE.leads },
        FORMS: { spend: round2(d.FORMS.spend), leads: d.FORMS.leads },
        LP:    { spend: round2(d.LP.spend),    leads: d.LP.leads },
      }));

    return {
      periodo: { since, until },
      conta:   withDerived(conta),
      grupos: {
        CP:     withDerived(grupos.CP),
        SE:     withDerived(grupos.SE),
        OUTROS: withDerived(grupos.OUTROS),
      },
      formatos: {
        FORMS: withDerived(formatos.FORMS),
        LP:    withDerived(formatos.LP),
      },
      campanhas,
      serie,
      gerado_em: new Date().toISOString(),
    };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  // Cache curto na borda: segura rajadas de refresh sem deixar o dado velho.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const params = new URL(req.url, 'http://localhost').searchParams;
  const since = params.get('since');
  const until = params.get('until');

  if (!DATE_RE.test(since || '') || !DATE_RE.test(until || '')) {
    return res.status(400).json({ error: 'Informe since e until no formato YYYY-MM-DD' });
  }
  if (since > until) {
    return res.status(400).json({ error: 'since não pode ser maior que until' });
  }

  try {
    return res.status(200).json(await montarMeta(since, until));
  } catch (err) {
    console.error('[api/meta]', err.message);
    const status = /META_ACCESS_TOKEN/.test(err.message) ? 500 : 502;
    return res.status(status).json({ error: err.message, meta_code: err.metaCode ?? null });
  }
};

module.exports.montarMeta = montarMeta;
