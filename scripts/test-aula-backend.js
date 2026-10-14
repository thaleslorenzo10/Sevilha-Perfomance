'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const capi = require('../lib/capi');
const events = [];
const calls = [];
const integrationCalls = [];
let crmPrior;
const originalEnviar = capi.enviarEvento;
capi.enviarEvento = async e => { events.push(e); return { ok: true, recebidos: 1 }; };
require('../lib/sheets-write').gravarLead = async () => { integrationCalls.push('sheets'); return { ok: true }; };
require('../lib/lead-integracoes').sendToRDMarketing = async () => { integrationCalls.push('rd_marketing'); return { status: 'enviado' }; };
require('../lib/lead-integracoes').sendToRDCRM = async (data, prior) => { integrationCalls.push('rd_crm'); crmPrior = prior; return { status: 'enviado' }; };
const { tratarAula } = require('../lib/aula-leads');
const { tratarKiwify, assinaturaConfere } = require('../lib/kiwify');
const res = () => ({ code: 0, status(n) { this.code = n; return this; }, json(v) { this.body = v; return this; } });
const req = () => ({ headers: { 'user-agent': 'browser-test' }, body: { pagina: '/aula-gestao-operacional', nome: 'Teste Offline', email: 'offline@example.invalid', telefone: '11999999999', event_id: 'test_aula_20261027', fbp: 'fb.1.1.123', page_url: 'https://example.invalid/aula' } });
process.env.SUPABASE_URL = 'https://supabase.invalid';
process.env.SUPABASE_SERVICE_KEY = 'offline';
process.env.META_CAPI_TOKEN = 'offline';
process.env.KIWIFY_WEBHOOK_TOKEN = 'offline';

test('aula salva antes dos eventos e persiste recibos; valor fixo e ids iguais ao pixel', async () => {
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options, eventCount: events.length });
    return { ok: true, json: async () => options.method === 'POST' ? [{ id: 42 }] : [] };
  };
  const r = res(); await tratarAula(req(), r);
  assert.equal(r.code, 200);
  assert.equal(calls[1].eventCount, 0);
  assert.deepEqual(events.map(e => [e.evento, e.eventId, e.customData.value]), [['Lead', 'test_aula_20261027', 27], ['InitiateCheckout', 'ic:test_aula_20261027', 27]]);
  const receipt = JSON.parse(calls.at(-1).options.body).integracoes;
  assert.equal(receipt.capi.status, 'enviado'); assert.equal(receipt.checkout.status, 'enviado');
});
test('banco indisponivel impede confirmacao e envio de conversoes', async () => {
  const n = events.length; global.fetch = async () => { throw new Error('offline'); };
  const r = res(); await tratarAula(req(), r);
  assert.equal(r.code, 503); assert.equal(events.length, n);
});
test('reenvio ja persistido nao duplica integracoes', async () => {
  const n = events.length;
  const previousCalls = integrationCalls.length;
  const integracoes = Object.fromEntries(['sheets', 'rd_marketing', 'rd_crm', 'capi', 'checkout'].map(k => [k, { status: 'enviado' }]));
  global.fetch = async () => ({ ok: true, json: async () => [{ id: 42, ...req().body, integracoes }] });
  const r = res(); await tratarAula(req(), r); assert.equal(r.code, 200); assert.equal(r.body.repetido, true); assert.equal(events.length, n);
  assert.equal(integrationCalls.length, previousCalls);
});
test('reenvio recupera destinos pendentes sem repetir destinos confirmados', async () => {
  const n = events.length;
  const previousCalls = integrationCalls.length;
  const integracoes = {
    sheets: { status: 'enviado' }, rd_marketing: { status: 'falhou' },
    rd_crm: { status: 'incerto', deal_id: 'already-created' }, capi: { status: 'pendente' }, checkout: { status: 'enviado' },
  };
  let saved;
  global.fetch = async (url, options = {}) => {
    if (options.method === 'PATCH') saved = JSON.parse(options.body).integracoes;
    assert.notEqual(options.method, 'POST', 'retry must not insert another lead');
    return { ok: true, json: async () => [{ id: 42, ...req().body, integracoes }] };
  };
  const r = res(); await tratarAula(req(), r);
  assert.equal(r.code, 200); assert.equal(r.body.repetido, true);
  assert.deepEqual(integrationCalls.slice(previousCalls), ['rd_marketing', 'rd_crm']);
  assert.equal(crmPrior.deal_id, 'already-created');
  assert.deepEqual(events.slice(n).map(e => [e.evento, e.eventId]), [['Lead', req().body.event_id]]);
  assert.equal(saved.capi.status, 'enviado'); assert.equal(saved.checkout.status, 'enviado');
  assert.equal(saved.rd_crm.status, 'enviado'); assert.equal(saved.rd_marketing.status, 'enviado');
});
test('webhook exige assinatura e aceita evento irrelevante sem rede', async () => {
  global.fetch = async () => { throw new Error('unexpected network'); };
  const q = { url: '/api/kiwify-webhook', body: { webhook_event_type: 'ignored' } };
  assert.equal(assinaturaConfere(q), false);
  const r = res(); await tratarKiwify(q, r); assert.equal(r.code, 401);
  const sig = crypto.createHmac('sha1', 'offline').update(JSON.stringify(q.body)).digest('hex');
  q.url += `?signature=${sig}`;
  assert.equal(assinaturaConfere(q), true);
  const valid = res(); await tratarKiwify(q, valid); assert.equal(valid.code, 200);
});
test('CAPI real recusa HTTP 200 com error no corpo', async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ error: { message: 'rejected' } }) });
  const r = await originalEnviar({ evento: 'Lead', eventId: 'offline', userData: {}, seguro: true });
  assert.equal(r.ok, false);
});
test('compra paga usa identificadores do lead, persiste Purchase e deduplicacao', async () => {
  delete process.env.RD_CRM_TOKEN;
  const before = events.length;
  const writes = [];
  global.fetch = async (url, options = {}) => {
    if (options.method) writes.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => url.includes('sevilha_leads') ? [{ id: 42, fbp: 'fb.1.1.123', user_agent: 'real-browser', page_url: 'https://example.invalid/aula' }] : [] };
  };
  const body = { webhook_event_type: 'order_approved', order_status: 'paid', order_id: 'order-offline', charge_amount: 2700, Customer: { email: 'offline@example.invalid', full_name: 'Offline' }, TrackingParameters: { sck: 'test_aula_20261027' } };
  const sig = crypto.createHmac('sha1', 'offline').update(JSON.stringify(body)).digest('hex');
  const r = res(); await tratarKiwify({ body, url: `/api/kiwify-webhook?signature=${sig}` }, r);
  assert.equal(r.code, 200); assert.equal(events.length, before + 1);
  const purchase = events.at(-1);
  assert.equal(purchase.evento, 'Purchase'); assert.equal(purchase.eventId, 'kiwify:order-offline');
  assert.equal(purchase.customData.value, 27); assert.equal(purchase.userData.client_user_agent, 'real-browser');
  assert.ok(writes.some(w => w.url.includes('sevilha_eventos_enviados')));
  assert.equal(writes.at(-1).body.capi_status, 'ok');
});
