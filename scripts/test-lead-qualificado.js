#!/usr/bin/env node
'use strict';

/**
 * Confere o LeadQualificado disparado por /api/leads, sem rede real.
 *
 *   • dispara só com 10 ou mais colaboradores
 *   • não dispara duas vezes para o mesmo contato (trava no Supabase)
 *   • não marca a trava quando o Meta recusa — a varredura de 4h precisa
 *     poder tentar de novo
 *   • usa prefixo próprio de event_id, para não colidir com o do Respondi
 *
 * Rode com: node scripts/test-lead-qualificado.js
 */

const assert = require('assert');
const Module = require('module');

process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';
process.env.META_CAPI_TOKEN = 'token';

/* ── Dublês das dependências de rede ───────────────────────────────── */

const eventos = [];       // eventos enviados ao Meta
const travados = [];      // event_ids gravados na trava
let jaNaTrava = new Set();
let metaAceita = true;

const original = Module._load;
Module._load = function (pedido, pai, isMain) {
  if (pedido === '../lib/capi') {
    const real = original.call(this, pedido, pai, isMain);
    return {
      ...real,
      enviarEvento: async (e) => {
        eventos.push(e);
        return metaAceita
          ? { ok: true, recebidos: 1, fbtrace_id: 'x' }
          : { ok: false, erro: 'meta recusou' };
      },
    };
  }
  if (pedido === '../lib/eventos-enviados') {
    return {
      jaEnviados: async (ids) => new Set(ids.filter(i => jaNaTrava.has(i))),
      marcarEnviados: async (regs) => { travados.push(...regs); },
    };
  }
  if (pedido === '../lib/sheets-write') return { gravarLead: async () => ({ ok: false }) };
  return original.call(this, pedido, pai, isMain);
};

// fetch só é chamado pelo Supabase e pelo RD; nenhum deles importa aqui.
global.fetch = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' });

const handler = require('../api/leads');
Module._load = original;

/* ── Helpers ───────────────────────────────────────────────────────── */

function resFalso() {
  const r = { statusCode: null, corpo: null };
  r.setHeader = () => {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}

function req(body) {
  return {
    method: 'POST',
    headers: { 'user-agent': 'teste', referer: 'https://exemplo/mentoria' },
    socket: {},
    body: { nome: 'Fulano', email: 'f@x.com', telefone: '31999998888', pagina: '/mentoria', ...body },
  };
}

function limpar() { eventos.length = 0; travados.length = 0; }

(async () => {
  /* 10+ colaboradores → dispara */
  limpar();
  let res = resFalso();
  await handler(req({ colaboradores: 'De 20 a 29', cargo: 'Dono/Sócio' }), res);

  const nomes = eventos.map(e => e.evento);
  assert.ok(nomes.includes('Lead'), 'Lead continua saindo');
  assert.ok(nomes.includes('LeadQualificado'), '10+ colaboradores dispara LeadQualificado');
  assert.strictEqual(res.corpo.lead_qualificado, true, 'a resposta informa que qualificou');

  const q = eventos.find(e => e.evento === 'LeadQualificado');
  assert.ok(q.eventId.startsWith('sessao-estrategica:'),
    'prefixo próprio, para não colidir com o event_id do Respondi');
  assert.strictEqual(q.customData.colaboradores, 'De 20 a 29');
  assert.strictEqual(travados.length, 1, 'grava na trava depois do Meta aceitar');
  assert.strictEqual(travados[0].fonte, 'api-leads:/mentoria');

  /* Menos de 10 → não dispara */
  limpar();
  res = resFalso();
  await handler(req({ colaboradores: 'De 5 a 9' }), res);
  assert.ok(!eventos.some(e => e.evento === 'LeadQualificado'), 'abaixo de 10 não qualifica');
  assert.strictEqual(res.corpo.lead_qualificado, false);
  assert.strictEqual(travados.length, 0);

  /* Sem resposta de porte → não dispara */
  limpar();
  res = resFalso();
  await handler(req({ colaboradores: '' }), res);
  assert.ok(!eventos.some(e => e.evento === 'LeadQualificado'), 'sem porte informado não qualifica');

  /* Mesmo contato de novo → trava impede o segundo envio */
  limpar();
  jaNaTrava = new Set([require('../lib/capi').eventIdPorContato('sessao-estrategica', 'f@x.com')]);
  res = resFalso();
  await handler(req({ colaboradores: 'Mais de 50' }), res);
  assert.ok(!eventos.some(e => e.evento === 'LeadQualificado'), 'não reenvia o mesmo contato');
  assert.strictEqual(travados.length, 0);
  jaNaTrava = new Set();

  /* Meta recusa → não marca a trava, para a varredura tentar de novo */
  limpar();
  metaAceita = false;
  res = resFalso();
  await handler(req({ email: 'outro@x.com', colaboradores: 'De 10 a 19' }), res);
  assert.ok(eventos.some(e => e.evento === 'LeadQualificado'), 'tentou enviar');
  assert.strictEqual(travados.length, 0, 'falha não entra na trava');
  assert.strictEqual(res.corpo.lead_qualificado, false);
  metaAceita = true;

  console.log('✓ LeadQualificado passou');
})();
