'use strict';

/**
 * Lê as fontes de lead e entrega o payload unificado (regra em
 * lib/leads-unificados.js). Servido como GET /api/leads-unificados — rewrite
 * para api/sheet-leads.js?modo=unificados, porque o plano Hobby limita o deploy
 * a 12 funções e elas já existem.
 *
 * Uma fonte que falha não derruba a resposta: vira `fontes[].erro`, e o painel
 * mostra. Só quando TODAS falham o endpoint responde 502.
 */

const { readAllTabs, readLPTabs } = require('./sheets');
const { TABELAS, rest, lerTudo } = require('./supabase');
const { extractForms, findLPHeaders, extractLP } = require('./planilha-leads');
const { unificar } = require('./leads-unificados');
const { inicioDoDia, fimDoDia, deslocarDias } = require('./fuso');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SELECT = 'id,created_at,pagina,email,telefone,utm_source,utm_medium,utm_campaign,utm_content,colaboradores,cargo';

async function lerForms() {
  const tabs = await readAllTabs();
  return { modo: tabs[0]?.modo || 'sem aba', registros: tabs.flatMap(t => extractForms(t.rows)) };
}
async function lerRespondi() {
  const tabs = await readLPTabs();
  return { modo: tabs[0]?.modo || 'sem aba',
           registros: tabs.flatMap(t => findLPHeaders(t.rows).flatMap(h => extractLP(t.rows, h))) };
}
async function lerSupabase(since, until) {
  // Lookback de 180 dias: um contato que converteu no site antes do período
  // pesquisado não teria como ser reconhecido se reaparecer dentro dele —
  // `unificar` já corta o resultado de volta para [since, until].
  const desde = deslocarDias(since, -180);
  const url = rest(TABELAS.leads,
    `select=${SELECT}&created_at=gte.${inicioDoDia(desde)}&created_at=lte.${fimDoDia(until)}&order=created_at.asc`);
  if (!url) throw new Error('Supabase não configurado');
  return { modo: 'postgrest', registros: await lerTudo(url) };
}

const tolerante = p => p.then(r => ({ ...r, erro: null }), e => ({ modo: null, registros: [], erro: e.message }));

async function montarUnificados(since, until) {
  const [forms, respondi, supabase] = await Promise.all([
    tolerante(lerForms()), tolerante(lerRespondi()), tolerante(lerSupabase(since, until)),
  ]);
  if (forms.erro && respondi.erro && supabase.erro) {
    throw new Error(`todas as fontes falharam — FORMS: ${forms.erro}; Respondi: ${respondi.erro}; Supabase: ${supabase.erro}`);
  }
  const payload = unificar(
    { forms: forms.registros, respondi: respondi.registros, supabase: supabase.registros }, since, until);
  const info = { FORMS: forms, RESPONDI: respondi, SUPABASE: supabase, CAFE: supabase };
  payload.fontes = payload.fontes.map(f => ({ ...f, modo: info[f.nome].modo, erro: info[f.nome].erro }));
  payload.gerado_em = new Date().toISOString();
  return payload;
}

async function responderUnificados(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  const params = new URL(req.url, 'http://localhost').searchParams;
  const since = params.get('since');
  const until = params.get('until');
  if (!DATE_RE.test(since || '') || !DATE_RE.test(until || '') || since > until) {
    return res.status(400).json({ error: 'Informe since e until no formato YYYY-MM-DD, com since <= until' });
  }
  try {
    return res.status(200).json(await montarUnificados(since, until));
  } catch (err) {
    console.error('[leads-unificados]', err.message);
    return res.status(502).json({ error: err.message });
  }
}

module.exports = { montarUnificados, responderUnificados };
