'use strict';

/**
 * Uma regra só para "o que é um lead" — a mesma para as quatro fontes:
 * export do Meta (FORMS), formulário do Respondi (LP antiga), Supabase (páginas
 * deste site) e Café com Sevilha (webhook do RD Marketing, gravado no Supabase
 * com pagina "rd:<identificador>"). Aqui não há rede: recebe registros brutos e
 * devolve agregados. Quem lê as fontes é lib/leads-fontes.js.
 */

const { norm } = require('./texto');
const { classificarPorte, ehQualificado, PORTE_MAIOR, PORTE_MENOR, PORTE_INDEF } = require('./porte');
const { classifyCampaign } = require('./meta');
const { chaveDoMacro } = require('./posicionamento');
const { diaDe, cadaDia, FUSO } = require('./fuso');
const { labelCargo, labelColaboradores } = require('./planilha-leads');

const FONTES = ['FORMS', 'RESPONDI', 'SUPABASE', 'CAFE'];
const SEM_ETIQUETA = 'Sem etiqueta';
const ETIQUETA_QUEBRADA = 'Etiqueta quebrada';
// Página do site diz a oferta quando a UTM não diz.
const GRUPO_POR_PAGINA = {
  '/mentoria': 'SE', '/mentoria-2': 'SE',
  '/': 'CP', '/pre-inscricao-2': 'CP', '/pre-inscricao-3': 'CP',
  '/aula-gestao-operacional': 'AULA',
};

/** Macro gravada literal ({{campaign.name}}, __CID_NAME__) é etiqueta quebrada, não origem nova. */
function etiqueta(valor) {
  const s = String(valor || '').trim();
  if (!s) return SEM_ETIQUETA;
  if (s.includes('{{') || s.includes('__')) return ETIQUETA_QUEBRADA;
  return s;
}

function normalizarEmail(e) { return norm(e).replace(/\s+/g, ''); }
/** Só dígitos; os 11 finais ignoram +55 e zero de operadora. */
function normalizarTelefone(t) {
  const d = String(t || '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-11) : '';
}
// Mantida exportada pelo contrato de interface do brief; não é mais usada
// internamente — o dedupe usa chavesContato (as duas chaves) logo abaixo.
function chaveContato(l) {
  const e = normalizarEmail(l.email);
  if (e.includes('@')) return `e:${e}`;
  const t = normalizarTelefone(l.telefone);
  return t ? `t:${t}` : null;
}
/**
 * Todas as chaves de contato do lead (e-mail E telefone, quando os dois
 * existem) — ao contrário de chaveContato, que devolve só uma. Precisa das
 * duas para pegar o caso do lead 10/11 do teste: o registro 10 tem e-mail e
 * telefone, o 11 só o telefone; se o dedupe olhasse só a chave de e-mail do
 * 10, o telefone repetido do 11 passaria como lead novo.
 */
function chavesContato(l) {
  const chaves = [];
  const e = normalizarEmail(l.email);
  if (e.includes('@')) chaves.push(`e:${e}`);
  const t = normalizarTelefone(l.telefone);
  if (t) chaves.push(`t:${t}`);
  return chaves;
}

function grupoDe(lead) {
  const { grupo } = classifyCampaign(lead.campanha);
  if (grupo !== 'OUTROS') return grupo;
  if (lead.fonte === 'CAFE') return 'CAFE';
  return GRUPO_POR_PAGINA[lead.pagina] || 'OUTROS';
}

/** Registro bruto de qualquer fonte → lead com as mesmas chaves. */
function normalizar(bruto, fonte) {
  const pos = etiqueta(bruto.posicionamento);
  const lead = {
    fonte,
    id: bruto.id ?? null,
    dia: bruto.dia,
    email: bruto.email || '',
    telefone: bruto.telefone || '',
    campanha: etiqueta(bruto.campanha),
    conjunto: etiqueta(bruto.conjunto),
    anuncio: etiqueta(bruto.anuncio),
    posicionamento: (pos === SEM_ETIQUETA || pos === ETIQUETA_QUEBRADA) ? pos : chaveDoMacro(pos),
    pagina: bruto.pagina || null,
    colaboradores: bruto.colaboradores || '',
    cargo: bruto.cargo || '',
  };
  lead.grupo = grupoDe(lead);
  lead.formato = fonte === 'FORMS' ? 'FORMS' : 'LP';
  lead.mql = ehQualificado(lead.colaboradores);
  return lead;
}

const dePlanilha = r => ({
  id: r.id, dia: r.data, email: r.email, telefone: r.telefone, campanha: r.campanha,
  conjunto: r.adset, anuncio: r.anuncio, posicionamento: r.plataforma,
  colaboradores: r.colaboradores, cargo: r.cargo,
});
const deSupabase = r => ({
  id: r.id, dia: diaDe(r.created_at), email: r.email, telefone: r.telefone,
  campanha: r.utm_campaign, conjunto: r.utm_medium, anuncio: r.utm_content,
  posicionamento: r.utm_source, pagina: r.pagina, colaboradores: r.colaboradores, cargo: r.cargo,
});
const fonteSupabase = r => (String(r.pagina || '').startsWith('rd:') ? 'CAFE' : 'SUPABASE');

const par = () => ({ leads: 0, mql: 0 });
function somar(acc, l) { acc.leads++; if (l.mql) acc.mql++; return acc; }

/** Agrupa por chave, devolve lista ordenada por leads, com colunas extras da primeira ocorrência. */
function agrupar(itens, chaveFn, campo, extras = () => ({})) {
  const mapa = new Map();
  for (const l of itens) {
    const k = chaveFn(l);
    if (!mapa.has(k)) mapa.set(k, { [campo]: k, ...extras(l), ...par() });
    somar(mapa.get(k), l);
  }
  return [...mapa.values()].sort((a, b) => b.leads - a.leads || b.mql - a.mql);
}

function contarPor(itens, fn) {
  const m = {};
  for (const l of itens) { const k = fn(l); if (k) m[k] = (m[k] || 0) + 1; }
  return m;
}

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 864e5);
}

/** Agregado das compras da aula no período, no fuso do painel. Cruzamento com
 * sessão vem pelos `deals` do RD, não da lista de leads. */
function agregarCompras({ compras, deals, since, until }) {
  const pagas = compras.filter(c => c.status === 'paid').map(c => ({ ...c, dia: diaDe(c.pago_em) }))
    .filter(c => c.dia >= since && c.dia <= until);
  const soma = (lista, chave) => {
    const m = new Map();
    for (const c of lista) { const k = c[chave] || '(sem etiqueta)'; const a = m.get(k) || { [chave]: k, compras: 0, receita_centavos: 0 }; a.compras += 1; a.receita_centavos += c.valor_centavos; m.set(k, a); }
    return [...m.values()].sort((a, b) => b.compras - a.compras);
  };
  const chavesDeal = new Map();
  for (const d of deals || []) if (/^\[SE\]/.test(d.nome || '')) for (const k of chavesContato(d)) chavesDeal.set(k, d.criado_em);
  const comSessao = pagas.filter(c => chavesContato(c).some(k => chavesDeal.has(k) && chavesDeal.get(k) > c.pago_em)).length;
  return {
    total: pagas.length,
    receita_centavos: pagas.reduce((s, c) => s + c.valor_centavos, 0),
    por_dia: cadaDia(since, until).map(dia => ({ dia, compras: pagas.filter(c => c.dia === dia).length, receita_centavos: pagas.filter(c => c.dia === dia).reduce((s, c) => s + c.valor_centavos, 0) })),
    por_campanha: soma(pagas.map(c => ({ ...c, campanha: c.utm_campaign })), 'campanha'),
    por_conjunto: soma(pagas.map(c => ({ ...c, conjunto: c.utm_medium })), 'conjunto'),
    por_anuncio:  soma(pagas.map(c => ({ ...c, anuncio: c.utm_content })), 'anuncio'),
    compradores_com_sessao: comSessao,
  };
}

function unificar({ forms = [], respondi = [], supabase = [], compras = [], deals = [] }, since, until) {
  const todos = [
    ...forms.map(r => normalizar(dePlanilha(r), 'FORMS')),
    ...respondi.map(r => normalizar(dePlanilha(r), 'RESPONDI')),
    ...supabase.map(r => normalizar(deSupabase(r), fonteSupabase(r))),
  ].filter(l => l.dia).sort((a, b) => a.dia.localeCompare(b.dia));

  // Dedupe sobre tudo o que foi lido, antes do recorte: quem reenvia o
  // formulário dentro do período mas já era lead antes não vira lead novo.
  // Sem contato, o id da fonte segura repetição dentro da própria fonte.
  const vistos = new Set();
  const unicos = todos.filter(l => {
    const chaves = chavesContato(l);
    if (!chaves.length) {
      const chave = l.id !== null ? `${l.fonte}|${l.id}` : null;
      if (!chave) return true;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    }
    if (chaves.some(k => vistos.has(k))) return false;
    for (const k of chaves) vistos.add(k);
    return true;
  });
  const noPeriodo = unicos.filter(l => l.dia >= since && l.dia <= until);

  const porDia = cadaDia(since, until).map(dia => {
    const doDia = noPeriodo.filter(l => l.dia === dia);
    const fontes = Object.fromEntries(FONTES.map(f => [f, doDia.filter(l => l.fonte === f).length]));
    return { dia, ...doDia.reduce(somar, par()), fontes };
  });

  const porGrupo = Object.fromEntries(['SE', 'CAFE', 'CP', 'AULA', 'OUTROS'].map(g =>
    [g, noPeriodo.filter(l => l.grupo === g).reduce(somar, par())]));
  const porFormato = Object.fromEntries(['FORMS', 'LP'].map(f =>
    [f, noPeriodo.filter(l => l.formato === f).reduce(somar, par())]));

  const fontes = FONTES.map(nome => {
    const todasDaFonte = unicos.filter(l => l.fonte === nome);
    const ultimo = todasDaFonte.length ? todasDaFonte[todasDaFonte.length - 1].dia : null;
    return {
      nome,
      total_no_periodo: noPeriodo.filter(l => l.fonte === nome).length,
      ultimo_lead: ultimo,
      dias_sem_lead: ultimo ? Math.max(0, diasEntre(ultimo, until)) : null,
    };
  });

  return {
    periodo: { since, until, fuso: FUSO },
    total: noPeriodo.reduce(somar, par()),
    por_dia: porDia,
    por_grupo: porGrupo,
    por_formato: porFormato,
    compras: compras.length ? agregarCompras({ compras, deals, since, until }) : null,
    por_campanha: agrupar(noPeriodo, l => l.campanha, 'campanha', l => ({ grupo: l.grupo, formato: l.formato })),
    por_conjunto: agrupar(noPeriodo, l => l.conjunto, 'conjunto', l => ({ campanha: l.campanha })),
    por_anuncio:  agrupar(noPeriodo, l => l.anuncio, 'anuncio', l => ({ conjunto: l.conjunto, campanha: l.campanha })),
    por_fonte:    agrupar(noPeriodo, l => l.posicionamento, 'fonte'),
    por_pagina:   agrupar(noPeriodo.filter(l => l.pagina), l => l.pagina, 'pagina'),
    porte: {
      MAIOR_10:   noPeriodo.filter(l => classificarPorte(l.colaboradores) === PORTE_MAIOR).length,
      MENOR_10:   noPeriodo.filter(l => classificarPorte(l.colaboradores) === PORTE_MENOR).length,
      INDEFINIDO: noPeriodo.filter(l => classificarPorte(l.colaboradores) === PORTE_INDEF).length,
    },
    // Meta grava a faixa por extenso ("De 10 a 19"), o site em slug
    // ("de_10_a_19"); sem desfazer o slug antes, viram duas linhas do mesmo
    // grupo no dashboard.
    qualificacao: {
      cargo:         contarPor(noPeriodo, l => labelCargo(String(l.cargo || '').replace(/_/g, ' '))),
      colaboradores: contarPor(noPeriodo, l => labelColaboradores(String(l.colaboradores || '').replace(/_/g, ' '))),
    },
    fontes,
  };
}

module.exports = {
  unificar, normalizar, chaveContato, chavesContato, etiqueta, FONTES, SEM_ETIQUETA, ETIQUETA_QUEBRADA,
  GRUPO_POR_PAGINA, agregarCompras,
};
