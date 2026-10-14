'use strict';

const assert = require('node:assert/strict');
const { classifyCampaign } = require('../lib/meta');
const { montarMeta } = require('../api/meta');

assert.deepEqual(classifyCampaign('[aula] [cold] Gestão Operacional'), {
  grupo: 'AULA', formato: 'LP', temperatura: 'COLD',
});
for (const [nome, grupo] of [['[CP]', 'CP'], ['[SE]', 'SE'], ['[CAFÉ COM SEVILHA]', 'CAFE'], ['[DISTRIBUIÇÃO]', 'OUTROS'], ['Aula sem tag', 'OUTROS']]) {
  assert.equal(classifyCampaign(nome).grupo, grupo);
}

const rows = [
  { campaign_id: 'aula', campaign_name: '[AULA] [HOT]', spend: '100.25', impressions: '1000', clicks: '25', actions: [{ action_type: 'lead', value: '5' }] },
  { campaign_id: 'cafe', campaign_name: '[CAFÉ] [COLD]', spend: '20', actions: [{ action_type: 'lead', value: '2' }] },
  { campaign_id: 'outros', campaign_name: '[DISTRIBUIÇÃO]', spend: '10', actions: [] },
];
const originalFetch = global.fetch;
const originalToken = process.env.META_ACCESS_TOKEN;
process.env.META_ACCESS_TOKEN = 'offline-test';
global.fetch = async (url) => {
  const params = new URL(url).searchParams;
  const data = params.has('breakdowns') ? []
    : params.get('level') === 'adset' ? [{ ...rows[0], adset_id: 's1', adset_name: 'HOT' }]
    : params.get('level') === 'ad' ? [{ ...rows[0], ad_id: 'ad1', ad_name: 'Aula', adset_name: 'HOT' }]
    : params.has('time_increment') ? rows.map(r => ({ ...r, date_start: '2026-10-14' }))
    : rows;
  return { json: async () => ({ data }) };
};

(async () => {
  try {
    const result = await montarMeta('2026-10-13', '2026-10-14');
    assert.equal(result.campanhas.find(c => c.id === 'aula').grupo, 'AULA');
    assert.equal(result.conjuntos[0].grupo, 'AULA');
    assert.equal(result.anuncios[0].grupo, 'AULA');
    assert.equal(result.grupos.AULA.spend, 100.25);
    assert.equal(result.grupos.AULA.leads, 5);
    assert.equal(result.grupos.AULA.cpl, 20.05);
    assert.equal(result.grupos.OUTROS.spend, 10);
    assert.equal(result.grupos.CAFE.spend, 20);
    assert.deepEqual([result.conta.spend, result.conta.leads], [130.25, 7]);
    assert.equal(result.formatos.LP.spend, 120.25);
    assert.deepEqual(result.serie[0].AULA, { spend: 0, leads: 0 });
    assert.deepEqual(result.serie[1].AULA, { spend: 100.25, leads: 5 });
    assert.equal(result.serie[1].spend, result.conta.spend);
    assert.equal(result.serie[1].leads, result.conta.leads);
    assert.equal(result.serie[1].LP.spend, result.formatos.LP.spend);
    console.log('✓ meta-aula: classificação, agregados e série offline');
  } finally {
    global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.META_ACCESS_TOKEN;
    else process.env.META_ACCESS_TOKEN = originalToken;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
