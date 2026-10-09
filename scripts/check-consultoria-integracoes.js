'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseEnv } = require('node:util');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const results = [];
let sharedMetaToken = '';
let vercelToken = '';
function usable(value) {
  return Boolean(value) && !/^\[.*\]$/.test(value);
}
function report(resource, ok, detail) {
  results.push({ resource, ok, detail });
}

async function getJson(url, headers = {}, requester = fetch) {
  try {
    const response = await requester(url, { headers, signal: AbortSignal.timeout(20000) });
    const body = await response.json().catch(() => null);
    return { status: response.status, ok: response.ok && body !== null && !body?.error && !body?.errors, body };
  } catch {
    return { status: 'network-error', ok: false, body: null };
  }
}

async function supabase() {
  const { conexao, TABELAS } = require('../lib/supabase');
  const connection = conexao();
  if (!connection || !usable(process.env.SUPABASE_URL) || !usable(process.env.SUPABASE_SERVICE_KEY)) {
    return report('Supabase', false, 'Local URL/key missing or sanitized placeholder');
  }
  const schema = await getJson(`${connection.url}/rest/v1/`, connection.headers);
  const columns = Object.keys(schema.body?.definitions?.[TABELAS.leads]?.properties || {});
  report('Supabase schema', schema.ok && columns.length > 0,
    `HTTP ${schema.status}; table ${TABELAS.leads}; columns: ${columns.join(', ')}`);
  const read = await getJson(`${connection.url}/rest/v1/${TABELAS.leads}?select=id,event_id,integracoes&limit=0`, connection.headers);
  report('Supabase receipts', read.ok, `HTTP ${read.status}; id/event_id/integracoes columns; no lead rows requested`);
}

async function sheets() {
  const { getServiceAccount, getAccessToken, SCOPE_RW } = require('../lib/sheets');
  const account = getServiceAccount();
  if (!account || !usable(account.email) || !usable(process.env.GOOGLE_PRIVATE_KEY)) {
    return report('Google Sheets', false, 'Local service account missing or sanitized placeholder');
  }
  try {
    crypto.createPrivateKey(account.key);
    const token = await getAccessToken(`${SCOPE_RW} https://www.googleapis.com/auth/drive.metadata.readonly`);
    await sheetTab(token);
  } catch {
    report('Google Sheets', false, 'Service account key/authentication failed; raw error omitted');
  }
}

async function sheetTab(token) {
  const { SHEETS_API } = require('../lib/sheets');
  const { extrairId } = require('../lib/sheets-write');
  const headers = { Authorization: `Bearer ${token}` };
  const id = extrairId(process.env.LEADS_SHEET_WRITE_ID || process.env.LEADS_SHEET_ID);
  const tab = process.env.LEADS_SHEET_WRITE_TAB || 'Leads Mentoria';
  const metadata = await getJson(`${SHEETS_API}/${id}?fields=properties.title,sheets.properties(sheetId,title)`, headers);
  const found = metadata.body?.sheets?.find(s => s.properties?.title === tab);
  report('Google Sheets tab', metadata.ok && Boolean(found),
    `HTTP ${metadata.status}; ${metadata.body?.properties?.title || 'title unavailable'}; tab ${tab}: ${Boolean(found)}`);
  await sheetCapability(id, headers);
}

async function sheetCapability(id, headers) {
  const capabilities = await getJson(`https://www.googleapis.com/drive/v3/files/${id}?fields=capabilities(canEdit),name`, headers);
  report('Google Sheets edit capability', capabilities.ok && capabilities.body?.capabilities?.canEdit === true,
    `HTTP ${capabilities.status}; canEdit=${capabilities.body?.capabilities?.canEdit ?? 'unverified'}; no append performed`);
}

async function crm() {
  const token = process.env.RD_CRM_TOKEN;
  if (!usable(token)) return report('RD CRM', false, 'Credential missing or sanitized placeholder');
  const base = 'https://crm.rdstation.com/api/v1';
  const read = resource => getJson(`${base}/${resource}?${new URLSearchParams({ token })}`);
  const resources = [
    ['users', 'users', '68e6e08c6c2ac10017538422'],
    ['deal_stages', 'deal_stages', process.env.RD_CRM_STAGE_ID_SE],
    ['campaigns', 'campaigns', process.env.RD_CRM_CAMPAIGN_ID_SE],
    ['deal_sources', 'deal_sources', process.env.RD_CRM_SOURCE_ID || '68e5c150af14bb00013f8acb'],
  ];
  for (const [endpoint, key, target] of resources) {
    if (!target) {
      report(`RD CRM ${key}`, endpoint === 'campaigns', endpoint === 'campaigns'
        ? 'Optional SE campaign omitted; no Clube campaign fallback'
        : 'Required SE stage missing; no Clube stage fallback');
      continue;
    }
    await crmResource(read, endpoint, key, target);
  }
}

async function crmResource(read, endpoint, key, target) {
  const response = await read(endpoint);
  const list = Array.isArray(response.body) ? response.body : response.body?.[key] || [];
  let found = list.find(row => (row._id || row.id) === target);
  if (!found && endpoint === 'deal_stages') {
    const specific = await read(`${endpoint}/${target}`);
    if (specific.ok) found = specific.body;
  }
  report(`RD CRM ${key}`, response.ok && Boolean(found),
    `HTTP ${response.status}; ${crmLabel(found)}`);
  if (endpoint === 'deal_stages') crmRouting(list);
}

function crmLabel(found) {
  return `configured resource ${found?.name || found?.nickname || 'not found'}; pipeline ${found?.deal_pipeline?.name || 'not returned'}`;
}

function crmRouting(list) {
  const consultoria = list.filter(row => /consultoria|estrat[eé]gica/i.test(`${row.name} ${row.deal_pipeline?.name}`));
  report('RD CRM consultoria routing', Boolean(process.env.RD_CRM_STAGE_ID_SE),
    `RD_CRM_STAGE_ID_SE ${process.env.RD_CRM_STAGE_ID_SE ? 'present' : 'EMPTY: delivery disabled'}; consultoria stages visible: ${consultoria.map(s => `${s.name} (${s._id || s.id}; ${s.deal_pipeline?.name || 'pipeline unavailable'})`).join('; ') || 'none'}`);
}

async function marketing() {
  const key = process.env.RD_MARKETING_TOKEN;
  report('RD Marketing conversion key', usable(key),
    `${usable(key) ? 'present' : 'missing or sanitized placeholder'}; conversion key cannot be validated by GET; no conversion sent`);
  const token = process.env.RD_MARKETING_ACCESS_TOKEN;
  if (!usable(token)) return report('RD Marketing OAuth read', false, 'Access token missing or sanitized placeholder');
  const account = await getJson('https://api.rd.services/platform/workflows', { Authorization: `Bearer ${token}` });
  report('RD Marketing OAuth read', account.ok,
    `HTTP ${account.status}; workflows readable=${account.ok}; no contacts or automation enrollment requested`);
  report('RD Marketing automation safety', false, 'Conversions may trigger existing workflows; GET does not prove test-contact suppression');
}

async function meta() {
  const localToken = process.env.META_CAPI_TOKEN;
  const token = usable(localToken) ? localToken : sharedMetaToken;
  const pixel = process.env.META_PIXEL_ID || '657178423444244';
  if (!usable(token)) return report('Meta CAPI', false, 'Local token missing or sanitized placeholder');
  const read = await getJson(`https://graph.facebook.com/v19.0/${pixel}?fields=id,name`, { Authorization: `Bearer ${token}` });
  report('Meta dataset', read.ok, `HTTP ${read.status}; pixel ${pixel}; resource ${read.body?.name || 'label unavailable'}; token source ${usable(localToken) ? 'local CAPI' : 'shared Ads read token (does not prove CAPI send permission)'}; no event sent`);
  report('Meta test code', true,
    process.env.META_TEST_EVENT_CODE ? 'configured; all local CAPI events become test events' : 'missing; a real CAPI send would enter production reporting');
}

async function deployment() {
  if (vercelToken) await vercelDeployment();
  for (const pathname of ['/api/leads', '/mentoria', '/mentoria-2', '/formulario-consultoria']) await publicPage(pathname);
}

async function vercelDeployment() {
    const project = JSON.parse(fs.readFileSync(path.join(root, '.vercel/project.json'), 'utf8'));
    const response = await getJson(`https://api.vercel.com/v9/projects/${project.projectId}?teamId=${project.orgId}`, { Authorization: `Bearer ${vercelToken}` });
    const current = response.body?.targets?.production;
    report('Vercel production deployment', response.ok && Boolean(current), `HTTP ${response.status}; project ${project.projectName}; deployment ${current?.url || 'unavailable'}; state ${current?.readyState || 'unavailable'}; commit ${current?.meta?.githubCommitSha || 'unavailable'}`);
}

async function publicPage(pathname) {
    try {
      const response = await fetch(`https://sevilha-perfomance.vercel.app${pathname}`, { signal: AbortSignal.timeout(20000) });
      report(`Public ${pathname}`, pathname === '/api/leads' ? response.status === 405 : response.ok,
        `HTTP ${response.status}; server ${response.headers.get('server') || 'unavailable'}; no submission performed`);
      await response.body?.cancel();
    } catch {
      report(`Public ${pathname}`, false, 'Network failed; raw error omitted');
    }
}

async function selfCheck() {
    const failure = await getJson('https://example.invalid', {}, async () => ({ ok: false, status: 503, json: async () => ({}) }));
    assert.equal(failure.ok, false);
    const bodyError = await getJson('https://example.invalid', {}, async () => ({ ok: true, status: 200, json: async () => ({ error: {} }) }));
    assert.equal(bodyError.ok, false);
    const network = await getJson('https://example.invalid', {}, async () => { throw new Error('private-url'); });
    assert.equal(network.status, 'network-error');
    assert.equal(usable('[SENSITIVE]'), false);
    assert.equal(usable(''), false);
    process.stdout.write('Self-check passed: HTTP failure, body error and sanitized network failure.\n');
}

function sharedRead() {
    const credentialRoot = '/home/codex/.claude/credenciais';
    const shared = parseEnv(fs.readFileSync(path.join(credentialRoot, 'supabase.env'), 'utf8'));
    if (shared.SUPABASE_URL === 'https://hojcntkggnwrvbvmcwxe.supabase.co') {
      process.env.SUPABASE_URL = shared.SUPABASE_URL;
      process.env.SUPABASE_SERVICE_KEY = shared.SUPABASE_SERVICE_KEY;
      report('Supabase credential selection', true, 'Shared source explicitly matches hojcntkggnwrvbvmcwxe; local file unchanged');
    }
    sharedMetaToken = parseEnv(fs.readFileSync(path.join(credentialRoot, 'ads.env'), 'utf8')).META_ACCESS_TOKEN;
    vercelToken = parseEnv(fs.readFileSync(path.join(credentialRoot, 'vercel.env'), 'utf8')).VERCEL_TOKEN;
}

async function main() {
  if (process.argv.includes('--self-check')) return selfCheck();
  Object.assign(process.env, parseEnv(fs.readFileSync(path.join(root, '.env.local'), 'utf8')));
  if (process.argv.includes('--shared-read')) sharedRead();
  // Auth token exchange is allowed; all business-resource requests above are GET.
  await supabase();
  await sheets();
  await crm();
  await marketing();
  await meta();
  await deployment();
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  if (results.some(row => !row.ok)) process.exitCode = 1;
}

main().catch(() => { process.stderr.write('Audit failed; raw error omitted.\n'); process.exitCode = 1; });
