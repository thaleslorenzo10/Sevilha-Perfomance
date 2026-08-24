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
const { ehQualificado } = require('../lib/porte');

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
  // O dashboard fala since/until; o A/B, from/to. Aceitar os dois evita que uma
  // tela peça o período certo e receba o histórico inteiro sem avisar.
  const from   = params.get('from') || params.get('since'); // ex: "2026-04-01"
  const to     = params.get('to')   || params.get('until'); // ex: "2026-04-09"

  function buildFilter(table, select) {
    let url = `${supabaseUrl}/rest/v1/${table}?select=${select}`;
    if (from) url += `&created_at=gte.${from}T00:00:00`;
    if (to)   url += `&created_at=lte.${to}T23:59:59`;
    return url;
  }

  try {
    const [viewsData, leadsData] = await Promise.all([
      fetchAll(buildFilter(TABELAS.pageViews, 'pagina'), headers),
      fetchAll(buildFilter(TABELAS.leads,     'pagina,colaboradores'), headers),
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

    // Comparação por página, sem lista fixa: página nova aparece sozinha, em vez
    // de existir no banco e faltar no relatório. Qualificado = 10+ colaboradores,
    // a mesma regra que dispara o LeadQualificado no Meta (lib/porte.js).
    const qualificados = countBy(leadsData.filter(l => ehQualificado(l.colaboradores)), 'pagina');
    const paginas = [...new Set([...Object.keys(visits), ...Object.keys(leads)])]
      .map(pagina => {
        const v = visits[pagina] || 0;
        const l = leads[pagina]  || 0;
        const q = qualificados[pagina] || 0;
        return {
          pagina,
          visits:            v,
          leads:             l,
          leads_qualificados: q,
          conversion_rate:   v > 0 ? parseFloat(((l / v) * 100).toFixed(2)) : null,
          qualification_rate: l > 0 ? parseFloat(((q / l) * 100).toFixed(2)) : null,
        };
      })
      .sort((a, b) => b.leads - a.leads || b.visits - a.visits);

    const totalVisits = variants.reduce((s, v) => s + v.visits, 0);
    const totalLeads  = variants.reduce((s, v) => s + v.leads,  0);
    const totalRate   = totalVisits > 0
      ? parseFloat(((totalLeads / totalVisits) * 100).toFixed(2))
      : 0;

    return res.status(200).json({
      variants,
      paginas,
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
