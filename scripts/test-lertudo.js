'use strict';
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';

const { lerTudo } = require('../lib/supabase');

const linha = i => ({ id: i });
const respostaSemHeader = lote => ({
  ok: true, status: 206, headers: { get: () => null }, json: async () => lote, text: async () => '',
});
const respostaComTotal = (lote, ini, fim, total) => ({
  ok: true, status: 206, headers: { get: name => (name === 'content-range' ? `${ini}-${fim}/${total}` : null) },
  json: async () => lote, text: async () => '',
});

async function cenario1() {
  // max-rows do servidor = 500, total = 1200: cada página entrega no máximo
  // 500 linhas, mesmo pedindo range de 1000.
  const pedidos = [];
  global.fetch = async (url, opts) => {
    pedidos.push(opts.headers.Range);
    const ini = Number(opts.headers.Range.split('-')[0]);
    const fim = Math.min(ini + 499, 1199);
    const lote = Array.from({ length: fim - ini + 1 }, (_, k) => linha(ini + k));
    return respostaComTotal(lote, ini, fim, 1200);
  };
  const r = await lerTudo('https://x/rest/v1/t');
  assert.equal(r.length, 1200, 'cenário 1: total de linhas');
  assert.deepEqual(pedidos, ['0-999', '500-1499', '1000-1999'], 'cenário 1: sequência de Range');
  console.log('✓ cenário 1: max-rows abaixo de PAG, com Content-Range');
}

async function cenario2() {
  // Sem Content-Range: página cheia de 1000, depois 1 linha só.
  const pedidos = [];
  global.fetch = async (url, opts) => {
    pedidos.push(opts.headers.Range);
    const ini = Number(opts.headers.Range.split('-')[0]);
    const lote = ini === 0 ? Array.from({ length: 1000 }, (_, k) => linha(k)) : [linha(1000)];
    return respostaSemHeader(lote);
  };
  const r = await lerTudo('https://x/rest/v1/t');
  assert.equal(r.length, 1001, 'cenário 2: total de linhas');
  assert.equal(pedidos.length, 2, 'cenário 2: número de requisições');
  console.log('✓ cenário 2: sem Content-Range, páginas de 1000 então 1');
}

async function cenario3() {
  // Sem header, primeira página já vazia.
  const pedidos = [];
  global.fetch = async (url, opts) => {
    pedidos.push(opts.headers.Range);
    return respostaSemHeader([]);
  };
  const r = await lerTudo('https://x/rest/v1/t');
  assert.equal(r.length, 0, 'cenário 3: total de linhas');
  assert.equal(pedidos.length, 1, 'cenário 3: número de requisições');
  console.log('✓ cenário 3: primeira página vazia');
}

async function cenario4() {
  // Primeira página cheia (1000), segunda dá 416 (pedimos além do fim).
  let chamada = 0;
  global.fetch = async () => {
    chamada += 1;
    if (chamada === 1) return respostaSemHeader(Array.from({ length: 1000 }, (_, k) => linha(k)));
    return { ok: false, status: 416, headers: { get: () => null }, json: async () => [], text: async () => '' };
  };
  const r = await lerTudo('https://x/rest/v1/t');
  assert.equal(r.length, 1000, 'cenário 4: total de linhas');
  assert.equal(chamada, 2, 'cenário 4: número de requisições');
  console.log('✓ cenário 4: 416 na segunda página não lança erro');
}

async function cenario5() {
  global.fetch = async () => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => [], text: async () => 'erro interno' });
  await assert.rejects(() => lerTudo('https://x/rest/v1/t'), /^Error: Supabase 500: erro interno$/, 'cenário 5: deve lançar com status e corpo');
  console.log('✓ cenário 5: status 500 lança erro');
}

(async () => {
  await cenario1();
  await cenario2();
  await cenario3();
  await cenario4();
  await cenario5();
  console.log('✓ test-lertudo');
})();
