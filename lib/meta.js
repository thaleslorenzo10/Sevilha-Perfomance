'use strict';

/**
 * Helper compartilhado da Graph API do Meta.
 *
 * O access token vive APENAS aqui (server-side, via variável de ambiente).
 * Nunca é enviado ao navegador.
 *
 * Variáveis de ambiente:
 *   META_ACCESS_TOKEN    = System User Access Token com permissão ads_read
 *   META_AD_ACCOUNT_ID   = ID numérico da conta de anúncios (sem o prefixo "act_")
 */

const API_VERSION = 'v19.0';
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

function getConfig() {
  const token = process.env.META_ACCESS_TOKEN;
  const account = process.env.META_AD_ACCOUNT_ID || '1676714556216146';
  if (!token) throw new Error('META_ACCESS_TOKEN não configurado no Vercel');
  return { token, account };
}

/**
 * GET paginado na Graph API. Segue `paging.next` até o fim (com teto de páginas
 * para não estourar o tempo de execução da função).
 */
async function graphGetAll(path, params, { maxPages = 25 } = {}) {
  const { token } = getConfig();
  const qs = new URLSearchParams({ ...params, access_token: token });
  let url = `${GRAPH}/${path}?${qs}`;

  const rows = [];
  for (let page = 0; page < maxPages && url; page++) {
    const res = await fetch(url);
    const json = await res.json();

    if (json.error) {
      const e = new Error(json.error.message || 'Erro na Graph API');
      e.metaCode = json.error.code;
      e.metaSubcode = json.error.error_subcode;
      throw e;
    }

    if (Array.isArray(json.data)) rows.push(...json.data);
    url = json.paging?.next || null;
  }
  return rows;
}

/** Soma um action_type específico do array `actions` de uma linha de insights. */
function actionValue(row, type) {
  const found = (row.actions || []).find(a => a.action_type === type);
  return found ? parseFloat(found.value) || 0 : 0;
}

/**
 * Total de leads de uma linha de insights.
 *
 * `lead` é a métrica agregada do Meta: já soma formulário instantâneo
 * (onsite) + lead do pixel no site (offsite). Quando ela não vem, caímos
 * na soma das duas partes.
 */
function extractLeads(row) {
  const total = actionValue(row, 'lead');
  if (total > 0) return total;
  return (
    actionValue(row, 'onsite_conversion.lead_grouped') +
    actionValue(row, 'offsite_conversion.fb_pixel_lead')
  );
}

/** Leads que aconteceram dentro do Meta (formulário instantâneo). */
function extractOnsiteLeads(row) {
  return actionValue(row, 'onsite_conversion.lead_grouped');
}

/** Leads que aconteceram no site (pixel da landing page). */
function extractPixelLeads(row) {
  return actionValue(row, 'offsite_conversion.fb_pixel_lead');
}

/**
 * Classifica a campanha pelo padrão de nomenclatura usado na conta:
 *   [CP]  → Clube da Performance
 *   [SE]  → Sessão Estratégica
 *   demais → OUTROS (ex.: [DISTRIBUIÇÃO]), que continuam contando no
 *            investimento total da conta para nenhum real ficar invisível.
 */
function classifyCampaign(name = '') {
  const upper = name.toUpperCase();
  const grupo = upper.includes('[CP]') ? 'CP'
              : upper.includes('[SE]') ? 'SE'
              : 'OUTROS';

  // [FORMS] = formulário instantâneo do Meta; sem a tag = tráfego para a landing page.
  const formato = upper.includes('[FORMS]') ? 'FORMS' : 'LP';

  const temperatura = upper.includes('[HOT]')  ? 'HOT'
                    : upper.includes('[COLD]') ? 'COLD'
                    : null;

  return { grupo, formato, temperatura };
}

const FIELDS_CAMPAIGN = [
  'campaign_id',
  'campaign_name',
  'spend',
  'impressions',
  'clicks',
  'ctr',
  'cpm',
  'actions',
].join(',');

/** Insights por campanha no período. */
async function fetchCampaignInsights(since, until) {
  const { account } = getConfig();
  return graphGetAll(`act_${account}/insights`, {
    fields: FIELDS_CAMPAIGN,
    level: 'campaign',
    time_range: JSON.stringify({ since, until }),
    limit: '100',
  });
}

/** Insights por campanha quebrados por dia (para os gráficos de série temporal). */
async function fetchDailyInsights(since, until) {
  const { account } = getConfig();
  return graphGetAll(`act_${account}/insights`, {
    fields: 'campaign_id,campaign_name,spend,actions,date_start',
    level: 'campaign',
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    limit: '500',
  });
}

/** Insights por anúncio — base do ranking de melhores criativos. */
async function fetchAdInsights(since, until) {
  const { account } = getConfig();
  return graphGetAll(`act_${account}/insights`, {
    fields: 'ad_id,ad_name,campaign_name,spend,impressions,clicks,ctr,actions',
    level: 'ad',
    time_range: JSON.stringify({ since, until }),
    limit: '200',
  });
}

/**
 * Link público do post no Instagram, por anúncio.
 *
 * O permalink não vem no endpoint de insights: mora no criativo, que precisa
 * ser buscado a partir do anúncio. Nem todo anúncio tem post no Instagram
 * (dark post sem publicação, anúncio só do Facebook), então o link é opcional
 * e a ausência dele nunca derruba o resumo.
 */
async function fetchAdInstagramLinks(adIds) {
  if (!adIds.length) return new Map();
  const { token } = getConfig();

  const qs = new URLSearchParams({
    ids: adIds.slice(0, 50).join(','),
    fields: 'creative{instagram_permalink_url,effective_instagram_media_id}',
    access_token: token,
  });

  try {
    const res = await fetch(`${GRAPH}/?${qs}`);
    const json = await res.json();
    if (json.error) {
      console.warn('[meta] links do Instagram indisponíveis:', json.error.message);
      return new Map();
    }
    const mapa = new Map();
    for (const [adId, dados] of Object.entries(json)) {
      const url = dados?.creative?.instagram_permalink_url;
      if (url) mapa.set(adId, url);
    }
    return mapa;
  } catch (e) {
    console.warn('[meta] links do Instagram falharam:', e.message);
    return new Map();
  }
}

module.exports = {
  API_VERSION,
  fetchAdInsights,
  fetchAdInstagramLinks,
  getConfig,
  graphGetAll,
  actionValue,
  extractLeads,
  extractOnsiteLeads,
  extractPixelLeads,
  classifyCampaign,
  fetchCampaignInsights,
  fetchDailyInsights,
};
