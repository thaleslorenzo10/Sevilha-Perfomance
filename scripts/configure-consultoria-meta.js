'use strict';

const fs = require('node:fs');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');

const ACCOUNT = 'act_1676714556216146';
const PIXEL = '657178423444244';
const VERSION = 'v24.0';
const BASE = `https://graph.facebook.com/${VERSION}`;
const PAYLOAD = {
  name: '[SE] Lead qualificado | mais de 10 colaboradores',
  description: 'Consultoria: LeadQualificado emitido apenas para porte comprovado acima de 10 colaboradores.',
  event_source_id: PIXEL,
  custom_event_type: 'LEAD',
  rule: JSON.stringify({ and: [
    { event: { eq: 'LeadQualificado' } },
    { or: ['/formulario-consultoria', '/mentoria', '/mentoria-2'].map(route => ({ URL: { i_contains: `https://sevilha-perfomance.vercel.app${route}` } })) },
  ] }),
};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function matches(row) {
  try {
    return row.pixel?.id === PIXEL && row.custom_event_type === 'LEAD'
      && JSON.stringify(canonical(JSON.parse(row.rule))) === JSON.stringify(canonical(JSON.parse(PAYLOAD.rule)));
  } catch { return false; }
}

async function request(path, token, body) {
  const response = await fetch(`${BASE}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    const error = new Error('meta_request_failed');
    error.status = response.status; error.code = result.error?.code;
    throw error;
  }
  return result;
}

function selfCheck() {
  assert.equal(matches({ pixel: { id: PIXEL }, custom_event_type: 'LEAD', rule: PAYLOAD.rule }), true);
  assert.equal(matches({ pixel: { id: 'wrong' }, custom_event_type: 'LEAD', rule: PAYLOAD.rule }), false);
  assert.equal(matches({ pixel: { id: PIXEL }, custom_event_type: 'LEAD', rule: '{bad' }), false);
  assert.equal(matches({ pixel: { id: PIXEL }, custom_event_type: 'LEAD', rule: JSON.stringify({ event: { eq: 'Lead' } }) }), false);
  process.stdout.write('custom conversion matching self-check passed; no network\n');
}

async function listAssets(token) {
  const rows = [];
  let after = '';
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({ fields: 'id,name,rule,pixel,custom_event_type,is_archived', limit: '100', ...(after ? { after } : {}) });
    const result = await request(`${ACCOUNT}/customconversions?${query}`, token);
    rows.push(...result.data || []);
    if (!result.paging?.next) break;
    after = result.paging.cursors?.after;
    if (!after || page === 19) throw new Error('pagination_unverified');
  }
  return rows;
}

async function createAsset(token) {
  // Do not automatically retry an ambiguous create; rerun the GET preflight first.
  const created = await request(`${ACCOUNT}/customconversions`, token, PAYLOAD);
  if (!/^\d+$/.test(String(created.id || ''))) throw new Error('creation_unconfirmed');
  const readback = await request(`${created.id}?fields=id,name,rule,pixel,custom_event_type,is_archived`, token);
  if (!matches(readback) || readback.is_archived || readback.name !== PAYLOAD.name) throw new Error('readback_mismatch');
  return { ok: true, created: true, id: readback.id, account: ACCOUNT, pixel: PIXEL, readback_verified: true };
}

async function main() {
  if (process.argv.includes('--self-check')) return selfCheck();
  const token = parseEnv(fs.readFileSync('/home/codex/.claude/credenciais/ads.env', 'utf8')).META_ACCESS_TOKEN;
  if (!token) throw new Error('credential_missing');
  const account = await request(`${ACCOUNT}?fields=id,name`, token);
  const pixel = await request(`${PIXEL}?fields=id,name`, token);
  assert.equal(account.id, ACCOUNT); assert.equal(account.name, 'Sevilha Perfomance - PVLG 1857 - ATIVA');
  assert.equal(pixel.id, PIXEL);
  const found = (await listAssets(token)).filter(matches);
  if (found.length > 1 || found.some(row => row.is_archived)) throw new Error('existing_asset_requires_review');
  if (found.length) return process.stdout.write(`${JSON.stringify({ ok: true, existing: true, id: found[0].id, account: ACCOUNT, pixel: PIXEL })}\n`);
  if (!process.argv.includes('--execute')) return process.stdout.write(`${JSON.stringify({ preflight: true, account: ACCOUNT, pixel: PIXEL, payload: PAYLOAD, existing_matches: 0 })}\n`);
  process.stdout.write(`${JSON.stringify(await createAsset(token))}\n`);
}

main().catch(error => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message === 'meta_request_failed' ? error.message : 'preflight_or_readback_failed', status: error.status || null, code: error.code || null })}\n`);
  process.exitCode = 1;
});
