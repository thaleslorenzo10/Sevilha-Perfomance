'use strict';
const assert = require('node:assert/strict');
process.env.RD_CRM_TOKEN = 'fixture';
const cf = '68e6669152f4a7001f8d9f8f';
const fixtures = [
  { name: '[SE] TEST_consultoria_824c87c3-9d03-42e8-8f96-588424792108', win: false, amount_total: 999 },
  { name: '[SE] TEST_consultoria_cliente_real', win: true, amount_total: 10 },
  { name: 'Cliente real', win: null, amount_total: 20 },
].map(d => ({ ...d, deal_stage: { name: 'Novos Leads' }, deal_custom_fields: [{ custom_field_id: cf, value: 'Campanha' }] }));
global.fetch = async raw => {
  const url = new URL(raw);
  const body = url.pathname.endsWith('/deal_pipelines') ? { deal_pipelines: [] }
    : url.pathname.endsWith('/deal_stages') ? { deal_stages: [] }
      : { deals: url.searchParams.get('deal_pipeline_id') === '68d152fa949ae20022df32cb' ? fixtures : [] };
  return { ok: true, status: 200, json: async () => body };
};
const handler = require('../api/rd-stats');
const res = { statusCode: null, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
(async () => {
  await handler({ method: 'GET', url: '/api/rd-stats?from=2026-10-09&to=2026-10-09' }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.total_deals, 2, 'somente fixture UUID exata excluida; nomes reais semelhantes preservados');
  assert.equal(res.body.funis.SE.total, 2);
  assert.equal(res.body.funis.SE.ganhos, 1);
  assert.equal(res.body.funis.SE.perdidos, 0);
  assert.equal(res.body.funis.SE.valor, 30);
  assert.equal(res.body.funis.SE.etapas[0].deals, 2);
  assert.deepEqual(res.body.por_campanha[0], { campanha: 'Campanha', deals: 2, ganhos: 1, perdidos: 0, valor: 30 });
  process.stdout.write('RD stats: fixture exata excluida de totais, etapas, ganhos, perdas, valores e campanhas\n');
})().catch(e => { process.stderr.write(`${e.stack || e.message}\n`); process.exitCode = 1; });
