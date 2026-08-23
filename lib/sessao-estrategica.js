'use strict';

/**
 * Sevilha Performance — Números da Sessão Estratégica
 * GET /api/sessao-estrategica?since=YYYY-MM-DD&until=YYYY-MM-DD
 *   (servido por api/stats.js via rewrite — o plano Hobby limita o deploy a 12
 *   funções, então os dois relatórios dividem a mesma função)
 *
 * A página /mentoria tem formulário próprio, então o lead dela nasce no
 * Supabase — diferente do Clube da Performance, cujos números o dashboard lê
 * das planilhas que o Respondi e o Meta preenchem. Por isso este endpoint não
 * reaproveita /api/sheet-leads: a fonte é outra.
 *
 * Devolve só agregados. Nome, e-mail e telefone não saem daqui.
 *
 * Variáveis de ambiente:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

const { TABELAS } = require('./supabase');
const { classificarPorte, PORTE_MAIOR, PORTE_MENOR, PORTE_INDEF } = require('./porte');

const PAGINA   = process.env.SESSAO_ESTRATEGICA_PAGINA || '/mentoria';
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;

function contar(mapa, chave) {
  const k = chave || '(não informado)';
  mapa[k] = (mapa[k] || 0) + 1;
}

/** Ordena um mapa de contagens do maior para o menor e devolve como lista. */
function ranking(mapa) {
  return Object.entries(mapa)
    .sort((a, b) => b[1] - a[1])
    .map(([chave, total]) => ({ chave, total }));
}

async function responder(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase não configurado' });
  }

  const params = new URL(req.url, 'http://localhost').searchParams;
  const since  = params.get('since');
  const until  = params.get('until');

  if ((since && !DATE_RE.test(since)) || (until && !DATE_RE.test(until))) {
    return res.status(400).json({ error: 'since/until devem estar em YYYY-MM-DD' });
  }

  const headers = {
    apikey:          supabaseKey,
    Authorization:   `Bearer ${supabaseKey}`,
    'Content-Type':  'application/json',
  };

  function url(tabela, select) {
    let u = `${supabaseUrl}/rest/v1/${tabela}`
          + `?select=${select}&pagina=eq.${encodeURIComponent(PAGINA)}`;
    if (since) u += `&created_at=gte.${since}T00:00:00`;
    if (until) u += `&created_at=lte.${until}T23:59:59`;
    return u;
  }

  try {
    const [leadsRes, viewsRes] = await Promise.all([
      fetch(url(TABELAS.leads,
                'created_at,cargo,colaboradores,utm_source,utm_campaign,utm_content'), { headers }),
      fetch(url(TABELAS.pageViews, 'created_at'), { headers }),
    ]);

    if (!leadsRes.ok) {
      return res.status(502).json({ error: `Supabase leads: ${leadsRes.status}`, detalhe: await leadsRes.text() });
    }

    const leads = await leadsRes.json();
    // As visitas vêm do beacon da própria página (/api/pageview): esta rota
    // não passa pelo redirect /campanha, que é quem registra as variantes do
    // teste A/B.
    const views = viewsRes.ok ? await viewsRes.json() : [];

    const porDia   = {};
    const porPorte = { [PORTE_MAIOR]: 0, [PORTE_MENOR]: 0, [PORTE_INDEF]: 0 };
    const porCargo = {};
    const porFonte = {};
    const porCampanha = {};

    for (const lead of leads) {
      const dia = String(lead.created_at || '').slice(0, 10);
      if (dia) porDia[dia] = (porDia[dia] || 0) + 1;

      porPorte[classificarPorte(lead.colaboradores)] += 1;
      contar(porCargo, lead.cargo);
      contar(porFonte, lead.utm_source);
      contar(porCampanha, lead.utm_campaign);
    }

    return res.status(200).json({
      pagina: PAGINA,
      periodo: { since: since || null, until: until || null },
      total: leads.length,
      porte: {
        maior: porPorte[PORTE_MAIOR],
        menor: porPorte[PORTE_MENOR],
        indefinido: porPorte[PORTE_INDEF],
      },
      por_dia:      Object.entries(porDia).sort().map(([dia, total]) => ({ dia, total })),
      por_cargo:    ranking(porCargo),
      por_fonte:    ranking(porFonte),
      por_campanha: ranking(porCampanha),
      visitas_medidas: views.length,
      conversao: views.length ? (leads.length / views.length) * 100 : null,
      nota_visitas: views.length
        ? null
        : 'Sem visitas registradas no período — confira se o beacon /api/pageview está respondendo.',
    });
  } catch (e) {
    console.error('[sessao-estrategica]', e.message);
    return res.status(500).json({ error: e.message });
  }
}

module.exports = { responder };
