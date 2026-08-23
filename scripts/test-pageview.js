#!/usr/bin/env node
'use strict';

/**
 * Confere o beacon de visita e o redirect do A/B sem rede real:
 *
 *   • /api/pageview grava só as páginas da lista, ignora bot e trunca o IP
 *   • /api/ab continua registrando a variante depois de passar a usar o helper
 *   • lib/supabase aponta para as tabelas reais, não para as views depreciadas
 *
 * Rode com: node scripts/test-pageview.js
 */

const assert = require('assert');

process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave-de-teste';

const { TABELAS } = require('../lib/supabase');
const { truncarIp, ehBot } = require('../lib/pageviews');

/* ── Nomes de tabela ───────────────────────────────────────────────── */

assert.strictEqual(TABELAS.leads, 'sevilha_leads');
assert.strictEqual(TABELAS.pageViews, 'sevilha_page_views');
assert.ok(!Object.values(TABELAS).some(t => t.includes('perfomance')),
  'nenhuma tabela pode apontar para as views depreciadas');

/* ── Helpers ───────────────────────────────────────────────────────── */

assert.strictEqual(truncarIp('187.45.200.31'), '187.45.200.0', 'IPv4 perde o último octeto');
assert.strictEqual(truncarIp('2804:14d:1::5'), '2804:14d:1::5', 'IPv6 fica intacto');
assert.strictEqual(truncarIp(''), null);
assert.ok(ehBot('Mozilla/5.0 (compatible; Googlebot/2.1)'));
assert.ok(!ehBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'));

/* ── Requisições capturadas ────────────────────────────────────────── */

const gravadas = [];
global.fetch = async (url, opts) => {
  gravadas.push({ url, corpo: JSON.parse(opts.body) });
  return { ok: true, status: 201, text: async () => '' };
};

function resFalso() {
  const r = { statusCode: null, corpo: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}

const UA_REAL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
const pageview = require('../api/pageview');
const ab = require('../api/ab');

(async () => {
  /* Página da lista, visitante real ── grava */
  let res = resFalso();
  await pageview({
    method: 'POST',
    headers: { 'user-agent': UA_REAL, 'x-forwarded-for': '187.45.200.31, 10.0.0.1' },
    socket: {},
    body: { pagina: '/mentoria', query: 'utm_source=facebook&utm_campaign=se-agosto&fbclid=abc' },
  }, res);

  assert.strictEqual(res.statusCode, 201, 'visita registrada devolve 201');
  assert.strictEqual(gravadas.length, 1);
  assert.ok(gravadas[0].url.endsWith(`/rest/v1/${TABELAS.pageViews}`), 'grava na tabela nova');

  const linha = gravadas[0].corpo;
  assert.strictEqual(linha.pagina, '/mentoria');
  assert.strictEqual(linha.variant, null, 'página fora do rodízio não inventa variante');
  assert.strictEqual(linha.utm_source, 'facebook');
  assert.strictEqual(linha.utm_campaign, 'se-agosto');
  assert.strictEqual(linha.fbclid, 'abc');
  assert.strictEqual(linha.utm_medium, null, 'parâmetro ausente vira null, não string vazia');
  assert.strictEqual(linha.ip, '187.45.200.0', 'grava só o primeiro IP da cadeia, truncado');

  /* Bot ── não grava */
  res = resFalso();
  await pageview({
    method: 'POST',
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    socket: {},
    body: { pagina: '/mentoria', query: '' },
  }, res);
  assert.strictEqual(res.statusCode, 204, 'bot sai sem erro');
  assert.strictEqual(gravadas.length, 1, 'bot não vira linha');

  /* Página fora da lista ── recusa, senão a visita seria contada duas vezes */
  res = resFalso();
  await pageview({
    method: 'POST', headers: { 'user-agent': UA_REAL }, socket: {},
    body: { pagina: '/pre-inscricao-3', query: '' },
  }, res);
  assert.strictEqual(res.statusCode, 400, 'página do rodízio A/B não usa beacon');
  assert.strictEqual(gravadas.length, 1);

  /* A/B continua gravando a variante depois do refactor */
  res = resFalso();
  await ab({
    method: 'GET',
    url: '/campanha?utm_source=facebook',
    headers: { 'user-agent': UA_REAL, cookie: '_sp_variant=1' },
    socket: {},
  }, res);

  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.headers.Location, '/pre-inscricao-2?utm_source=facebook',
    'cookie sticky mantém a variante e a query string');
  assert.strictEqual(gravadas.length, 2, 'o redirect também registra visita');
  assert.strictEqual(gravadas[1].corpo.variant, 1);
  assert.strictEqual(gravadas[1].corpo.pagina, '/pre-inscricao-2');
  assert.ok(gravadas[1].url.endsWith(`/rest/v1/${TABELAS.pageViews}`));

  console.log('✓ beacon, A/B e nomes de tabela passaram');
})();
