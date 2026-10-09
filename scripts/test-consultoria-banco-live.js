'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const { parseEnv } = require('node:util');
const assert = require('node:assert/strict');

const origin = 'https://hojcntkggnwrvbvmcwxe.supabase.co';
const table = '/rest/v1/sevilha_leads';
const eventId = `TESTE_consultoria_${crypto.randomUUID().replaceAll('-', '')}`;
const networkFetch = global.fetch;
let phase = 'preflight';
let cleanupAllowed = false;
let blockedRequests = 0;
const calls = [];

function allowedRequest(url, options = {}) {
  const target = new URL(url);
  const method = options.method || 'GET';
  if (target.origin !== origin || target.pathname !== table) return false;
  if (method === 'POST') return JSON.parse(options.body).event_id === eventId;
  return ['GET', 'PATCH', 'DELETE'].includes(method) && target.searchParams.get('event_id') === `eq.${eventId}`;
}

async function guardedFetch(url, options = {}) {
  if (!allowedRequest(url, options)) {
    blockedRequests++;
    throw new Error('request_outside_test_scope');
  }
  const response = await networkFetch(url, options);
  calls.push({ method: options.method || 'GET', status: response.status });
  return response;
}

async function database(query, options = {}) {
  const response = await guardedFetch(`${origin}${table}?${query}`, {
    ...options,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.ok, true);
  const body = await response.json();
  assert.equal(Array.isArray(body), true);
  return body;
}

const filter = `event_id=eq.${eventId}&pagina=eq./mentoria`;
const read = () => database(`${filter}&select=id,integracoes`);

async function submit(handler, payload) {
  const response = {
    code: 200,
    setHeader() {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({ method: 'POST', headers: {}, socket: {}, body: payload }, response);
  assert.equal(response.code, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.event_id, eventId);
  assert.equal(response.body.integracoes.banco, 'salvo');
  return response.body;
}

async function compareAndSwap(states) {
  const claimed = { ...states, execucao: { status: 'processando', id: eventId } };
  const compare = `${filter}&integracoes=eq.${encodeURIComponent(JSON.stringify(states))}`;
  const first = await database(compare, { method: 'PATCH', body: JSON.stringify({ integracoes: claimed }) });
  assert.equal(first.length, 1);
  const stale = await database(compare, { method: 'PATCH', body: JSON.stringify({ integracoes: states }) });
  assert.equal(stale.length, 0);
  const restore = `${filter}&integracoes=eq.${encodeURIComponent(JSON.stringify(claimed))}`;
  const restored = await database(restore, { method: 'PATCH', body: JSON.stringify({ integracoes: states }) });
  assert.equal(restored.length, 1);
}

async function verify(handler) {
  const payload = {
    pagina: '/mentoria', event_id: eventId, nome: 'TESTE AUTOMATIZADO CONSULTORIA - REMOVER',
    email: `${eventId.toLowerCase()}@example.invalid`, telefone: '5511000000000',
    cargo: 'Dono/Sócio', colaboradores: 'De 0 a 4', escritorio: 'TESTE SEM INTEGRACOES EXTERNAS',
  };
  const first = await submit(handler, payload);
  for (const destination of ['sheets', 'rd_crm', 'rd_marketing', 'capi']) {
    assert.equal(first.integracoes[destination], 'nao_configurado');
  }
  const [saved] = await read();
  assert.equal(saved.integracoes.execucao.status, 'livre');
  phase = 'cas';
  await compareAndSwap(saved.integracoes);
  phase = 'retry-and-concurrency';
  await submit(handler, payload);
  await Promise.all([submit(handler, payload), submit(handler, payload)]);
  const rows = await read();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, saved.id);
  assert.equal(rows[0].integracoes.execucao.status, 'livre');
  assert.equal(blockedRequests, 0);
}

function selfCheck() {
  assert.equal(allowedRequest('https://crm.rdstation.com/api/v1/deals', { method: 'POST', body: '{}' }), false);
  assert.equal(allowedRequest(`${origin}${table}`, { method: 'DELETE' }), false);
  assert.equal(allowedRequest(`${origin}${table}`, { method: 'POST', body: JSON.stringify({ event_id: 'other' }) }), false);
  assert.equal(allowedRequest(`${origin}${table}?${filter}`), true);
  process.stdout.write('Self-check passed: external writes and other event IDs denied.\n');
}

async function cleanup() {
  if (!cleanupAllowed) return;
  const previousPhase = phase;
  phase = 'cleanup';
  const deleted = await database(filter, { method: 'DELETE' });
  assert.equal(deleted.length <= 1, true);
  assert.equal((await read()).length, 0);
  process.stdout.write(`Cleanup confirmed: ${deleted.length} test row removed; external destination calls: ${blockedRequests}.\n`);
  phase = previousPhase;
}

async function main() {
  if (process.argv.includes('--self-check')) return selfCheck();
  assert.equal(process.argv.includes('--execute'), true);
  const shared = parseEnv(fs.readFileSync('/home/codex/.claude/credenciais/supabase.env', 'utf8'));
  assert.equal(shared.SUPABASE_URL, origin);
  process.env.SUPABASE_URL = shared.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_KEY = shared.SUPABASE_SERVICE_KEY;
  for (const key of ['META_CAPI_TOKEN', 'RD_CRM_TOKEN', 'RD_MARKETING_TOKEN', 'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'MAXMIND_ACCOUNT_ID', 'MAXMIND_LICENSE_KEY']) delete process.env[key];
  global.fetch = guardedFetch;
  try {
    assert.equal((await read()).length, 0);
    cleanupAllowed = true;
    phase = 'persistence';
    await verify(require('../api/leads'));
    process.stdout.write('Real Supabase test passed: persistence, JSONB CAS, stale-write rejection, retry and concurrency.\n');
  } finally {
    await cleanup();
    global.fetch = networkFetch;
  }
  process.stdout.write(`${JSON.stringify({ event_id: eventId, http_calls: calls })}\n`);
}

main().catch(() => {
  process.stderr.write(`Real database test failed at ${phase}; test event_id=${eventId}; raw error omitted.\n`);
  process.exitCode = 1;
});
