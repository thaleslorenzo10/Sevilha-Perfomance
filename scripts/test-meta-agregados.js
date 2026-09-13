'use strict';
const assert = require('node:assert/strict');
process.env.META_ACCESS_TOKEN = 'x';

const acao = (tipo, v) => ({ action_type: tipo, value: String(v) });
const CAMP = [
  { campaign_id: '1', campaign_name: '[SE] [FORMS] [LEAD] [HOT]', spend: '100', impressions: '1000', clicks: '50', actions: [acao('onsite_conversion.lead_grouped', 4), acao('lead', 9)] },
  { campaign_id: '2', campaign_name: '[CAFÉ COM SEVILHA] COLD', spend: '50', impressions: '500', clicks: '10', actions: [acao('lead', 3)] },
];
const DIA = [{ campaign_name: '[CAFÉ COM SEVILHA] COLD', spend: '50', date_start: '2026-09-11', actions: [acao('lead', 3)] }];
const ADSET = [{ adset_id: 'a1', adset_name: 'HOT', campaign_name: '[SE] [FORMS] [LEAD] [HOT]', spend: '100', impressions: '1000', clicks: '50', actions: [acao('onsite_conversion.lead_grouped', 4)] }];
const AD = [{ ad_id: 'x1', ad_name: 'AD 07', adset_name: 'HOT', campaign_name: '[SE] [FORMS] [LEAD] [HOT]', spend: '100', impressions: '1000', clicks: '50', actions: [] }];
const PLAC = [
  { campaign_name: '[SE] [FORMS] [LEAD] [HOT]', publisher_platform: 'instagram', platform_position: 'instagram_stories', spend: '60', impressions: '600', clicks: '30', actions: [] },
  { campaign_name: '[CAFÉ COM SEVILHA] COLD', publisher_platform: 'instagram', platform_position: 'instagram_stories', spend: '20', impressions: '200', clicks: '5', actions: [] },
  { campaign_name: '[SE] [FORMS] [LEAD] [HOT]', publisher_platform: 'facebook', platform_position: 'feed', spend: '40', impressions: '400', clicks: '20', actions: [] },
];
global.fetch = async (url) => {
  const u = String(url);
  const dados = u.includes('breakdowns=') ? PLAC : u.includes('level=ad&') ? AD : u.includes('level=adset') ? ADSET
              : u.includes('time_increment') ? DIA : CAMP;
  return { json: async () => ({ data: dados }) };
};

const { montarMeta } = require('../api/meta');
(async () => {
  const m = await montarMeta('2026-09-10', '2026-09-12');
  assert.equal(m.grupos.CAFE.spend, 50);
  assert.equal(m.grupos.CAFE.leads, 3);
  assert.equal(m.grupos.SE.leads, 4, 'FORMS usa onsite');
  assert.deepEqual(m.serie.map(d => d.data), ['2026-09-10', '2026-09-11', '2026-09-12']);
  assert.equal(m.serie[1].CAFE.spend, 50);
  assert.equal(m.serie[1].LP.leads, 3, 'Café é LP e entra no formato');
  assert.equal(m.conjuntos[0].nome, 'HOT'); assert.equal(m.conjuntos[0].grupo, 'SE'); assert.equal(m.conjuntos[0].leads, 4);
  assert.equal(m.anuncios[0].nome, 'AD 07'); assert.equal(m.anuncios[0].conjunto, 'HOT');
  const st = m.posicionamentos.find(p => p.nome === 'instagram:stories');
  assert.equal(st.spend, 80, 'duas campanhas somadas no mesmo posicionamento');
  assert.equal(m.posicionamentos.find(p => p.nome === 'facebook:feed').spend, 40);
  console.log('✓ meta-agregados');
})();
