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

// As duas páginas da oferta entram no mesmo relatório: o total responde
// "quantos leads a Sessão Estratégica trouxe", e por_pagina responde "qual
// layout converteu melhor" — que é a pergunta do teste A/B.
const PAGINAS = (process.env.SESSAO_ESTRATEGICA_PAGINAS || '/mentoria,/mentoria-2')
  .split(',').map(s => s.trim()).filter(Boolean);
const DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;

// O banco grava em UTC e o dashboard pergunta em data de Brasília. Sem o
// offset, um lead das 21h-24h cai no dia seguinte e some do período — foi
// assim que o primeiro lead da /mentoria-2 não apareceu no relatório.
const FUSO = '-03:00';

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

  function url(tabela, select, colunaData = 'created_at') {
    const lista = PAGINAS.map(p => `"${p}"`).join(',');
    let u = `${supabaseUrl}/rest/v1/${tabela}`
          + `?select=${select}&pagina=in.(${encodeURIComponent(lista)})`;
    if (since) u += `&${colunaData}=gte.${since}T00:00:00${FUSO}`;
    if (until) u += `&${colunaData}=lte.${until}T23:59:59${FUSO}`;
    return u;
  }

  /**
   * Visitantes distintos no período, lidos da tabela de micro-eventos.
   *
   * Por que não é uma chamada só: a tabela de eventos não usa `created_at`
   * como as outras deste banco, e filtrar por uma coluna que não existe faz o
   * PostgREST devolver 400 — que aqui viraria "zero visitantes" em silêncio,
   * ou seja, uma taxa de conversão errada com cara de certa. Foi exatamente o
   * que aconteceu no primeiro deploy desta função, em 03/09/2026.
   *
   * Em vez de fixar um palpite de nome, a função tenta os nomes plausíveis e
   * devolve junto qual funcionou. Assim que o nome estiver confirmado no
   * relatório, dá para reduzir a lista a ele — e, enquanto não estiver, o
   * relatório diz que não mediu em vez de inventar zero.
   */
  const COLUNAS_DATA = ['created_at', 'criado_em', 'inserted_at', 'timestamp', 'data'];

  async function buscarVisitantes() {
    const alvo = `${TABELAS.eventosPagina}`;
    // Sem período não há filtro de data, então a primeira tentativa resolve.
    const candidatas = (since || until) ? COLUNAS_DATA : ['created_at'];

    for (const coluna of candidatas) {
      const u = `${url(alvo, 'pagina,visitante', coluna)}&evento=eq.pageview`;
      try {
        const r = await fetch(u, { headers });
        if (r.ok) return { linhas: await r.json(), coluna };
        // 400 aqui é "coluna não existe"; qualquer outro status é falha real.
        if (r.status !== 400) {
          console.warn('[sessao-estrategica] visitantes:', r.status, (await r.text()).slice(0, 200));
          return { linhas: [], coluna: null };
        }
      } catch (e) {
        console.warn('[sessao-estrategica] visitantes falhou:', e.message);
        return { linhas: [], coluna: null };
      }
    }
    console.warn('[sessao-estrategica] nenhuma coluna de data serviu em', alvo);
    return { linhas: [], coluna: null };
  }

  /**
   * Funil da página, agregado no banco pela função `sevilha_funil`.
   *
   * A agregação é lá e não aqui porque a conta certa é por VISITANTE distinto,
   * não por evento — e trazer dezenas de milhares de linhas para contar em
   * memória seria caro e teria que paginar. Falha aqui não derruba o relatório:
   * o funil é acompanhamento, os leads é que são o número.
   */
  async function buscarFunil() {
    const desde = since ? `${since}T00:00:00${FUSO}` : '1970-01-01T00:00:00Z';
    const ate   = until ? `${until}T23:59:59${FUSO}` : '2999-12-31T23:59:59Z';
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/rpc/sevilha_funil`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ desde, ate, paginas: PAGINAS }),
      });
      if (!r.ok) {
        console.warn('[sessao-estrategica] funil indisponível:', r.status, (await r.text()).slice(0, 200));
        return null;
      }
      return await r.json();
    } catch (e) {
      console.warn('[sessao-estrategica] funil falhou:', e.message);
      return null;
    }
  }

  try {
    // Visitante distinto, e não linha de visita: o beacon grava uma linha por
    // CARREGAMENTO, então recarga, volta do WhatsApp e conferência interna
    // entravam todas no denominador. Medido em 03/09/2026: 498 visitas contra
    // 185 carregamentos vindos de anúncio no Meta — a taxa saía pela metade do
    // que era. O evento `pageview` carrega o id do visitante.
    const [leadsRes, viewsRes, visitantes, funil] = await Promise.all([
      fetch(url(TABELAS.leads,
                'created_at,pagina,cargo,colaboradores,utm_source,utm_campaign,utm_content'), { headers }),
      fetch(url(TABELAS.pageViews, 'created_at,pagina'), { headers }),
      buscarVisitantes(),
      buscarFunil(),
    ]);

    if (!leadsRes.ok) {
      return res.status(502).json({ error: `Supabase leads: ${leadsRes.status}`, detalhe: await leadsRes.text() });
    }

    const leads = await leadsRes.json();
    // As visitas vêm do beacon da própria página (/api/pageview): esta rota
    // não passa pelo redirect /campanha, que é quem registra as variantes do
    // teste A/B.
    const views = viewsRes.ok ? await viewsRes.json() : [];
    const marcas = visitantes.linhas;

    const porDia   = {};
    const porPorte = { [PORTE_MAIOR]: 0, [PORTE_MENOR]: 0, [PORTE_INDEF]: 0 };
    const porCargo = {};
    const porFonte = {};
    const porCampanha = {};
    const porPagina = Object.fromEntries(PAGINAS.map(
      p => [p, { leads: 0, visitas: 0, visitantes: 0, conversao: null }]));

    // Um Set por página: a contagem tem de ser de pessoa distinta, e o mesmo
    // visitante aparece uma vez por carregamento.
    const vistos = Object.fromEntries(PAGINAS.map(p => [p, new Set()]));
    for (const m of marcas) {
      if (vistos[m.pagina] && m.visitante) vistos[m.pagina].add(m.visitante);
    }
    for (const p of PAGINAS) porPagina[p].visitantes = vistos[p].size;

    // O total é a UNIÃO, não a soma: com o cookie do teste A/B a mesma pessoa
    // raramente vê as duas páginas, mas somar contaria em dobro quem viu.
    const totalVisitantes = new Set(
      marcas.filter(m => vistos[m.pagina] && m.visitante).map(m => m.visitante)
    ).size;

    for (const v of views) {
      if (porPagina[v.pagina]) porPagina[v.pagina].visitas += 1;
    }

    for (const lead of leads) {
      if (porPagina[lead.pagina]) porPagina[lead.pagina].leads += 1;
      const dia = String(lead.created_at || '').slice(0, 10);
      if (dia) porDia[dia] = (porDia[dia] || 0) + 1;

      porPorte[classificarPorte(lead.colaboradores)] += 1;
      contar(porCargo, lead.cargo);
      contar(porFonte, lead.utm_source);
      contar(porCampanha, lead.utm_campaign);
    }

    // A conversão é sobre visitante distinto. `visitas` continua no payload
    // porque é a série histórica — mas dividir por ela mede recarga, não pessoa.
    for (const p of Object.values(porPagina)) {
      const base = p.visitantes || p.visitas;
      p.conversao = base ? (p.leads / base) * 100 : null;
      p.base_conversao = p.visitantes ? 'visitantes' : (p.visitas ? 'visitas' : null);
    }

    return res.status(200).json({
      paginas: PAGINAS,
      por_pagina: porPagina,
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
      // Passos entre a visita e o lead. `null` quando a função do banco não
      // respondeu — o dashboard mostra a seção vazia em vez de zeros, que
      // seriam lidos como "ninguém clicou" em vez de "não medido".
      funil,
      visitas_medidas: views.length,
      // O número que vale: pessoa distinta que carregou a página. Tráfego
      // marcado como interno (?sp_interno=1) não chega aqui — não é gravado.
      visitantes_medidos: totalVisitantes,
      conversao: totalVisitantes
        ? (leads.length / totalVisitantes) * 100
        : (views.length ? (leads.length / views.length) * 100 : null),
      base_conversao: totalVisitantes ? 'visitantes' : (views.length ? 'visitas' : null),
      // Qual coluna de data serviu na tabela de eventos. `null` significa que
      // nenhuma serviu e o número de visitantes não foi medido — a diferença
      // entre "ninguém veio" e "não consegui contar" precisa aparecer.
      coluna_data_eventos: visitantes.coluna,
      nota_visitas: views.length
        ? (totalVisitantes
            ? null
            : (visitantes.coluna
                ? 'Visitas registradas, mas nenhum visitante distinto: o evento `pageview` do assets/tracking.js não está chegando — confira o ?v= da tag <script> na página.'
                : 'Não foi possível contar visitantes distintos: nenhuma coluna de data conhecida existe em ' + TABELAS.eventosPagina + '. A conversão abaixo está por carregamento, não por pessoa.'))
        : 'Sem visitas registradas no período — confira se o beacon /api/pageview está respondendo.',
    });
  } catch (e) {
    console.error('[sessao-estrategica]', e.message);
    return res.status(500).json({ error: e.message });
  }
}

module.exports = { responder };
