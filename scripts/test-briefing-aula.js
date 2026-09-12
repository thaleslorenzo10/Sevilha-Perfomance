'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const handler = require('../api/briefing-aula');
const { validar } = require('../lib/briefing-aula');

const payload = { id: '54a62bd1-63c2-4125-a38e-7fa4fed1a980', website: '', answers: {
  publico: 'Empresários', problema: 'Gestão', resultado: 'Plano', tema: 'Finanças',
  conteudo: 'Diagnóstico e prática', professor: 'Bruno',
} };
const headers = { host: 'briefing.example', origin: 'https://briefing.example', 'content-type': 'application/json' };

async function chamar(body = payload, extra = {}) {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({ method: 'POST', headers, body, ...extra }, res);
  return res;
}

function resposta(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function validarEntradas() {
  for (const body of [null, [], '{', { ...payload, extra: true }, { ...payload, website: 'spam' },
    { ...payload, id: 'bad' }, { ...payload, answers: [] }]) {
    assert.equal((await chamar(body)).code, 400);
  }
  for (const valor of [null, 2, [], ' ', 'a'.repeat(3001)]) {
    assert.equal((await chamar({ ...payload, answers: { ...payload.answers, publico: valor } })).code, 422);
  }
  assert.equal((await chamar(payload, { method: 'GET' })).code, 405);
  assert.equal((await chamar(payload, { headers: { ...headers, origin: 'https://evil.example' } })).code, 400);
  assert.equal((await chamar(payload, { headers: { ...headers, 'content-type': 'text/plain' } })).code, 400);
  assert.equal((await chamar(' '.repeat(57345))).code, 413);
  assert.equal((await chamar(payload, { headers: { ...headers, 'content-length': '57345' } })).code, 413);
}

async function validarPersistencia() {
  const registro = validar(payload);
  const row = { ...registro, created_at: '2026-09-12T12:00:00.000Z' };
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return resposta(201, [row]);
  };
  const salvo = await chamar();
  assert.equal(salvo.code, 200);
  assert.deepEqual(salvo.body, { ok: true, id: row.id, created_at: row.created_at });
  assert.equal(calls[0].url, 'https://database.example/rest/v1/sevilha_briefings_aula');
  assert.equal(calls[0].options.headers.Prefer, 'return=representation');
  assert.equal(JSON.parse(calls[0].options.body).payload_hash, row.payload_hash);
  assert.ok(calls[0].options.signal instanceof AbortSignal);

  global.fetch = async (_url, options) => options.method === 'POST'
    ? resposta(409, { code: '23505' }) : resposta(200, [row]);
  assert.deepEqual((await chamar()).body, salvo.body);
  const alterado = { ...payload, answers: { ...payload.answers, publico: 'Outro público' } };
  assert.equal((await chamar(alterado)).code, 409);
  const invertido = { ...payload, answers: Object.fromEntries(Object.entries(payload.answers).reverse()) };
  assert.equal((await chamar(invertido)).code, 200);
}

async function validarFalhas() {
  for (const response of [resposta(201, []), resposta(403, { secret: 'oculto' }),
    resposta(200, [{ id: payload.id, created_at: 'inválida' }])]) {
    global.fetch = async () => response;
    assert.equal((await chamar()).code, 503);
  }
  global.fetch = async () => { throw new Error('segredo: valor'); };
  const falhou = await chamar();
  assert.equal(falhou.code, 503);
  assert.ok(!JSON.stringify(falhou.body).includes('segredo'));
  delete process.env.SUPABASE_SERVICE_KEY;
  assert.equal((await chamar()).code, 503);
  const sql = readFileSync(require.resolve('../sql/briefing-aula.sql'), 'utf8');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all .* from public, anon, authenticated/);
  assert.match(sql, /grant select, insert .* to service_role/);
}

async function main() {
  const originalFetch = global.fetch;
  const originalEnv = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY };
  process.env.SUPABASE_URL = 'https://database.example';
  process.env.SUPABASE_SERVICE_KEY = 'test-only';
  try {
    global.fetch = async () => { assert.fail('Entrada inválida tentou acessar o banco'); };
    await validarEntradas();
    await validarPersistencia();
    await validarFalhas();
    process.stdout.write('Briefing: validação, persistência, retry, conflito, falhas e RLS OK (mocks).\n');
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of [['SUPABASE_URL', originalEnv.url], ['SUPABASE_SERVICE_KEY', originalEnv.key]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
