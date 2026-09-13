'use strict';
const assert = require('node:assert/strict');
const { agruparPorCampanha } = require('../api/rd-stats');
const CF = '68e6669152f4a7001f8d9f8f';
const deals = [
  { win: null,  amount_total: 0,    deal_custom_fields: [{ custom_field_id: CF, value: '[SE] [FORMS] [LEAD] [HOT]' }] },
  { win: true,  amount_total: 1500, deal_custom_fields: [{ custom_field: { _id: CF }, value: '[SE] [FORMS] [LEAD] [HOT]' }] },
  { win: false, amount_unique: 0,   deal_custom_fields: [{ custom_field: { _id: 'outro' }, value: 'x' }] },
  { win: null,  deal_custom_fields: [] },
  { win: null },
];
const r = agruparPorCampanha(deals);
assert.deepEqual(r[0], { campanha: 'Sem campanha', deals: 3, ganhos: 0, perdidos: 1, valor: 0 });
assert.deepEqual(r[1], { campanha: '[SE] [FORMS] [LEAD] [HOT]', deals: 2, ganhos: 1, perdidos: 0, valor: 1500 });
console.log('✓ rd-stats por campanha');
