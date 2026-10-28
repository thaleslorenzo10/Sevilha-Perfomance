'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { montarMeta } = require('../api/meta');

test('filhos de campanhas com nomes idênticos preservam IDs de campanha distintos', async () => {
  const tokenAnterior = process.env.META_ACCESS_TOKEN;
  const fetchAnterior = global.fetch;
  const consultas = [];
  process.env.META_ACCESS_TOKEN = 'fixture-sem-acesso';
  global.fetch = async raw => {
    const q = new URL(raw).searchParams;
    consultas.push(q);
    const nivel = q.get('level');
    const data = ['101', '202'].map((campaign_id, i) => ({
      campaign_id, date_start:'2026-10-05', campaign_name: '[SE] Campanha com mesmo nome',
      adset_id: `conjunto-${i}`, adset_name: 'Público com mesmo nome',
      ad_id: `anuncio-${i}`, ad_name: 'Criativo com mesmo nome', spend: i ? '90' : '10',
    }));
    return { json: async () => ({ data: q.has('breakdowns') ? [] : ['ad','adset','campaign'].includes(nivel) ? data : [] }) };
  };
  try {
    const p = await montarMeta('2026-10-01', '2026-10-27');
    for (const campo of ['conjuntos', 'anuncios']) {
      assert.deepEqual(new Set(p[campo].map(l => l.campaign_id)), new Set(['101', '202']));
      assert.equal(p[campo].filter(l => l.campaign_id === '101').reduce((s,l)=>s+l.spend,0), 10);
      assert.ok(p[campo].every(l => l.campanha === '[SE] Campanha com mesmo nome'));
      assert.ok(p[campo].every(l => l.nome && l.id));
    }
    assert.deepEqual(p.serie_campanhas.filter(l=>l.campaign_id==='101'),[{campaign_id:'101',date_start:'2026-10-05',spend:10,leads:0}]);
    assert.equal(p.serie_campanhas.find(l=>l.campaign_id==='202').spend,90);
    for (const nivel of ['ad', 'adset']) assert.ok(consultas.find(q=>q.get('level')===nivel).get('fields').split(',').includes('campaign_id'));
    assert.equal(consultas.length,5,'continua com as mesmas cinco consultas');
  } finally {
    global.fetch = fetchAnterior;
    if (tokenAnterior === undefined) delete process.env.META_ACCESS_TOKEN;
    else process.env.META_ACCESS_TOKEN = tokenAnterior;
  }
});
