#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const vm = require('node:vm');
const fs = require('node:fs');

Object.assign(process.env, {
  SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_KEY: 'secret-test', META_CAPI_TOKEN: 'secret-test',
  RD_CRM_TOKEN: 'secret-test', RD_MARKETING_TOKEN: 'secret-test', VERCEL_ENV: 'production',
  RD_CRM_STAGE_ID_SE: 'stage-SE-test',
  META_TEST_EVENT_CODE: 'must-not-be-used', GOOGLE_SERVICE_ACCOUNT_EMAIL: 'service@test.invalid',
  GOOGLE_PRIVATE_KEY: crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }),
  LEADS_SHEET_WRITE_ID: 'sheet-test', LEADS_SHEET_WRITE_PAGES: '/mentoria,/mentoria-2',
});
delete process.env.MAXMIND_ACCOUNT_ID;
delete process.env.MAXMIND_LICENSE_KEY;
delete process.env.RD_CRM_CAMPAIGN_ID_SE;
const handler = require('../api/leads');
const { sendToRDCRM } = require('../lib/lead-integracoes');

let rows, calls, faults, contact, deals, qualified;
function reset() {
  rows = new Map(); calls = []; faults = {};
  contact = { _id: 'contact1', deal_ids: [] }; deals = new Map(); qualified = new Set();
}
const reply = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) });

function database(url, method, body) {
  if (faults.banco) return reply(503, { error: 'secret-test contato@test.invalid' });
  if (url.pathname.endsWith('sevilha_eventos_enviados')) {
    if (method === 'POST') { body.forEach(r => qualified.add(r.event_id)); return reply(201, []); }
    return reply(200, [...qualified].map(event_id => ({ event_id })));
  }
  const id = url.searchParams.get('event_id')?.slice(3);
  if (method === 'POST') {
    if (rows.has(body.event_id)) return reply(409, { code: '23505' });
    rows.set(body.event_id, structuredClone(body));
    return reply(201, [structuredClone(body)]);
  }
  const candidate = rows.get(id);
  const paginas = url.searchParams.get('pagina')?.slice(4, -1).split(',');
  const current = candidate && (!paginas || paginas.includes(candidate.pagina)) ? candidate : undefined;
  if (method === 'PATCH') {
    const compare = url.searchParams.get('integracoes');
    const before = compare === 'is.null' ? null : JSON.parse(compare.slice(3));
    if (!current || !isDeepStrictEqual(current.integracoes ?? null, before)) return reply(200, []);
    if (faults.recibo && body.integracoes.sheets.status === 'enviado') return reply(503, { error: 'secret-test' });
    current.integracoes = structuredClone(body.integracoes);
  }
  return reply(200, current ? [structuredClone(current)] : []);
}

function crm(url, method, body) {
  if (url.pathname.endsWith('/contacts') && method === 'GET') return reply(200, { contacts: faults.novo ? [] : [contact] });
  if (url.pathname.endsWith('/contacts/contact1')) {
    if (method === 'PUT') {
      if (faults.vinculo && body.contact.deal_ids) return reply(400, { error: 'secret-test contato@test.invalid' });
      Object.assign(contact, body.contact);
    }
    return reply(200, structuredClone(contact));
  }
  if (url.pathname.endsWith('/deals') && method === 'POST') {
    if (faults.crmAmbiguo) throw new Error('https://crm/?token=secret-test contato@test.invalid');
    const deal = { ...body.deal, _id: 'deal' + (deals.size + 1), contacts: body.contacts || [] };
    deals.set(deal._id, deal);
    return reply(201, deal);
  }
  return reply(200, deals.get(url.pathname.split('/').pop()));
}

global.fetch = async (raw, options = {}) => {
  const url = new URL(raw); const method = options.method || 'GET';
  const body = options.body && typeof options.body === 'string' ? JSON.parse(options.body) : null;
  calls.push({ host: url.hostname, path: url.pathname, method, body });
  if (url.hostname === 'db.test') return database(url, method, body);
  assert.ok(rows.size || faults.legado, 'banco confirma cadastro antes de qualquer integracao');
  if (url.hostname === 'oauth2.googleapis.com') return reply(200, { access_token: 'google-test', expires_in: 3600 });
  if (url.hostname === 'sheets.googleapis.com') {
    if (method === 'GET') return reply(200, { sheets: [{ properties: { title: 'Leads Mentoria' } }] });
    if (faults.sheets) return reply(500, { error: 'secret-test contato@test.invalid' });
    return reply(200, { updates: { updatedRows: 1, updatedRange: "'Leads Mentoria'!A2:Q2" } });
  }
  if (url.hostname === 'api.rd.services') return faults.marketing ? reply(200, { error: 'secret-test contato@test.invalid' }) : reply(200, { event_uuid: 'event-test' });
  if (url.hostname === 'crm.rdstation.com') return crm(url, method, body);
  if (url.hostname === 'graph.facebook.com') {
    assert.equal(body.test_event_code, undefined, 'producao nunca recebe test_event_code');
    return faults.capi ? reply(200, { error: 'secret-test contato@test.invalid' }) : reply(200, { events_received: faults.capiZero ? 0 : 1 });
  }
  throw new Error('rede inesperada ' + url.hostname);
};

const lead = overrides => ({
  nome: 'Pessoa Teste', email: 'contato@test.invalid', telefone: '(11) 98888-7777',
  colaboradores: 'De 11 a 19', cargo: 'Dono/Sócio', escritorio: '', pagina: '/mentoria', event_id: 'ev_teste_12345',
  fbp: 'fb.1.123.456', fbclid: 'click-test', external_id: 'browser-test',
  utm_source: '{{placement}}', utm_medium: '{{adset.name}}', utm_campaign: '{{campaign.name}}', utm_content: '{{ad.name}}',
  page_url: 'https://sevilhaperformance.com.br/mentoria', ...overrides,
});
async function submit(body) {
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(json) { this.body = json; }, end() {} };
  await handler({ method: 'POST', headers: { 'user-agent': 'browser-test' }, body, socket: { remoteAddress: '127.0.0.1' } }, res);
  return res;
}
const contar = (host, method = 'POST') => calls.filter(c => c.host === host && c.method === method).length;

async function sucesso(pagina = '/mentoria') {
  reset();
  const input = lead({ pagina, page_url: 'https://sevilhaperformance.com.br' + pagina });
  const r = await submit(input);
  assert.equal(r.code, 200); assert.equal(r.body.ok, true);
  assert.ok(Object.values(r.body.integracoes).every(s => ['salvo', 'enviado'].includes(s)));
  assert.equal(rows.size, 1); assert.equal(deals.size, 1); assert.equal(contar('sheets.googleapis.com'), 1);
  assert.deepEqual(contact.deal_ids, ['deal1']);
  const event = calls.find(c => c.host === 'graph.facebook.com').body.data[0];
  assert.ok(calls.filter(c => c.host === 'graph.facebook.com').every(c => c.path === '/v24.0/657178423444244/events'), 'CAPI fixa v24 sem depender de migracao automatica');
  assert.equal(rows.get(input.event_id).pagina, pagina);
  assert.equal(calls.find(c => c.host === 'sheets.googleapis.com' && c.method === 'POST').body.values[0][1], pagina);
  assert.equal(calls.find(c => c.host === 'api.rd.services').body.payload.conversion_identifier, 'sessao-estrategica-consultoria');
  assert.equal(deals.get('deal1').deal_stage_id, 'stage-SE-test');
  assert.equal(event.custom_data.content_name, pagina); assert.equal(event.event_source_url, input.page_url);
  assert.equal(event.event_id, lead().event_id); assert.equal(event.custom_data.utm_source, '{{placement}}');
  assert.equal(event.user_data.em[0], crypto.createHash('sha256').update('contato@test.invalid').digest('hex'));
  assert.equal(event.user_data.ph[0], crypto.createHash('sha256').update('5511988887777').digest('hex'));
  assert.equal(event.user_data.fbp, lead().fbp); assert.ok(event.user_data.fbc.endsWith('.click-test'));
  const receipts = JSON.stringify(rows.get(lead().event_id).integracoes);
  const qualified = calls.find(c => c.host === 'graph.facebook.com' && c.body.data[0].event_name === 'LeadQualificado').body.data[0];
  assert.equal(r.body.qualified_event_id, qualified.event_id, 'receipt exposes exact CAPI id for browser dedup');
  assert.ok(!/secret-test|contato@|98888|Pessoa|https:/.test(receipts));
  assert.ok(!JSON.stringify(r.body).includes('contato@'));
  await submit(lead({ pagina: '/mentoria-2' }));
  assert.equal(deals.size, 1); assert.equal(contar('sheets.googleapis.com'), 1); assert.equal(contar('graph.facebook.com'), 2);
  const collision = await submit(lead({ email: 'outro@test.invalid' }));
  assert.equal(collision.code, 409); assert.equal(deals.size, 1);
}

async function validacao() {
  for (const pagina of ['/mentoria', '/mentoria-2', '/formulario-consultoria']) {
    for (const bad of [{ nome: '' }, { nome: 'a'.repeat(201) }, { email: 'x' }, { email: 'a'.repeat(250) + '@test.invalid' }, { escritorio: 'a'.repeat(201) }, { telefone: '123' }, { cargo: 'x' }, { colaboradores: '' }, { event_id: 'email@test' }, { utm_source: ['x'] }]) {
      reset(); const r = await submit(lead({ pagina, ...bad }));
      assert.equal(r.code, 400); assert.equal(calls.length, 0);
    }
    reset(); faults.banco = true;
    const r = await submit(lead({ pagina }));
    assert.equal(r.code, 503); assert.equal(r.body.ok, false); assert.equal(contar('api.rd.services'), 0);
    reset(); const low = await submit(lead({ pagina, colaboradores: 'De 0 a 4', cargo: 'Cargo Operacional' }));
    assert.equal(low.body.ok, true); assert.equal(low.body.lead_qualificado, false);
    assert.equal(low.body.perfil_qualificado, false); assert.equal(low.body.qualified_event_id, undefined);
    assert.equal(contar('graph.facebook.com'), 1);
    assert.ok(deals.get('deal1').name.startsWith('[SE]'));
  }
  reset(); assert.equal((await submit('bad')).code, 400);
  reset(); assert.equal((await submit(lead({ nome: 'a'.repeat(25000) }))).code, 413);
  reset(); const op = await submit(lead({ cargo: 'Cargo Operacional' }));
  assert.equal(op.body.lead_qualificado, true, 'scoring atual usa somente porte');
  for (const colaboradores of ['De 5 a 10', 'De 10 a 19']) {
    reset(); const r = await submit(lead({ colaboradores }));
    assert.equal(r.body.ok, true); assert.equal(r.body.lead_qualificado, false);
    assert.equal(r.body.qualified_event_id, undefined);
    assert.equal(contar('graph.facebook.com'), 1, 'inclusive10 ou faixa antiga ambigua envia apenas Lead');
  }
}

async function retentativas() {
  reset(); Object.assign(faults, { marketing: true, vinculo: true, capi: true });
  let r = await submit(lead());
  assert.equal(r.body.ok, true); assert.equal(r.body.integracoes.rd_marketing, 'falhou');
  assert.equal(r.body.integracoes.rd_crm, 'falhou'); assert.equal(r.body.integracoes.capi, 'falhou');
  assert.equal(rows.get(lead().event_id).integracoes.rd_crm.deal_id, 'deal1');
  faults = {}; r = await submit(lead());
  assert.equal(r.body.integracoes.rd_crm, 'enviado'); assert.equal(deals.size, 1);
  assert.equal(contar('sheets.googleapis.com'), 1); assert.deepEqual(contact.deal_ids, ['deal1']);
  reset(); faults.crmAmbiguo = true; faults.sheets = true;
  r = await submit(lead()); assert.equal(r.body.integracoes.rd_crm, 'incerto'); assert.equal(r.body.integracoes.sheets, 'incerto');
  const before = calls.length; faults = {}; await submit(lead());
  assert.equal(calls.slice(before).filter(c => c.host === 'crm.rdstation.com' || c.host === 'sheets.googleapis.com').length, 0);
  reset(); faults.recibo = true; r = await submit(lead());
  assert.equal(r.body.ok, true); faults = {}; await submit(lead());
  assert.equal(contar('sheets.googleapis.com'), 1); assert.equal(deals.size, 0);
  reset(); faults.capiZero = true; r = await submit(lead());
  assert.equal(r.body.integracoes.capi, 'falhou'); assert.equal(r.body.lead_qualificado, false);
  assert.equal(r.body.perfil_qualificado, true, 'perfil persiste mesmo sem confirmacao Meta');
  assert.ok(r.body.qualified_event_id, 'Pixel independente recebe mesmo id quando CAPI falha');
}

async function concorrencia() {
  reset(); const results = await Promise.all([submit(lead()), submit(lead()), submit(lead())]);
  assert.ok(results.every(r => r.body.ok)); assert.deepEqual([rows.size, deals.size], [1, 1]);
  assert.ok(results.every(r => r.body.perfil_qualificado && r.body.qualified_event_id), 'claim concorrente nao impede pixel qualificado');
  assert.equal(contar('sheets.googleapis.com'), 1); assert.equal(contar('api.rd.services'), 1); assert.equal(contar('graph.facebook.com'), 2);
  reset(); delete process.env.RD_MARKETING_TOKEN;
  const r = await submit(lead()); assert.equal(r.body.integracoes.rd_marketing, 'nao_configurado');
  process.env.RD_MARKETING_TOKEN = 'secret-test';
  reset(); faults.novo = true; faults.legado = true;
  const legacy = await sendToRDCRM({ nome: 'Teste sem contato', email: '', telefone: '', pagina: '/pre-inscricao' });
  assert.equal(legacy.status, 'incerto');
  assert.equal(calls.filter(c => c.path.endsWith('/contacts')).length, 0, 'email vazio nao busca primeiro contato');
  assert.equal(deals.size, 1);
}

async function recuperarExecucao() {
  reset(); faults.recibo = true; await submit(lead());
  const row = rows.get(lead().event_id);
  assert.equal(row.integracoes.execucao.status, 'processando');
  faults = {}; await submit(lead());
  assert.equal(deals.size, 0, 'claim recente conserva exclusividade');
  row.integracoes.execucao.em = new Date(Date.now() - 331000).toISOString();
  row.integracoes.qualificacao = { status: 'incerto' };
  const results = await Promise.all([submit(lead()), submit(lead())]);
  assert.ok(results.every(r => r.body.ok));
  assert.equal(contar('sheets.googleapis.com'), 1, 'claim expirada nao repete POST ambiguo');
  assert.equal(contar('api.rd.services'), 1); assert.equal(deals.size, 1);
  assert.equal(contar('graph.facebook.com'), 1, 'incerto nao repete CAPI de qualificacao');
  assert.equal(row.integracoes.sheets.status, 'processando');
  assert.equal(row.integracoes.execucao.status, 'livre');
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.equal(config.functions['api/leads.js'].maxDuration, 300, 'prazo da claim cobre limite serverless');
}

async function configuracaoCRM() {
  for (const pagina of ['/mentoria', '/mentoria-2', '/formulario-consultoria']) {
    reset(); delete process.env.RD_CRM_STAGE_ID_SE;
    const r = await submit(lead({ pagina }));
    assert.equal(r.body.ok, true); assert.equal(r.body.integracoes.rd_crm, 'nao_configurado');
    assert.equal(contar('crm.rdstation.com'), 0);
    process.env.RD_CRM_STAGE_ID_SE = 'stage-SE-test'; await submit(lead({ pagina }));
    assert.equal(deals.get('deal1').deal_stage_id, 'stage-SE-test');
    assert.equal(Object.hasOwn(deals.get('deal1'), 'campaign_id'), false, 'consultoria nao herda campanha do Clube');
  }
  reset(); faults.legado = true;
  delete process.env.RD_CRM_STAGE_ID; delete process.env.RD_CRM_CAMPAIGN_ID;
  await sendToRDCRM({ nome: 'Legado Teste', email: 'legacy@test.invalid', pagina: '/pre-inscricao' });
  assert.equal(deals.get('deal1').deal_stage_id, '69d52f54c0b8000015d2e7bb');
  assert.equal(deals.get('deal1').campaign_id, '69d52f437e5d76001a90e080');
}

function storage() {
  const values = new Map();
  return { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
}

function browser(localStorage, sessionStorage, state) {
  const posts = []; const pixels = []; const beacons = [];
  const pagina = state.pagina || '/mentoria';
  const window = {
    location: { pathname: pagina, href: 'https://test.invalid' + pagina, search: '', origin: 'https://test.invalid' },
    addEventListener() {}, fbq: (...args) => pixels.push(args),
  };
  const standaloneForm = { elements: [], hasAttribute: () => true, addEventListener() {} };
  const document = { cookie: '', title: 'Sessao Estrategica', referrer: '',
    getElementById: id => state.standalone && id === 'sessao-form' ? standaloneForm : null, querySelectorAll: () => [] };
  const context = {
    window, document, localStorage, sessionStorage, URLSearchParams, console,
    Blob: class { constructor(parts) { this.source = parts.join(''); } },
    navigator: { userAgent: 'browser-test', sendBeacon: (url, body) => { beacons.push({ url, body: JSON.parse(body.source) }); return true; } }, fbq: window.fbq,
    FormData: class { constructor(form) { return Object.entries(form.fields).map(([key, field]) => [key, field.value]); } },
    setTimeout: fn => queueMicrotask(fn),
    fetch: async (url, options) => {
      assert.equal(url, '/api/leads');
      posts.push(JSON.parse(options.body));
      return reply(state.code, state.payload);
    },
  };
  vm.runInNewContext(fs.readFileSync('assets/tracking.js', 'utf8'), context);
  const form = {
    fields: Object.fromEntries(Object.entries(lead({ event_id: '', pagina })).map(([k, value]) => [k, { value }])),
    querySelector(selector) {
      if (selector.startsWith('button')) return null;
      return this.fields[selector.match(/name="([^"]+)/)?.[1]] || null;
    },
  };
  return { window, form, posts, pixels, beacons };
}

async function tracking(pagina = '/mentoria') {
  const local = storage(); const session = storage();
  const state = { code: 503, payload: { ok: false }, pagina, standalone: pagina === '/formulario-consultoria' };
  let b = browser(local, session, state); let failures = 0; let successes = 0;
  assert.equal(b.beacons.length, state.standalone ? 3 : 2, 'visita, visitante distinto e formulario direto aberto registrados');
  if (state.standalone) assert.equal(b.beacons.at(-1).body.evento, 'form_open');
  assert.ok(b.beacons.every(c => c.url === '/api/pageview' && c.body.pagina === pagina));
  b.window.SP_marcar('passo_2');
  assert.equal(b.beacons.at(-1).body.evento, 'passo_2');
  const send = current => current.window.SP_handleSubmit({ preventDefault() {} }, current.form, () => successes++, () => failures++);
  const flush = () => new Promise(resolve => setTimeout(resolve, 5));
  send(b); await flush();
  assert.equal(successes, 0); assert.equal(failures, 1);
  assert.equal(b.pixels.filter(p => p[1] === 'Lead').length, 0);
  const id = b.posts[0].event_id;
  assert.ok(b.posts.every(p => p.pagina === pagina));
  assert.ok(b.posts.every(p => p.event_id === id), 'retries preservam event_id');
  send(b); await flush();
  assert.equal(JSON.parse(local.getItem('sp_pending_leads')).length, 1, 'fila nao duplica submissao');
  b = browser(local, session, state); await flush();
  b.window.SP_populateHiddenFields(b.form);
  assert.equal(b.form.fields.event_id.value, id, 'reload recupera mesmo id pendente');
  assert.ok(b.posts.every(p => p.event_id === id));
  assert.equal(JSON.parse(local.getItem('sp_pending_leads')).length, 1);
  state.code = 200; state.payload = { ok: false }; send(b); await flush();
  assert.equal(successes, 0, 'HTTP 200 ok:false nao produz sucesso');
  state.payload = { ok: true, perfil_qualificado: true, lead_qualificado: true, qualified_event_id: 'qualified-test-id', integracoes: { banco: 'salvo', capi: 'enviado' } };
  send(b); await flush(); send(b); await flush();
  assert.equal(successes, 2); assert.equal(b.pixels.filter(p => p[1] === 'Lead').length, 1);
  assert.equal(b.pixels.find(p => p[1] === 'Lead')[3].eventID, id);
  const qualified = b.pixels.filter(p => p[1] === 'LeadQualificado');
  assert.equal(qualified.length, 1, 'qualified browser retries deduplicated');
  assert.equal(qualified[0][0], 'trackCustom');
  assert.equal(qualified[0][3].eventID, 'qualified-test-id');
  assert.equal(JSON.parse(local.getItem('sp_pending_leads')).length, 0);
  state.payload = { ok: true, integracoes: { banco: 'salvo', rd_crm: 'falhou' } };
  send(b); await flush(); assert.equal(JSON.parse(local.getItem('sp_pending_leads')).length, 1);
  state.payload = { ok: true, integracoes: { banco: 'salvo', rd_crm: 'enviado' } };
  const reload = browser(local, session, state); await flush();
  assert.equal(reload.posts[0].event_id, id);
  assert.equal(reload.pixels.filter(p => p[1] === 'Lead').length, 0, 'replay nao duplica pixel');
  assert.equal(JSON.parse(local.getItem('sp_pending_leads')).length, 0);
}

async function pixelQualificadoIndependente() {
  for (const status of ['falhou', 'incerto', 'nao_configurado', 'processando']) {
    const state = { code: 200, payload: { ok: true, perfil_qualificado: true,
      lead_qualificado: false, qualified_event_id: 'qualified-' + status,
      integracoes: { banco: 'salvo', qualificacao: status } } };
    const b = browser(storage(), storage(), state);
    b.window.SP_handleSubmit({ preventDefault() {} }, b.form, () => {}, () => {});
    await new Promise(resolve => setTimeout(resolve, 5));
    const pixel = b.pixels.find(p => p[1] === 'LeadQualificado');
    assert.ok(pixel, 'pixel independente quando CAPI ' + status);
    assert.equal(pixel[3].eventID, state.payload.qualified_event_id);
  }
}

(async () => {
  for (const pagina of ['/mentoria', '/mentoria-2', '/formulario-consultoria']) { await sucesso(pagina); await tracking(pagina); }
  await pixelQualificadoIndependente();
  await validacao(); await retentativas(); await concorrencia(); await recuperarExecucao(); await configuracaoCRM();
  console.log('consultoria: persistencia, validacao, recibos, retentativas, concorrencia, CAPI e browser tracking offline passaram');
})().catch(e => { console.error(e); process.exitCode = 1; });
