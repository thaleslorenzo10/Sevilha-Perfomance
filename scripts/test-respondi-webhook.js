'use strict';

/**
 * Teste do webhook do Respondi (node scripts/test-respondi-webhook.js).
 *
 * O `fetch` global é substituído, então nada sai para a rede — as asserções
 * olham o payload que teria ido para o CAPI.
 *
 * O formato exato do webhook do Respondi não está documentado publicamente
 * (help.respondi.app responde 403 a acesso automatizado), então a extração
 * percorre o JSON inteiro procurando os campos pelo conteúdo. Os dois formatos
 * plausíveis — respostas como objeto e como lista de {question, answer} —
 * estão cobertos aqui de propósito: quando o primeiro disparo real chegar,
 * basta comparar com estas fixtures.
 */

const crypto = require('crypto');

process.env.META_CAPI_TOKEN = 'token-de-teste';
process.env.RESPONDI_WEBHOOK_SECRET = 'segredo-certo';

const handler = require('../api/respondi');

/* ── Dublês ──────────────────────────────────────────────────────────── */

let chamadas = [];
global.fetch = async (url, opts) => {
  chamadas.push({ url: String(url), body: JSON.parse(opts.body) });
  return { ok: true, status: 200, json: async () => ({ events_received: 1 }) };
};

function fakeRes() {
  const r = { statusCode: null, corpo: null };
  r.setHeader = () => r;
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}

function fakeReq({ method = 'POST', body, headers = {}, url = '/api/respondi' } = {}) {
  return { method, body, headers, url, socket: { remoteAddress: '203.0.113.7' } };
}

async function chamar(opts) {
  chamadas = [];
  const res = fakeRes();
  await handler(fakeReq(opts), res);
  return { res, evento: chamadas[0]?.body?.data?.[0] || null, chamadas };
}

const sha = v => crypto.createHash('sha256').update(v).digest('hex');

/* ── Fixtures ────────────────────────────────────────────────────────── */

// Formato A: respostas como objeto, chaveadas pelo texto da pergunta.
const PAYLOAD_OBJETO = {
  id: '9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f',
  form_id: 'gvz4UKQr',
  submitted_at: '2026-08-06T12:00:00Z',
  answers: {
    'Qual seu nome?': 'Ana Souza',
    'Qual seu e-mail?': '  Ana@Exemplo.com.BR ',
    'Qual seu Whatsapp?': '55 11 91111-1111',
    'Qual o nome do Escritório de Contabilidade?': 'Souza Contabilidade',
    'Qual a sua posição no escritório Contábil?': 'Dono/Sócio',
    'Quantos colaboradores você tem?': 'De 10 a 19',
  },
  respondent_utms: {
    utm_source:   'Instagram_Feed',
    utm_medium:   'Warm',
    utm_campaign: '[SE] [LEAD] [HOT] [FASE01]',
    utm_content:  'AD31',
    fbclid:       'PAZXh0bgNhZW0BMABhZGlkAasoqVkX3d5z',
  },
};

// Formato B: respostas como lista de {question, answer}, outra chave de id.
const PAYLOAD_LISTA = {
  submission_id: 'abc-123-def',
  raw_answers: [
    { question: 'Qual seu nome?',                   answer: 'Beto Lima' },
    { question: 'Qual seu e-mail?',                 answer: 'beto@exemplo.com' },
    { question: 'Quantos colaboradores você tem?',  answer: 'Mais de 50' },
  ],
  utm: { utm_campaign: '[SE] [LEAD] [COLD] [FASE01]' },
};

function comColaboradores(base, valor) {
  const copia = JSON.parse(JSON.stringify(base));
  copia.answers['Quantos colaboradores você tem?'] = valor;
  return copia;
}

const AUTORIZADO = { 'x-webhook-secret': 'segredo-certo' };

/* ── Asserções ───────────────────────────────────────────────────────── */

let falhas = 0;
function ok(cond, msg, extra) {
  if (cond) { console.log(`  ✓ ${msg}`); return; }
  falhas++;
  console.error(`  ✗ ${msg}${extra !== undefined ? ` — obtido: ${JSON.stringify(extra)}` : ''}`);
}

async function testes() {
  console.log('— lead qualificado —');
  {
    const { res, evento, chamadas } = await chamar({ body: PAYLOAD_OBJETO, headers: AUTORIZADO });
    ok(chamadas.length === 1, 'dispara exatamente um evento', chamadas.length);
    ok(evento?.event_name === 'LeadQualificado', 'nome do evento é LeadQualificado', evento?.event_name);
    ok(evento?.event_id === PAYLOAD_OBJETO.id, 'event_id é o id da submissão (dedup de retry)', evento?.event_id);
    ok(res.statusCode === 200, 'responde 200', res.statusCode);
    ok(evento?.action_source === 'website', 'action_source website', evento?.action_source);
  }

  console.log('\n— identificadores enviados —');
  {
    const { evento, chamadas } = await chamar({ body: PAYLOAD_OBJETO, headers: AUTORIZADO });
    const ud = evento?.user_data || {};
    ok(Array.isArray(ud.em) && ud.em[0] === sha('ana@exemplo.com.br'),
       'e-mail vai hasheado, normalizado (minúsculo e sem espaços)', ud.em);
    ok(Array.isArray(ud.ph) && ud.ph[0] === sha('5511911111111'),
       'telefone vai hasheado, só dígitos com DDI', ud.ph);
    ok(ud.fbc === `fb.1.${Date.parse(PAYLOAD_OBJETO.submitted_at)}.${PAYLOAD_OBJETO.respondent_utms.fbclid}`,
       'fbc montado a partir do fbclid', ud.fbc);
    ok(ud.client_ip_address === '203.0.113.7', 'IP do respondente vai junto', ud.client_ip_address);

    const cru = JSON.stringify(chamadas[0].body);
    ok(!cru.includes('Ana@Exemplo') && !cru.toLowerCase().includes('ana@exemplo.com'),
       'e-mail em claro nunca aparece no payload');
    ok(!cru.includes('91111-1111') && !cru.includes('5511911111111'),
       'telefone em claro nunca aparece no payload');
    ok(!cru.includes('Ana Souza'), 'nome em claro nunca aparece no payload');
  }

  console.log('\n— contexto da campanha —');
  {
    const { evento } = await chamar({ body: PAYLOAD_OBJETO, headers: AUTORIZADO });
    const cd = evento?.custom_data || {};
    ok(cd.utm_campaign === '[SE] [LEAD] [HOT] [FASE01]', 'utm_campaign no custom_data', cd.utm_campaign);
    ok(cd.utm_content === 'AD31', 'utm_content (nome do anúncio) no custom_data', cd.utm_content);
    ok(cd.colaboradores === 'De 10 a 19', 'resposta de colaboradores no custom_data', cd.colaboradores);
  }

  console.log('\n— quem não dispara —');
  for (const [valor, nota] of [
    ['De 5 a 9',  'menos de 10'],
    ['De 0 a 4',  'menos de 10'],
    ['',          'sem resposta (abandono)'],
    ['6 a 10',    'faixa que cruza o corte'],
  ]) {
    const { res, chamadas } = await chamar({ body: comColaboradores(PAYLOAD_OBJETO, valor), headers: AUTORIZADO });
    ok(chamadas.length === 0 && res.statusCode === 200,
       `${JSON.stringify(valor)} não dispara e ainda responde 200 — ${nota}`,
       { eventos: chamadas.length, status: res.statusCode });
  }

  console.log('\n— formato alternativo de payload —');
  {
    const { evento, chamadas } = await chamar({ body: PAYLOAD_LISTA, headers: AUTORIZADO });
    ok(chamadas.length === 1, 'respostas em lista de {question, answer} também são lidas', chamadas.length);
    ok(evento?.event_id === 'abc-123-def', 'id da submissão lido de submission_id', evento?.event_id);
    ok(evento?.user_data?.em?.[0] === sha('beto@exemplo.com'), 'e-mail extraído da lista', evento?.user_data?.em);
  }

  console.log('\n— corpo entregue como string —');
  {
    const { chamadas } = await chamar({ body: JSON.stringify(PAYLOAD_OBJETO), headers: AUTORIZADO });
    ok(chamadas.length === 1, 'JSON em string é interpretado (Vercel nem sempre desserializa)', chamadas.length);
  }

  console.log('\n— autenticação —');
  {
    const semSegredo = await chamar({ body: PAYLOAD_OBJETO });
    ok(semSegredo.res.statusCode === 401 && semSegredo.chamadas.length === 0,
       'sem segredo → 401 e nenhum evento', semSegredo.res.statusCode);

    const errado = await chamar({ body: PAYLOAD_OBJETO, headers: { 'x-webhook-secret': 'segredo-errado' } });
    ok(errado.res.statusCode === 401 && errado.chamadas.length === 0,
       'segredo errado → 401 e nenhum evento', errado.res.statusCode);

    const naQuery = await chamar({ body: PAYLOAD_OBJETO, url: '/api/respondi?token=segredo-certo' });
    ok(naQuery.chamadas.length === 1,
       'segredo aceito na query (painel de webhook nem sempre deixa por header)', naQuery.chamadas.length);
  }

  console.log('\n— método e corpo inválido —');
  {
    const get = await chamar({ method: 'GET', headers: AUTORIZADO });
    ok(get.res.statusCode === 405, 'GET → 405', get.res.statusCode);

    const lixo = await chamar({ body: 'isso não é json', headers: AUTORIZADO });
    ok(lixo.res.statusCode === 400 && lixo.chamadas.length === 0,
       'corpo ilegível → 400 e nenhum evento', lixo.res.statusCode);
  }
}

testes()
  .catch(err => { falhas++; console.error('  ✗ exceção:', err.stack); })
  .then(() => {
    console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo verde');
    process.exit(falhas ? 1 : 0);
  });
