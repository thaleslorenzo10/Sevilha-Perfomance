#!/usr/bin/env node
'use strict';

/**
 * Confere o webhook do RD CRM → Meta, sem rede real.
 *
 *   • token errado é recusado, e sem RD_CRM_WEBHOOK_SECRET nada passa
 *   • etapa que não é marco de funil não vira evento
 *   • reunião agendada, realizada e negócio ganho viram eventos distintos
 *   • ganho leva valor e moeda
 *   • a mesma negociação não manda o mesmo evento duas vezes
 *   • falha do Meta não entra na trava — o CRM reenvia e nós tentamos de novo
 *
 * Rode com: node scripts/test-crm-webhook.js
 */

const assert = require('assert');
const Module = require('module');

process.env.RD_CRM_WEBHOOK_SECRET = 'segredo-de-teste';
process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';
process.env.META_CAPI_TOKEN = 'token';

const eventos  = [];
const travados = [];
let jaNaTrava  = new Set();
let metaAceita = true;

const original = Module._load;
Module._load = function (pedido, pai, isMain) {
  if (pedido === './capi') {
    const real = original.call(this, pedido, pai, isMain);
    return {
      ...real,
      enviarEvento: async (e) => {
        eventos.push(e);
        return metaAceita ? { ok: true, recebidos: 1 } : { ok: false, erro: 'meta recusou' };
      },
    };
  }
  if (pedido === './eventos-enviados') {
    return {
      jaEnviados:     async (ids) => new Set(ids.filter(i => jaNaTrava.has(i))),
      marcarEnviados: async (regs) => { travados.push(...regs); },
    };
  }
  return original.call(this, pedido, pai, isMain);
};

// O único fetch que sobra é a busca do lead original no Supabase.
global.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ([{ telefone: '31999998888', fbclid: 'abc123', pagina: '/mentoria-2', utm_campaign: '[SE] teste', colaboradores: 'De 20 a 29', created_at: '2026-08-20T10:00:00Z' }]),
});

const { tratarWebhook, eventoDe } = require('../lib/crm-eventos');
Module._load = original;

function resFalso() {
  const r = { statusCode: null, corpo: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json   = (b) => { r.corpo = b; return r; };
  r.end    = () => r;
  return r;
}

function req(deal, token = 'segredo-de-teste') {
  return {
    method: 'POST',
    url: `/api/crm-webhook?token=${token}`,
    headers: {},
    body: { deal },
  };
}

const contatos = [{ name: 'Fulano de Tal', emails: [{ email: 'f@x.com' }], phones: [{ phone: '31988887777' }] }];
const dealBase = (etapa, extra = {}) => ({
  id: 'deal-1',
  name: '[SE] Fulano',
  deal_stage: { name: etapa, deal_pipeline: { name: 'Mentoria - Clube da Performance' } },
  contacts: contatos,
  ...extra,
});

function limpar() { eventos.length = 0; travados.length = 0; }

(async () => {
  /* Token errado não passa */
  let res = resFalso();
  await tratarWebhook(req(dealBase('Reunião agendada'), 'errado'), res);
  assert.strictEqual(res.statusCode, 401, 'token errado é recusado');
  assert.strictEqual(eventos.length, 0);

  /* Etapa comum não vira evento */
  limpar();
  res = resFalso();
  await tratarWebhook(req(dealBase('Pré-inscritos')), res);
  assert.strictEqual(eventos.length, 0, 'etapa sem marco de funil não manda nada');
  assert.strictEqual(res.corpo.ignorado, true);

  /* Reunião agendada */
  limpar();
  res = resFalso();
  await tratarWebhook(req(dealBase('Reunião agendada')), res);
  assert.strictEqual(eventos.length, 1);
  assert.strictEqual(eventos[0].evento, 'ReuniaoAgendada');
  assert.strictEqual(eventos[0].actionSource, 'system_generated');
  assert.ok(eventos[0].userData.em, 'e-mail vai hasheado');
  assert.ok(eventos[0].userData.fbc, 'o fbclid do lead original entra como fbc');
  assert.strictEqual(eventos[0].customData.pagina, '/mentoria-2');
  assert.strictEqual(travados.length, 1);

  /* Mesma negociação, mesma etapa, de novo → trava segura */
  jaNaTrava = new Set(travados.map(t => t.event_id));
  limpar();
  res = resFalso();
  await tratarWebhook(req(dealBase('Reunião agendada')), res);
  assert.strictEqual(eventos.length, 0, 'não reenvia o mesmo marco da mesma negociação');
  assert.strictEqual(res.corpo.duplicado, true);
  jaNaTrava = new Set();

  /* Reunião realizada é outro evento */
  limpar();
  res = resFalso();
  await tratarWebhook(req(dealBase('Reunião realizada')), res);
  assert.strictEqual(eventos[0].evento, 'ReuniaoRealizada');

  /* Ganho vira Purchase com valor, mesmo com nome de etapa qualquer */
  limpar();
  res = resFalso();
  await tratarWebhook(req(dealBase('Negociação', { win: true, amount_total: 4800 })), res);
  assert.strictEqual(eventos[0].evento, 'Purchase');
  assert.strictEqual(eventos[0].customData.value, 4800);
  assert.strictEqual(eventos[0].customData.currency, 'BRL');

  /* Sem contato não há como casar com ninguém */
  limpar();
  res = resFalso();
  await tratarWebhook(req({ ...dealBase('Reunião agendada'), contacts: [] }), res);
  assert.strictEqual(eventos.length, 0);
  assert.strictEqual(res.corpo.motivo, 'contato ausente');

  /* Meta recusa → não trava, para o reenvio do CRM ter chance */
  limpar();
  metaAceita = false;
  res = resFalso();
  await tratarWebhook(req(dealBase('Reunião agendada', { id: 'deal-2' })), res);
  assert.strictEqual(eventos.length, 1, 'tentou');
  assert.strictEqual(travados.length, 0, 'falha não entra na trava');
  metaAceita = true;

  /* Mapa por ambiente nomeia etapa que os padrões não pegam */
  process.env.RD_CRM_EVENTOS = JSON.stringify({ 'Proposta enviada': 'PropostaEnviada' });
  assert.strictEqual(eventoDe({ etapa: 'Proposta enviada' }), 'PropostaEnviada');
  delete process.env.RD_CRM_EVENTOS;

  /* Sem segredo configurado, o endpoint recusa tudo */
  delete process.env.RD_CRM_WEBHOOK_SECRET;
  res = resFalso();
  await tratarWebhook(req(dealBase('Reunião agendada')), res);
  assert.strictEqual(res.statusCode, 401, 'sem segredo no ambiente nada passa');

  console.log('✓ webhook do RD CRM passou');
})();
