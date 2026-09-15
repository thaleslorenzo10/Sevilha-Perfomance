'use strict';
/**
 * Contrato do webhook da Kiwify (lib/kiwify.js).
 *   node scripts/test-kiwify-webhook.js
 * fetch stubado: Supabase, CAPI e RD CRM viram registros em memória.
 */
const crypto = require('crypto');
process.env.KIWIFY_WEBHOOK_TOKEN = 'tok';
process.env.META_CAPI_TOKEN = 'meta';
process.env.SUPABASE_URL = 'https://sb.local';
process.env.SUPABASE_SERVICE_KEY = 'k';
process.env.RD_CRM_TOKEN = 'rd';
process.env.RD_CRM_STAGE_ID_AULA_PAGO = 'stage-pago';

const chamadas = [];
let enviados = new Set();
let capiFalha = false;
global.fetch = async (url, opts = {}) => {
  const u = String(url); const body = opts.body ? JSON.parse(opts.body) : null;
  chamadas.push({ u, method: opts.method || 'GET', body });
  if (u.includes('sevilha_eventos_enviados') && (opts.method || 'GET') === 'GET') {
    return { ok: true, json: async () => [...enviados].map(event_id => ({ event_id })) };
  }
  if (u.includes('sevilha_eventos_enviados')) { body.forEach(r => enviados.add(r.event_id)); return { ok: true, text: async () => '' }; }
  if (u.includes('sevilha_leads')) return { ok: true, json: async () => [{ id: 'lead-1', fbp: 'fb.1.1.1', fbc: 'fb.1.2.2', external_id: 'ext', deal_id: null }] };
  if (u.includes('graph.facebook.com')) {
    if (capiFalha) return { ok: false, json: async () => ({ error: { message: 'boom' } }) };
    return { ok: true, json: async () => ({ events_received: 1 }) };
  }
  if (u.includes('crm.rdstation.com') && u.includes('/contacts?')) return { ok: true, json: async () => ({ contacts: [{ _id: 'c1', deal_ids: ['d1'] }] }) };
  if (u.includes('crm.rdstation.com') && u.includes('/deals/d1') && (opts.method || 'GET') === 'GET') return { ok: true, json: async () => ({ _id: 'd1', name: '[AULA] Teste', deal_stage: { _id: 'stage-inscrito' } }) };
  if (u.includes('crm.rdstation.com')) return { ok: true, json: async () => ({ _id: 'd1' }), text: async () => '' };
  return { ok: true, status: 201, json: async () => [{ order_id: 'o1' }], text: async () => '' };
};

const { tratarKiwify } = require('../lib/kiwify');
let falhas = 0;
const ok = (c, d) => { console.log(`  ${c ? '✓' : '✗'} ${d}`); if (!c) falhas += 1; };

function corpo(extra = {}) {
  return JSON.stringify({
    webhook_event_type: 'order_approved', order_id: 'o1', order_status: 'paid',
    Customer: { full_name: 'Ana Teste', email: 'Ana@X.com', mobile: '(31) 99999-0000' },
    Commissions: { charge_amount: 4700 },
    TrackingParameters: { sck: 'ev_1', utm_source: 'ig', utm_campaign: '[AULA] Teste' },
    approved_date: '2026-10-01 20:00', ...extra,
  });
}
function req(raw, sig) {
  const s = sig ?? crypto.createHmac('sha1', 'tok').update(raw).digest('hex');
  return { method: 'POST', url: `/api/kiwify-webhook?signature=${s}`, rawBody: raw, body: JSON.parse(raw), headers: {} };
}
function res() { const r = {}; r.status = c => { r.code = c; return r; }; r.json = j => { r.dado = j; return r; }; r.end = () => r; return r; }
const capi = () => chamadas.filter(c => c.u.includes('graph.facebook.com')).map(c => c.body.data[0]);
const upserts = () => chamadas.filter(c => c.u.includes('sevilha_compras_aula') && c.method === 'POST');

(async () => {
  console.log('\nassinatura inválida');
  let r = res(); await tratarKiwify(req(corpo(), 'errada'), r);
  ok(r.code === 401, 'responde 401');
  ok(!upserts().length, 'não grava nada');

  console.log('\norder_approved');
  chamadas.length = 0; r = res(); await tratarKiwify(req(corpo()), r);
  ok(r.code === 200, 'responde 200');
  ok(upserts().length === 1 && upserts()[0].body.order_id === 'o1', 'upsert por order_id');
  ok(upserts()[0].body.email === 'ana@x.com' && upserts()[0].body.valor_centavos === 4700, 'e-mail normalizado e valor em centavos');
  ok(upserts()[0].body.sck === 'ev_1' && upserts()[0].body.lead_id === 'lead-1', 'lead localizado pelo sck');
  const p = capi().find(e => e.event_name === 'Purchase');
  ok(p && p.event_id === 'kiwify:o1', 'Purchase com event_id kiwify:<order_id>');
  ok(p && p.custom_data.value === 47 && p.custom_data.currency === 'BRL', 'value 47 BRL');
  ok(p && p.user_data.fbp === 'fb.1.1.1' && p.user_data.fbc === 'fb.1.2.2', 'fbp/fbc do lead');
  ok(chamadas.some(c => c.u.includes('/deals/d1') && c.method === 'PUT' && c.body.deal.deal_stage_id === 'stage-pago'), 'deal [AULA] avança para o stage pago');

  console.log('\nreentrega');
  chamadas.length = 0; r = res(); await tratarKiwify(req(corpo()), r);
  ok(r.code === 200 && !capi().length, 'segunda entrega não reenvia Purchase');

  console.log('\norder_refunded');
  chamadas.length = 0; r = res(); await tratarKiwify(req(corpo({ webhook_event_type: 'order_refunded', order_status: 'refunded' })), r);
  ok(r.code === 200 && upserts()[0].body.status === 'refunded', 'grava status refunded');
  ok(!capi().length, 'sem evento no Meta');

  console.log('\nCAPI fora');
  chamadas.length = 0; enviados = new Set(); capiFalha = true; r = res();
  await tratarKiwify(req(corpo({ order_id: 'o2' })), r);
  ok(r.code === 200, 'ainda responde 200');
  const u = chamadas.filter(c => c.u.includes('sevilha_compras_aula') && c.method === 'PATCH').pop();
  ok(u && /^erro:/.test(u.body.capi_status), 'capi_status gravado com o erro');

  console.log('\nevento desconhecido');
  chamadas.length = 0; r = res(); await tratarKiwify(req(corpo({ webhook_event_type: 'pix_created', order_status: 'waiting_payment' })), r);
  ok(r.code === 200 && !upserts().length, '200 sem gravar');

  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
  process.exit(falhas ? 1 : 0);
})();
