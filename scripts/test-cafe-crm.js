'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { sendToRDCRM, sendToRDMarketing } = require('../lib/lead-integracoes');

process.env.RD_CRM_TOKEN = 'fixture';
process.env.RD_MARKETING_TOKEN = 'fixture';
process.env.RD_CRM_STAGE_ID = 'clube-stage';
process.env.RD_CRM_CAMPAIGN_ID = 'clube-campaign';
process.env.RD_CRM_STAGE_ID_SE = 'sessao-stage';
process.env.RD_CRM_CAMPAIGN_ID_SE = 'sessao-campaign';
process.env.RD_CRM_STAGE_ID_AULA = 'aula-stage';
process.env.RD_CRM_CAMPAIGN_ID_AULA = 'aula-campaign';
delete process.env.RD_CRM_STAGE_ID_CAFE;
delete process.env.RD_CRM_CAMPAIGN_ID_CAFE;

const lead = { nome: 'Fixture', email: 'fixture@example.invalid', telefone: '11999999999', utm_source: 'instagram', utm_medium: 'publico', utm_campaign: 'cafe-novembro', utm_content: 'video' };

async function enviar(pagina, destino) {
  let enviado;
  const checkpoints = [];
  global.fetch = async (raw, options = {}) => {
    const url = new URL(raw);
    let body;
    if (url.hostname === 'api.rd.services') {
      enviado = JSON.parse(options.body);
      body = {};
    } else if (url.pathname === '/api/v1/contacts') body = { contacts: [] };
    else if (url.pathname === '/api/v1/deals' && options.method === 'POST') {
      enviado = JSON.parse(options.body);
      body = { _id: 'fixture-deal' };
    } else if (url.pathname === '/api/v1/deals/fixture-deal') {
      body = { _id: 'fixture-deal', contacts: [{ emails: [{ email: lead.email }] }] };
    } else throw new Error(`unexpected request: ${options.method} ${url.pathname}`);
    return { ok: true, status: 200, json: async () => body };
  };
  const data = { ...lead, pagina };
  const receipt = destino === 'marketing' ? await sendToRDMarketing(data) : await sendToRDCRM(data, {}, async state => checkpoints.push(state));
  assert.equal(receipt.status, 'enviado');
  if (destino !== 'marketing') assert.equal(checkpoints[0].deal_id, 'fixture-deal');
  return enviado;
}

test('Café cria oportunidade em Inscritos e campanha Café, sem herdar configuração Clube', async () => {
  const { deal, contacts } = await enviar('/cafe-com-sevilha');
  assert.equal(deal.deal_stage_id, '6a948509574ae80025eda69a');
  assert.equal(deal.campaign_id, '6a95f013f08ed30001166b7f');
  assert.equal(deal.name, '[CAFE] Fixture');
  assert.equal(contacts[0].emails[0].email, lead.email);
  assert.ok(deal.deal_custom_fields.some(field => field.value === 'cafe-novembro'));
});

test('Café respeita configuração específica CRM quando presente', async () => {
  process.env.RD_CRM_STAGE_ID_CAFE = 'cafe-stage';
  process.env.RD_CRM_CAMPAIGN_ID_CAFE = 'cafe-campaign';
  try {
    const { deal } = await enviar('/cafe-com-sevilha');
    assert.equal(deal.deal_stage_id, 'cafe-stage');
    assert.equal(deal.campaign_id, 'cafe-campaign');
  } finally {
    delete process.env.RD_CRM_STAGE_ID_CAFE;
    delete process.env.RD_CRM_CAMPAIGN_ID_CAFE;
  }
});

test('Café preserva payload Marketing para não acionar outra automação', async () => {
  assert.deepEqual(await enviar('/cafe-com-sevilha', 'marketing'), {
    event_type: 'CONVERSION', event_family: 'CDP', payload: {
      conversion_identifier: 'pre-inscricao-clube-da-performance', name: 'Fixture', email: lead.email,
      mobile_phone: lead.telefone, tags: ['pre-inscricao', 'clube-da-performance'],
      traffic_source: 'instagram', traffic_medium: 'publico', traffic_campaign: 'cafe-novembro',
      traffic_content: 'video', cf_pagina: '/cafe-com-sevilha',
    },
  });
});

test('demais ofertas preservam funil, campanha e identificação CRM', async () => {
  for (const [pagina, etapa, campanha, nome] of [
    ['/pre-inscricao-2', 'clube-stage', 'clube-campaign', 'Fixture'],
    ['/aula-gestao-operacional', 'aula-stage', 'aula-campaign', '[AULA] Fixture'],
    ['/mentoria', 'sessao-stage', 'sessao-campaign', '[SE] Fixture'],
    ['/mentoria-2', 'sessao-stage', 'sessao-campaign', '[SE] Fixture'],
    ['/formulario-consultoria', 'sessao-stage', 'sessao-campaign', '[SE] Fixture'],
  ]) {
    const { deal } = await enviar(pagina);
    assert.equal(deal.deal_stage_id, etapa, pagina);
    assert.equal(deal.campaign_id, campanha, pagina);
    assert.equal(deal.name, nome, pagina);
  }
});
