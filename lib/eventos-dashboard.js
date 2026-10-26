'use strict';

const { montarUnificados } = require('./leads-fontes');
const { unificar } = require('./leads-unificados');
const { lerCompras, agregarCompras } = require('./eventos-dashboard-compras');

// A edição é delimitada em Brasília. O recorte precede o dedupe para uma
// reinscrição nesta edição não desaparecer por ter participado da anterior.
const EVENTOS = [
  { id: 'aula-2026-10-27', nome: 'Aula de Gestão Operacional', grupo: 'AULA', data: '2026-10-27', inicio: '2026-10-14' },
  { id: 'cafe-2026-11-11', nome: 'Café com Sevilha', grupo: 'CAFE', data: '2026-11-11', inicio: '2026-10-14' },
  { id: 'aula-2026-10-06', nome: 'Aula de Gestão Operacional', grupo: 'AULA', data: '2026-10-06', inicio: '2026-09-17' },
];

function dataValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || '') || valor < '2020-01-01' || valor > '2100-12-31') return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

function validarPeriodo(since, until) {
  if (!dataValida(since) || !dataValida(until) || since > until) {
    throw new Error('Informe since e until válidos no formato YYYY-MM-DD, entre 2020 e 2100, com since <= until');
  }
}

async function montarEvento(evento, filtro, fontes) {
  const since = filtro.since > evento.inicio ? filtro.since : evento.inicio;
  const until = filtro.until < evento.data ? filtro.until : evento.data;
  const { grupo, ...dados } = evento;
  const resultado = { ...dados, periodo: since <= until ? { since, until } : null, leads: null, compras: null, erros: [] };
  if (since > until) {
    resultado.leads = unificar({}, since, until);
    if (grupo === 'AULA') resultado.compras = agregarCompras([], since, until);
    return resultado;
  }
  const opcoes = { grupo, inicioEdicao: evento.inicio, fimEdicao: evento.data, cacheFontes: filtro.cacheFontes };
  const [leads, compras] = await Promise.allSettled([
    fontes.leads(since, until, opcoes), grupo === 'AULA' ? fontes.compras(since, until) : Promise.resolve(null),
  ]);
  if (leads.status === 'fulfilled') {
    const falhas = leads.value.fontes.filter(f => f.erro);
    if (falhas.length) resultado.erros.push(...falhas.map(f => `Leads ${f.nome}: fonte indisponível`));
    else resultado.leads = leads.value;
  } else resultado.erros.push('Leads: fontes indisponíveis');
  if (compras.status === 'fulfilled') resultado.compras = compras.value;
  else resultado.erros.push('Compras: fonte indisponível');
  return resultado;
}

async function montarEventos(since, until, fontes = { leads: montarUnificados, compras: lerCompras }) {
  validarPeriodo(since, until);
  const cacheFontes = new Map();
  const eventos = await Promise.all(EVENTOS.map(e => montarEvento(e, { since, until, cacheFontes }, fontes)));
  return { eventos, gerado_em: new Date().toISOString() };
}

async function responder(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const since = params.get('since'), until = params.get('until');
  try { validarPeriodo(since, until); }
  catch (err) { return res.status(400).json({ error: err.message }); }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(await montarEventos(since, until));
}

module.exports = { EVENTOS, dataValida, validarPeriodo, montarEventos, responder };
