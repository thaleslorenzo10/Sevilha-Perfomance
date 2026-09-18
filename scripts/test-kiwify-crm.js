#!/usr/bin/env node
'use strict';

/**
 * Confere avancarDeal (lib/kiwify.js) sem rede real.
 *
 *   • deal [AULA] no funil da aula → PUT com pipeline + stage, devolve 'ok'
 *   • deal [AULA] movido para outro funil pela integração do RD Marketing → o
 *     mesmo PUT (pipeline + stage) traz ele de volta
 *   • RD recusa o PUT (422) → nota "Compra aprovada na Kiwify" no deal e
 *     status 'erro:deal 422 <corpo>' para ninguém mais adivinhar o motivo
 *   • sem deal [AULA] no contato → 'sem-deal'
 *
 * Rode com: node scripts/test-kiwify-crm.js
 */

const assert = require('assert');

process.env.RD_CRM_TOKEN = 'tok';
process.env.RD_CRM_STAGE_ID_AULA_PAGO = 'STAGE_PAGO';
process.env.RD_CRM_PIPELINE_ID_AULA = 'PIPE_AULA';
process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';

let deal = { name: '[AULA] Fulana', deal_stage: { _id: 'STAGE_INSCRITOS', deal_pipeline_id: 'PIPE_AULA' } };
let putStatus = 200;
const chamadas = [];

global.fetch = async (u, opts = {}) => {
  const url = String(u);
  chamadas.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
  if (url.includes('/contacts?')) return { ok: true, status: 200, json: async () => ({ contacts: [{ _id: 'C1' }] }) };
  if (url.includes('/contacts/C1'))  return { ok: true, status: 200, json: async () => ({ deal_ids: ['D1'] }) };
  if (url.includes('/deals/D1') && opts.method === 'PUT') {
    return { ok: putStatus < 300, status: putStatus, text: async () => JSON.stringify({ errors: { deal_stage_id: ['não pertence ao funil'] } }) };
  }
  if (url.includes('/deals/D1')) return { ok: true, status: 200, json: async () => deal };
  if (url.includes('/activities')) return { ok: true, status: 201, json: async () => ({}) };
  throw new Error('fetch inesperado: ' + url);
};

const { avancarDeal } = require('../lib/kiwify');
const puts  = () => chamadas.filter(c => c.method === 'PUT' && c.url.includes('/deals/D1'));
const notas = () => chamadas.filter(c => c.method === 'POST' && c.url.includes('/activities'));

(async () => {
  // 1. deal no funil da aula
  assert.strictEqual(await avancarDeal('a@b.c'), 'ok');
  assert.deepStrictEqual(puts()[0].body, { deal: { deal_pipeline_id: 'PIPE_AULA', deal_stage_id: 'STAGE_PAGO' } });
  assert.strictEqual(notas().length, 0);

  // 2. deal movido para o funil da mentoria → mesmo PUT traz de volta
  chamadas.length = 0;
  deal = { name: '[AULA] Fulana', deal_stage: { _id: 'STAGE_MENTORIA', deal_pipeline_id: 'PIPE_MENTORIA' } };
  assert.strictEqual(await avancarDeal('a@b.c'), 'ok');
  assert.deepStrictEqual(puts()[0].body, { deal: { deal_pipeline_id: 'PIPE_AULA', deal_stage_id: 'STAGE_PAGO' } });

  // 3. RD recusa → nota no deal + motivo no status
  chamadas.length = 0;
  putStatus = 422;
  const s = await avancarDeal('a@b.c');
  assert.ok(s.startsWith('erro:deal 422 '), s);
  assert.ok(s.includes('não pertence'), s);
  assert.strictEqual(notas().length, 1);
  assert.strictEqual(notas()[0].body.activity.deal_id, 'D1');
  assert.ok(/Compra aprovada na Kiwify/.test(notas()[0].body.activity.text));

  // 4. sem deal [AULA]
  chamadas.length = 0;
  putStatus = 200;
  deal = { name: 'Fulana', deal_stage: { _id: 'X', deal_pipeline_id: 'PIPE_MENTORIA' } };
  assert.strictEqual(await avancarDeal('a@b.c'), 'sem-deal');
  assert.strictEqual(puts().length, 0);

  console.log('✓ test-kiwify-crm: 4 cenários');
})().catch(e => { console.error(e); process.exit(1); });
