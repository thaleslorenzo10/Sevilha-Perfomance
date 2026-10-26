'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.KIWIFY_WEBHOOK_TOKEN = 'offline';
process.env.SUPABASE_URL = 'https://example.invalid';
process.env.SUPABASE_SERVICE_KEY = 'offline';
delete process.env.RD_CRM_TOKEN;
const capi = require('../lib/capi');
let eventos = [];
capi.enviarEvento = async e => { eventos.push(e); return { ok: true }; };
const { tratarKiwify } = require('../lib/kiwify');
const body = (nome, extra = {}) => ({ webhook_event_type: 'order_approved', order_status: 'paid', order_id: 'provider-uuid',
  order_ref: 'ref-offline', approved_date: '2026-10-26 10:00', Product: { product_name: nome },
  Commissions: { charge_amount: 9700, product_base_price: 9700 }, Customer: { email: 'example@example.invalid' }, ...extra });
const req = b => ({ body: b, url: '/api/kiwify-webhook?signature=' + crypto.createHmac('sha1', 'offline').update(JSON.stringify(b)).digest('hex') });
async function executar(b, existente) {
  const escritas = []; eventos = [];
  global.fetch = async (url, opts = {}) => {
    if (opts.method) escritas.push({ url, body: JSON.parse(opts.body) });
    if (String(url).includes('rpc/sevilha_registrar_compra_kiwify')) {
      const registro = JSON.parse(opts.body).registro;
      const salvo = { ...registro, order_id: existente?.order_id || registro.order_id,
        status: existente?.status === 'refunded' ? 'refunded' : registro.status,
        capi_status: existente?.capi_status || registro.capi_status,
        crm_status: existente?.crm_status || registro.crm_status,
        payload: { ...registro.payload, ...(existente?.payload?.importacao ? { importacao: existente.payload.importacao } : {}) } };
      return { ok: true, status: 200, json: async () => salvo };
    }
    const rows = String(url).includes('sevilha_compras_aula') && !opts.method ? (existente ? [existente] : []) : [];
    return { ok: true, status: 200, json: async () => rows, text: async () => '' };
  };
  const r = { status(c) { this.code = c; return this; }, json(b2) { this.body = b2; return this; } };
  await tratarKiwify(req(b), r);
  return { ...r, escritas, eventos: [...eventos] };
}
(async () => {
  let r = await executar(body('Example product'));
  assert.equal(r.code, 200); assert.equal(r.eventos.length, 0, 'teste não envia CAPI');
  r = await executar(body('Clube da Perfomance'));
  assert.equal(r.code, 200); assert.equal(r.eventos.length, 0, 'outro produto não usa integração da Aula');
  r = await executar(body('Gravação da aula - Aula Gestão Operacional'));
  assert.equal(r.code, 200); assert.equal(r.eventos[0].customData.content_name, 'Gravação da aula - Aula Gestão Operacional');
  const importado = { order_id: 'kiwify-csv:ref-offline', status: 'paid', capi_status: 'nao_enviado_retroativo',
    payload: { order_ref: 'ref-offline', importacao: { fonte: 'kiwify_csv', data_pagamento: 'criacao_aproximada' } } };
  r = await executar(body('Gravação da aula - Aula Gestão Operacional'), importado);
  assert.equal(r.eventos.length, 0, 'reentrega histórica não envia CAPI');
  assert.ok(r.escritas.some(x => x.url.includes('rpc/sevilha_registrar_compra_kiwify')), 'conciliação atômica por referência');
  r = await executar(body('Aula Gestão Operacional'), { ...importado, status: 'refunded' });
  assert.equal(r.eventos.length, 0); assert.equal(r.escritas.length, 0, 'aprovação atrasada não desfaz estorno');
  r = await executar(body('Aula Gestão Operacional'), { ...importado, order_id: 'provider-uuid', capi_status: 'ok', payload: { order_ref: 'ref-offline' } });
  assert.equal(r.eventos.length, 0, 'recibo de sucesso preservado');
  r = await executar(body('Aula Gestão Operacional', { approved_date: 'invalid' }));
  assert.equal(r.code, 400, 'data inválida não vira venda de hoje');
  r = await executar(body('Aula Gestão Operacional', { webhook_event_type: 'order_refunded', approved_date: null }), { ...importado, pago_em: '2026-10-20T12:00:00Z', valor_centavos: 9700 });
  assert.equal(r.code, 200, 'estorno conserva pagamento anterior quando data ausente');
  assert.ok(r.escritas.some(x => x.body.registro?.status === 'refunded'));
  console.log('kiwify-multiproduto: OK');
})().catch(e => { console.error(e); process.exitCode = 1; });
