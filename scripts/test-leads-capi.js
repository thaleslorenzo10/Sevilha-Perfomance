'use strict';

/**
 * Teste do evento Lead enviado por /api/leads (node scripts/test-leads-capi.js).
 *
 * É um teste de caracterização: fixa o payload que hoje vai para o CAPI, para
 * que a normalização e o hash possam ser movidos para lib/capi.js sem mudar
 * nada do que o Meta recebe. Roda offline — o `fetch` é substituído e as
 * variáveis de Supabase e RD ficam sem valor de propósito, então essas
 * integrações só avisam no log e retornam.
 */

const crypto = require('crypto');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_KEY;
delete process.env.RD_MARKETING_TOKEN;
delete process.env.RD_CRM_TOKEN;
process.env.META_CAPI_TOKEN = 'token-de-teste';

const handler = require('../api/leads');

let chamadas = [];
global.fetch = async (url, opts) => {
  chamadas.push({ url: String(url), body: JSON.parse(opts.body) });
  return { ok: true, status: 200, json: async () => ({ events_received: 1, fbtrace_id: 'tr_1' }) };
};

function fakeRes() {
  const r = { statusCode: null, corpo: null };
  r.setHeader = () => r;
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}

const sha = v => crypto.createHash('sha256').update(v).digest('hex');

const LEAD = {
  nome:          'Maria Aparecida Silva',
  email:         '  Maria@Exemplo.COM ',
  telefone:      '(11) 98888-7777',
  cargo:         'Dono/Sócio',
  colaboradores: 'De 10 a 19',
  utm_source:    'Instagram_Feed',
  utm_campaign:  '[CP] Clube da Performance',
  utm_content:   'AD07',
  fbclid:        'fbclid123',
  event_id:      'ev_fixo_para_o_teste',
  pagina:        '/pre-inscricao',
  page_url:      'https://sevilhaperformance.com.br/pre-inscricao',
};

let falhas = 0;
function ok(cond, msg, extra) {
  if (cond) { console.log(`  ✓ ${msg}`); return; }
  falhas++;
  console.error(`  ✗ ${msg}${extra !== undefined ? ` — obtido: ${JSON.stringify(extra)}` : ''}`);
}

(async () => {
  const res = fakeRes();
  await handler({
    method: 'POST', body: LEAD, headers: { 'user-agent': 'Mozilla/5.0 (teste)' },
    socket: { remoteAddress: '198.51.100.9' },
  }, res);

  const capi = chamadas.find(c => c.url.includes('graph.facebook.com'));
  const evento = capi?.body?.data?.[0];
  const ud = evento?.user_data || {};
  const cd = evento?.custom_data || {};

  console.log('— evento —');
  ok(chamadas.length === 1, 'só o CAPI é chamado (Supabase e RD sem token)', chamadas.length);
  ok(evento?.event_name === 'Lead', 'event_name é Lead', evento?.event_name);
  ok(evento?.event_id === LEAD.event_id, 'event_id do formulário é preservado', evento?.event_id);
  ok(evento?.action_source === 'website', 'action_source website', evento?.action_source);
  ok(evento?.event_source_url === LEAD.page_url, 'event_source_url é a página do formulário', evento?.event_source_url);

  console.log('\n— identificadores hasheados —');
  ok(ud.em?.[0] === sha('maria@exemplo.com'), 'e-mail normalizado e hasheado', ud.em);
  ok(ud.ph?.[0] === sha('5511988887777'), 'telefone com DDI, só dígitos, hasheado', ud.ph);
  ok(ud.fn?.[0] === sha('maria'), 'primeiro nome hasheado', ud.fn);
  ok(ud.ln?.[0] === sha('silva'), 'último sobrenome hasheado', ud.ln);
  ok(ud.country?.[0] === sha('br'), 'país hasheado', ud.country);
  ok(ud.fbc === `fb.1.${evento.event_time * 1000}.fbclid123`, 'fbc derivado do fbclid', ud.fbc);
  ok(ud.client_ip_address === '198.51.100.9', 'IP do cliente', ud.client_ip_address);
  ok(ud.client_user_agent === 'Mozilla/5.0 (teste)', 'user agent', ud.client_user_agent);

  console.log('\n— contexto —');
  ok(cd.content_name === '/pre-inscricao', 'content_name é a página', cd.content_name);
  ok(cd.utm_campaign === LEAD.utm_campaign, 'utm_campaign no custom_data', cd.utm_campaign);
  ok(cd.utm_content === 'AD07', 'utm_content no custom_data', cd.utm_content);

  console.log('\n— nada de PII em claro —');
  const cru = JSON.stringify(capi.body);
  ok(!cru.toLowerCase().includes('maria@exemplo'), 'e-mail nunca em claro');
  ok(!cru.includes('98888-7777') && !cru.includes('5511988887777'), 'telefone nunca em claro');
  ok(!cru.includes('Maria Aparecida'), 'nome nunca em claro');

  console.log('\n— resposta —');
  ok(res.statusCode === 200 && res.corpo?.ok === true, 'responde 200 ok', res.corpo);

  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo verde');
  process.exit(falhas ? 1 : 0);
})();
