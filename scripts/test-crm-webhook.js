#!/usr/bin/env node
'use strict';

/**
 * Confere o webhook do RD CRM → Meta, sem rede real.
 *
 *   • token errado é recusado, e sem RD_CRM_WEBHOOK_SECRET nada passa
 *   • toda etapa vira evento, com nome derivado dela; sem etapa, nada sai
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

// Dois destinos: a API do RD CRM (contatos do deal) e o Supabase (lead original).
let crmResponde = true;
const urlsCrm = [];
global.fetch = async (u) => {
  const url = String(u);
  if (url.includes('crm.rdstation.com/api/v1/deals?')) {
    urlsCrm.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    return { ok: true, status: 200, json: async () => ({ deals: page === 1 ? dealsDoCrm : [] }) };
  }
  if (url.includes('crm.rdstation.com')) {
    urlsCrm.push(url);
    if (!crmResponde) return { ok: false, status: 404, json: async () => ({}) };
    return {
      ok: true, status: 200,
      json: async () => ({
        id: 'deal-1',
        contacts: [{ name: 'Fulano de Tal', emails: [{ email: 'f@x.com' }], phones: [{ phone: '31988887777' }] }],
      }),
    };
  }
  return {
    ok: true, status: 200,
    json: async () => ([{ telefone: '31999998888', fbclid: 'abc123', pagina: '/mentoria-2', utm_campaign: '[SE] teste', colaboradores: 'De 20 a 29', created_at: '2026-08-20T10:00:00Z' }]),
  };
};
process.env.RD_CRM_TOKEN = 'token-crm';

const { tratarWebhook, varrerCrm, indiceDeLeadIds, eventoDe } = require('../lib/crm-eventos');
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

// Lista devolvida por GET /deals na varredura.
const hoje    = new Date().toISOString();
const antigo  = new Date(Date.now() - 30 * 86400_000).toISOString();
let dealsDoCrm = [];

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

  /* Etapa sem padrão conhecido vira evento nomeado pela etapa */
  limpar();
  res = resFalso();
  await tratarWebhook(req(dealBase('Pré-inscritos')), res);
  assert.strictEqual(eventos.length, 1, 'toda etapa vira evento');
  assert.strictEqual(eventos[0].evento, 'CRMPreInscritos');

  /* Negociação sem etapa nenhuma continua sem evento */
  limpar();
  res = resFalso();
  await tratarWebhook(req({ id: 'sem-etapa', contacts: contatos }), res);
  assert.strictEqual(eventos.length, 0, 'sem etapa não há o que nomear');
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
  // O guia "Enviar um evento de CRM" exige os dois; sem eles o Meta aceita o
  // evento mas não o trata como evento de CRM.
  assert.strictEqual(eventos[0].customData.event_source, 'crm');
  assert.strictEqual(eventos[0].customData.lead_event_source, 'RD Station CRM');
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

  /* Payload real do RD não traz contato: tem que buscar na API do CRM */
  limpar();
  urlsCrm.length = 0;
  res = resFalso();
  await tratarWebhook({
    method: 'POST',
    url: '/api/crm-webhook?token=segredo-de-teste',
    headers: {},
    body: {
      event_name: 'crm_deal_updated',
      id: 'deal-9', name: '[SE] Fulano', status: 'ongoing',
      deal_stage: { id: 's1', name: 'Reunião agendada' },
      deal_pipeline: { id: 'p1', name: 'Mentoria - Clube da Performance' },
    },
  }, res);
  assert.strictEqual(eventos.length, 1, 'o evento sai mesmo sem contato no payload');
  assert.ok(urlsCrm.some(u => u.includes('/deals/deal-9')), 'foi buscar a negociação na API do CRM');
  assert.ok(eventos[0].userData.em, 'o e-mail veio da API e foi hasheado');

  /* Negociação excluída não vira evento */
  limpar();
  res = resFalso();
  await tratarWebhook({ method: 'POST', url: '/api/crm-webhook?token=segredo-de-teste', headers: {},
    body: { event_name: 'crm_deal_deleted', id: 'deal-9' } }, res);
  assert.strictEqual(eventos.length, 0, 'exclusão não manda evento');

  /* CRM fora do ar: sem contato, nada é enviado — e nada é travado */
  limpar();
  crmResponde = false;
  res = resFalso();
  await tratarWebhook({ method: 'POST', url: '/api/crm-webhook?token=segredo-de-teste', headers: {},
    body: { event_name: 'crm_deal_updated', id: 'deal-10', deal_stage: { name: 'Reunião agendada' } } }, res);
  assert.strictEqual(eventos.length, 0);
  assert.strictEqual(travados.length, 0);
  assert.strictEqual(res.corpo.motivo, 'contato ausente');
  crmResponde = true;

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

  /* ── Varredura: o caminho que não depende do plano do CRM ─────────── */
  limpar();
  urlsCrm.length = 0;
  dealsDoCrm = [
    { id: 'v1', name: '[SE] A', updated_at: hoje,   deal_stage: { name: 'Reunião agendada', deal_pipeline: { name: 'F' } },
      contacts: [{ name: 'A', emails: [{ email: 'a@x.com' }] }] },
    { id: 'v2', name: '[SE] B', updated_at: hoje,   deal_stage: { name: 'Pré-inscritos', deal_pipeline: { name: 'F' } },
      contacts: [{ name: 'B', emails: [{ email: 'b@x.com' }] }] },
    { id: 'v3', name: '[SE] C', updated_at: antigo, deal_stage: { name: 'Reunião realizada', deal_pipeline: { name: 'F' } },
      contacts: [{ name: 'C', emails: [{ email: 'c@x.com' }] }] },
    { id: 'v4', name: '[SE] D', updated_at: hoje, status: 'won', amount_total: 9600,
      deal_stage: { name: 'Fechamento', deal_pipeline: { name: 'F' } },
      contacts: [{ name: 'D', emails: [{ email: 'd@x.com' }] }] },
  ];

  let resumo = await varrerCrm();
  assert.strictEqual(resumo.enviados, 3, 'todas as etapas viram evento; só o deal fora da janela fica de fora');
  const nomes = eventos.map(e => e.evento).sort();
  assert.deepStrictEqual(nomes, ['CRMPreInscritos', 'Purchase', 'ReuniaoAgendada']);
  assert.strictEqual(eventos.find(e => e.evento === 'Purchase').customData.value, 9600);
  assert.ok(eventos.every(e => e.quando), 'o evento leva a data da mudança, não a de agora');

  // O inventário precisa mostrar a etapa que não virou evento — é ela que
  // revela um nome de funil que os padrões não conhecem.
  assert.strictEqual(resumo.por_etapa['Pré-inscritos'].evento, 'CRMPreInscritos');
  assert.strictEqual(resumo.por_etapa['Reunião agendada'].evento, 'ReuniaoAgendada');
  assert.strictEqual(resumo.por_etapa['Fechamento'].evento, 'Purchase');

  /* lead_id do formulário instantâneo entra quando o contato casa */
  jaNaTrava = new Set();
  limpar();
  const indice = indiceDeLeadIds([
    { leadId: '1234567890123456', email: 'A@X.com', telefone: '(31) 98888-7777' },
  ]);
  dealsDoCrm = [
    { id: 'v9', updated_at: hoje, deal_stage: { name: 'Reunião agendada', deal_pipeline: { name: 'F' } },
      contacts: [{ name: 'A', emails: [{ email: 'a@x.com' }] }] },
  ];
  await varrerCrm({ indiceLeadId: indice });
  assert.strictEqual(eventos[0].userData.lead_id, '1234567890123456',
    'o lead_id do Meta é a chave de correspondência de maior prioridade');

  dealsDoCrm = [
    { id: 'v1', name: '[SE] A', updated_at: hoje,   deal_stage: { name: 'Reunião agendada', deal_pipeline: { name: 'F' } },
      contacts: [{ name: 'A', emails: [{ email: 'a@x.com' }] }] },
    { id: 'v2', name: '[SE] B', updated_at: hoje,   deal_stage: { name: 'Pré-inscritos', deal_pipeline: { name: 'F' } },
      contacts: [{ name: 'B', emails: [{ email: 'b@x.com' }] }] },
    { id: 'v3', name: '[SE] C', updated_at: antigo, deal_stage: { name: 'Reunião realizada', deal_pipeline: { name: 'F' } },
      contacts: [{ name: 'C', emails: [{ email: 'c@x.com' }] }] },
    { id: 'v4', name: '[SE] D', updated_at: hoje, status: 'won', amount_total: 9600,
      deal_stage: { name: 'Fechamento', deal_pipeline: { name: 'F' } },
      contacts: [{ name: 'D', emails: [{ email: 'd@x.com' }] }] },
  ];
  limpar();
  resumo = await varrerCrm();

  /* Rodar de novo não manda nada: a trava é a mesma do webhook */
  jaNaTrava = new Set(travados.map(t => t.event_id));
  limpar();
  resumo = await varrerCrm();
  assert.strictEqual(resumo.enviados, 0, 'a segunda varredura não duplica');
  assert.strictEqual(resumo.ja_enviados, 3);
  jaNaTrava = new Set();

  /* Sem token do CRM a varredura não tenta nada */
  const tokenCrm = process.env.RD_CRM_TOKEN;
  delete process.env.RD_CRM_TOKEN;
  limpar();
  resumo = await varrerCrm();
  assert.strictEqual(resumo.ok, false);
  assert.strictEqual(eventos.length, 0);
  process.env.RD_CRM_TOKEN = tokenCrm;

  /* Sem segredo configurado, o endpoint recusa tudo */
  delete process.env.RD_CRM_WEBHOOK_SECRET;
  res = resFalso();
  await tratarWebhook(req(dealBase('Reunião agendada')), res);
  assert.strictEqual(res.statusCode, 401, 'sem segredo no ambiente nada passa');

  console.log('✓ webhook do RD CRM passou');
})();
