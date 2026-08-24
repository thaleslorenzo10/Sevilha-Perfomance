#!/usr/bin/env node
'use strict';

/**
 * Confere as duas peças novas do fluxo da /mentoria sem tocar em rede real:
 *
 *   • lib/sheets-write.js  — filtro de página, formato da linha e leitura do id
 *   • api/sessao-estrategica.js — agregação dos leads do Supabase
 *
 * Rode com: node scripts/test-sessao-estrategica.js
 */

const assert = require('assert');

const { COLUNAS, linhaDe, paginasQueGravam, extrairId } = require('../lib/sheets-write');
const { TABELAS } = require('../lib/supabase');

/* ── sheets-write ──────────────────────────────────────────────────── */

const lead = {
  pagina: '/mentoria', nome: 'Fulano', email: 'f@x.com', telefone: '(31) 98888-7777',
  escritorio: 'Contabilidade X', cargo: 'Dono/Sócio', colaboradores: 'De 20 a 29',
  utm_source: 'facebook', event_id: 'ev_1',
};

const linha = linhaDe(lead);
assert.strictEqual(linha.length, COLUNAS.length, 'linha e cabeçalho precisam ter o mesmo número de colunas');
assert.strictEqual(linha[COLUNAS.indexOf('telefone')], '(31) 98888-7777', 'telefone vai como texto, sem reformatar');
assert.strictEqual(linha[COLUNAS.indexOf('pagina')], '/mentoria');

assert.deepStrictEqual(paginasQueGravam(), ['/mentoria', '/mentoria-2'],
  'as duas páginas da oferta gravam na planilha');
process.env.LEADS_SHEET_WRITE_PAGES = '/mentoria, /outra';
assert.deepStrictEqual(paginasQueGravam(), ['/mentoria', '/outra'], 'a lista aceita mais de uma página');
delete process.env.LEADS_SHEET_WRITE_PAGES;

assert.strictEqual(
  extrairId('https://docs.google.com/spreadsheets/d/1AbC-dEf_123/edit#gid=0'),
  '1AbC-dEf_123',
  'aceita URL completa da planilha'
);
assert.strictEqual(extrairId('1AbC-dEf_123'), '1AbC-dEf_123', 'aceita o id cru');

/* ── api/sessao-estrategica ────────────────────────────────────────── */

const LEADS = [
  { created_at: '2026-08-20T10:00:00Z', pagina: '/mentoria',   cargo: 'Dono/Sócio',      colaboradores: 'De 20 a 29', utm_source: 'facebook', utm_campaign: 'c1' },
  { created_at: '2026-08-20T14:00:00Z', pagina: '/mentoria-2', cargo: 'Dono/Sócio',      colaboradores: 'De 10 a 19', utm_source: 'facebook', utm_campaign: 'c1' },
  { created_at: '2026-08-21T09:00:00Z', pagina: '/mentoria-2', cargo: 'Cargo Gerencial', colaboradores: 'De 5 a 9',   utm_source: 'google',   utm_campaign: 'c2' },
  { created_at: '2026-08-21T11:00:00Z', pagina: '/mentoria',   cargo: '',                colaboradores: '',           utm_source: '',         utm_campaign: '' },
];

process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave-de-teste';

const chamadas = [];
global.fetch = async (url) => {
  chamadas.push(url);
  const corpo = url.includes(TABELAS.pageViews) ? [] : LEADS;
  return { ok: true, status: 200, json: async () => corpo, text: async () => JSON.stringify(corpo) };
};

// Servido por /api/stats?modo=sessao-estrategica; o teste chama a lib direto.
const { responder: handler } = require('../lib/sessao-estrategica');

function resFalso() {
  const r = { statusCode: null, corpo: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}

(async () => {
  const res = resFalso();
  await handler({ method: 'GET', url: '/api/sessao-estrategica?since=2026-08-20&until=2026-08-21' }, res);

  assert.strictEqual(res.statusCode, 200, 'responde 200 com Supabase configurado');
  const d = res.corpo;

  assert.strictEqual(d.total, 4);
  assert.strictEqual(d.porte.maior, 2, 'De 20 a 29 e De 10 a 19 contam como 10+');
  assert.strictEqual(d.porte.menor, 1, 'De 5 a 9 conta como menos de 10');
  assert.strictEqual(d.porte.indefinido, 1, 'sem resposta fica indefinido');

  assert.deepStrictEqual(d.por_dia, [
    { dia: '2026-08-20', total: 2 },
    { dia: '2026-08-21', total: 2 },
  ]);

  assert.strictEqual(d.por_fonte[0].chave, 'facebook', 'ranking sai do maior para o menor');
  assert.strictEqual(d.por_fonte[0].total, 2);
  assert.ok(d.por_fonte.some(f => f.chave === '(não informado)'), 'lead sem utm aparece rotulado');

  assert.ok(d.nota_visitas, 'sem pageviews, o payload avisa por quê');

  const urlLeads = chamadas.find(u => u.includes(TABELAS.leads));
  assert.ok(urlLeads.includes('pagina=in.'), 'filtra pelas páginas da oferta');
  assert.ok(decodeURIComponent(urlLeads).includes('"/mentoria","/mentoria-2"'), 'as duas variantes entram no filtro');

  // O A/B precisa do recorte por página, senão não há como comparar layouts.
  assert.strictEqual(d.por_pagina['/mentoria'].leads, 2);
  assert.strictEqual(d.por_pagina['/mentoria-2'].leads, 2);
  assert.ok(urlLeads.includes('created_at=gte.2026-08-20T00:00:00'), 'aplica a data inicial');
  assert.ok(urlLeads.includes('created_at=lte.2026-08-21T23:59:59'), 'aplica a data final');

  // Data inválida não pode virar filtro solto na query do Supabase.
  const res2 = resFalso();
  await handler({ method: 'GET', url: '/api/sessao-estrategica?since=ontem' }, res2);
  assert.strictEqual(res2.statusCode, 400, 'recusa data fora do formato');

  console.log('✓ sheets-write e /api/sessao-estrategica passaram');
})();
