'use strict';

/**
 * Sevilha Performance — A/B Stats Endpoint
 * GET /api/stats?from=2026-04-01&to=2026-04-09
 *
 * Parâmetros opcionais:
 *   from  — data inicial (ISO 8601, ex: 2026-04-01)
 *   to    — data final   (ISO 8601, ex: 2026-04-09)
 */

const { TABELAS } = require('../lib/supabase');
const { responder: responderSessaoEstrategica } = require('../lib/sessao-estrategica');

const PAGES = ['/', '/pre-inscricao-2', '/pre-inscricao-3'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).end();

  // /api/sessao-estrategica chega aqui pelo rewrite: outro relatório, outra
  // fonte (Supabase por página), mesma função — ver lib/sessao-estrategica.js.
  // O caminho também é aceito como pista: se o rewrite deixar de repassar a
  // query, o relatório certo continua respondendo em vez de devolver o do A/B.
  const url  = new URL(req.url, 'http://localhost');
  const modo = url.searchParams.get('modo');
  if (modo === 'sessao-estrategica' || url.pathname.includes('sessao-estrategica')) {
    return responderSessaoEstrategica(req, res);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase não configurado' });
  }

  const headers = {
    'apikey':        supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type':  'application/json',
  };

  // Filtro de data via query params
  const params = new URL(req.url, 'http://localhost').searchParams;
  const from   = params.get('from'); // ex: "2026-04-01"
  const to     = params.get('to');   // ex: "2026-04-09"

  function buildFilter(table, select) {
    let url = `${supabaseUrl}/rest/v1/${table}?select=${select}`;
    if (from) url += `&created_at=gte.${from}T00:00:00`;
    if (to)   url += `&created_at=lte.${to}T23:59:59`;
    return url;
  }

  try {
    const [viewsData, leadsData] = await Promise.all([
      fetchAll(buildFilter(TABELAS.pageViews, 'pagina'), headers),
      fetchAll(buildFilter(TABELAS.leads,     'pagina'), headers),
    ]);

    const visits = countBy(viewsData, 'pagina');
    const leads  = countBy(leadsData, 'pagina');

    const variants = PAGES.map((pagina, index) => {
      const v = visits[pagina] || 0;
      const l = leads[pagina]  || 0;
      return {
        variant:         index,
        pagina,
        visits:          v,
        leads:           l,
        conversion_rate: v > 0 ? parseFloat(((l / v) * 100).toFixed(2)) : 0,
      };
    });

    const totalVisits = variants.reduce((s, v) => s + v.visits, 0);
    const totalLeads  = variants.reduce((s, v) => s + v.leads,  0);
    const totalRate   = totalVisits > 0
      ? parseFloat(((totalLeads / totalVisits) * 100).toFixed(2))
      : 0;

    return res.status(200).json({
      variants,
      totals: { visits: totalVisits, leads: totalLeads, conversion_rate: totalRate },
      generated_at: new Date().toISOString(),
    });

  } catch (e) {
    console.error('[stats error]', e.message);
    return res.status(500).json({ error: e.message });
  }
};

async function fetchAll(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const val = row[key];
    if (val) acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}
