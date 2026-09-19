'use strict';

/**
 * Sevilha Performance — Leads reais (planilhas)
 * GET /api/sheet-leads?since=YYYY-MM-DD&until=YYYY-MM-DD
 *
 * Lê as planilhas no servidor e devolve APENAS números agregados. Nome,
 * e-mail e telefone não saem daqui.
 *
 * Cada formato de campanha tem a sua fonte:
 *   • FORMS — formulário instantâneo do Meta, exportado para a planilha
 *     [CENTRAL DE EVENTOS] (colunas form_id / form_name / created_time).
 *   • LP — formulário da landing page, lido direto da planilha que a
 *     integração nativa do Respondi preenche (colunas "Qual seu nome?" /
 *     "Data" / utm_*). As cópias de LP que existem na Central são ignoradas:
 *     a aba "base" morreu em set/2025 e o log "Eventos Geral" perdeu ~130
 *     leads em panes de sincronização (13 dias parado na virada 2025→2026).
 *
 * Lead de LP só conta com e-mail ou telefone — o Respondi grava toda
 * submissão, inclusive abandonos de formulário (~8% sem nenhum contato).
 *
 * As linhas são identificadas pelo conteúdo/cabeçalho, não pelo nome da aba —
 * assim a função continua funcionando se alguém renomear ou adicionar abas.
 */

const { readAllTabs, readLPTabs } = require('../lib/sheets');
const { classificarPorte, PORTE_MAIOR, PORTE_MENOR, PORTE_INDEF } = require('../lib/porte');
const {
  TAB_FORMS, TAB_LP, findLPHeaders, extractForms, extractLP, labelCargo, labelColaboradores,
} = require('../lib/planilha-leads');
const { responderUnificados } = require('../lib/leads-fontes');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ── Agregação ───────────────────────────────────────────────────────── */

function countBy(items, keyFn) {
  const map = {};
  for (const i of items) {
    const k = keyFn(i);
    if (!k) continue;
    map[k] = (map[k] || 0) + 1;
  }
  return map;
}

function toSortedList(map, chave) {
  return Object.entries(map)
    .map(([k, v]) => ({ [chave]: k, leads: v }))
    .sort((a, b) => b.leads - a.leads);
}

function coverage(items) {
  if (!items.length) return { total: 0, primeiro: null, ultimo: null };
  const datas = items.map(i => i.data).sort();
  return { total: items.length, primeiro: datas[0], ultimo: datas[datas.length - 1] };
}

/**
 * Monta os agregados da planilha para um período. Exportado à parte do handler
 * para o resumo do WhatsApp usar exatamente os mesmos números do dashboard.
 */
async function montarLeads(since, until) {
  {
    // Cada fonte com o seu extrator, sem cruzar: a Central ainda guarda
    // cópias antigas de LP (a aba "base" e o log "Eventos Geral") que
    // voltariam a contar — em dobro — se ela passasse pelo extractLP.
    const [tabsCentral, tabsLP] = await Promise.all([readAllTabs(), readLPTabs()]);

    let todos = [];
    for (const { rows } of tabsCentral) {
      todos = todos.concat(extractForms(rows));
    }
    for (const { rows } of tabsLP) {
      for (const header of findLPHeaders(rows)) {
        todos = todos.concat(extractLP(rows, header));
      }
    }

    // Deduplica: re-submissões do mesmo contato na LP e, no export do Meta,
    // blocos colados repetidos na mesma aba.
    const vistos = new Set();
    todos = todos.filter(l => {
      const chave = `${l.fonte}|${l.id}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

    const noPeriodo = todos.filter(l => l.data >= since && l.data <= until);
    const forms = noPeriodo.filter(l => l.fonte === TAB_FORMS);
    const lp    = noPeriodo.filter(l => l.fonte === TAB_LP);

    // Série diária por formato.
    const porDiaMap = {};
    for (const l of noPeriodo) {
      if (!porDiaMap[l.data]) porDiaMap[l.data] = { data: l.data, FORMS: 0, LP: 0, total: 0 };
      porDiaMap[l.data][l.fonte]++;
      porDiaMap[l.data].total++;
    }

    // Porte do escritório — total e quebrado por formato de campanha, para
    // dar pra ver qual formato traz mais escritório grande e a que custo.
    const contarPorte = itens => ({
      MAIOR_10:   itens.filter(l => classificarPorte(l.colaboradores) === PORTE_MAIOR).length,
      MENOR_10:   itens.filter(l => classificarPorte(l.colaboradores) === PORTE_MENOR).length,
      INDEFINIDO: itens.filter(l => classificarPorte(l.colaboradores) === PORTE_INDEF).length,
    });

    return {
      periodo: { since, until },
      total: noPeriodo.length,
      por_formato: { FORMS: forms.length, LP: lp.length },
      porte: contarPorte(noPeriodo),
      porte_por_formato: { FORMS: contarPorte(forms), LP: contarPorte(lp) },
      por_formulario: toSortedList(countBy(noPeriodo, l => l.formulario), 'formulario'),
      por_campanha:   toSortedList(countBy(noPeriodo, l => l.campanha),   'campanha'),
      // Cobre os dois formatos: o export do Meta traz ad_name e a LP traz o
      // nome no utm_content. Antes só contava FORMS, o que subestimava
      // qualquer criativo que também rodasse para a landing page.
      por_anuncio: Object.entries(
        noPeriodo.reduce((acc, l) => {
          const nome = (l.anuncio || '').trim();
          if (!nome) return acc;
          acc[nome] = acc[nome] || { anuncio: nome, leads: 0, FORMS: 0, LP: 0 };
          acc[nome].leads++;
          acc[nome][l.fonte]++;
          return acc;
        }, {})
      ).map(([, v]) => v).sort((a, b) => b.leads - a.leads).slice(0, 25),
      por_dia: Object.values(porDiaMap).sort((a, b) => a.data.localeCompare(b.data)),
      qualificacao: {
        cargo:         countBy(noPeriodo, l => labelCargo(l.cargo)),
        colaboradores: countBy(noPeriodo, l => labelColaboradores(l.colaboradores)),
        plataforma:    countBy(noPeriodo, l => l.plataforma),
      },
      // Cobertura sobre a planilha inteira, para o dashboard avisar quando o
      // sync parou — sem isso um período vazio parece "zero lead" e não "sem dado".
      cobertura: {
        FORMS: coverage(todos.filter(l => l.fonte === TAB_FORMS)),
        LP:    coverage(todos.filter(l => l.fonte === TAB_LP)),
      },
      // Por qual caminho cada planilha foi lida. "csv-publico" na LP significa
      // que ela ainda depende de estar aberta a quem tem o link — o que expõe
      // nome, e-mail e telefone dos leads. Sem isto aqui, a única forma de
      // saber era abrir o log do Vercel.
      fontes: {
        FORMS: tabsCentral[0]?.modo || 'sem aba',
        LP:    tabsLP[0]?.modo      || 'sem aba',
      },
      gerado_em: new Date().toISOString(),
    };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // /api/leads-unificados chega aqui por rewrite (limite de 12 funções do plano).
  const url = new URL(req.url, 'http://localhost');
  if (url.searchParams.get('modo') === 'unificados' || url.pathname.includes('leads-unificados')) {
    return responderUnificados(req, res);
  }

  const params = new URL(req.url, 'http://localhost').searchParams;
  const since = params.get('since');
  const until = params.get('until');

  if (!DATE_RE.test(since || '') || !DATE_RE.test(until || '')) {
    return res.status(400).json({ error: 'Informe since e until no formato YYYY-MM-DD' });
  }

  try {
    return res.status(200).json(await montarLeads(since, until));
  } catch (err) {
    console.error('[api/sheet-leads]', err.message);
    return res.status(502).json({
      error: err.message,
      // Abra estas URLs no navegador: se baixarem o CSV, o problema é só de
      // acesso sem login; se derem 404, o id ou o gid está errado.
      ...(err.tentativas ? { urls_tentadas: err.tentativas } : {}),
    });
  }
};

module.exports.montarLeads = montarLeads;
