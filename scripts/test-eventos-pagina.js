'use strict';

/**
 * Teste dos micro-eventos do funil (node scripts/test-eventos-pagina.js).
 *
 * O que precisa continuar verdade, e por quê:
 *   • evento vai para a tabela de eventos, NUNCA para a de visitas — misturar
 *     as duas infla o denominador da conversão;
 *   • nome de evento fora da lista é recusado — o endpoint é público;
 *   • página fora do beacon é recusada, como já era para a visita.
 */

process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';

const { tratarBeacon } = require('../lib/pageviews');

let falhas = 0;
function ok(cond, msg, extra) {
  if (cond) { console.log(`  ✓ ${msg}`); return; }
  falhas++;
  console.error(`  ✗ ${msg}${extra !== undefined ? ` — obtido: ${JSON.stringify(extra)}` : ''}`);
}

let chamadas = [];
global.fetch = async (url, opts) => {
  chamadas.push({ url: String(url), body: JSON.parse(opts.body) });
  return { ok: true, status: 201, text: async () => '' };
};

function fakeRes() {
  const r = { statusCode: null, corpo: null };
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}

const REQ = body => ({
  body,
  headers: { 'user-agent': 'Mozilla/5.0 (iPhone)', 'x-forwarded-for': '200.150.10.7' },
  socket: {},
});

(async () => {
  console.log('— evento vai para a tabela certa —');
  chamadas = [];
  let res = fakeRes();
  await tratarBeacon(REQ({ pagina: '/mentoria', evento: 'porte', valor: 'De 0 a 4', visitante: 'u_1' }), res);
  const c = chamadas[0] || {};
  ok(chamadas.length === 1, 'uma gravação', chamadas.length);
  ok(c.url?.includes('sevilha_eventos_pagina'), 'grava em sevilha_eventos_pagina', c.url);
  ok(!c.url?.includes('page_views'), 'NÃO grava na tabela de visitas — ela é o denominador da conversão');
  ok(c.body?.evento === 'porte' && c.body?.valor === 'De 0 a 4', 'evento e valor preservados', c.body);
  ok(c.body?.visitante === 'u_1', 'visitante costura os eventos da mesma pessoa', c.body?.visitante);
  ok(c.body?.ip === '200.150.10.0', 'IP truncado no último octeto (LGPD)', c.body?.ip);
  ok(res.statusCode === 201, 'responde 201', res.statusCode);

  console.log('\n— visita continua indo para a tabela de visitas —');
  chamadas = [];
  res = fakeRes();
  await tratarBeacon(REQ({ pagina: '/mentoria', query: 'utm_source=ig' }), res);
  ok(chamadas[0]?.url?.includes('sevilha_page_views'), 'sem `evento`, o corpo é visita', chamadas[0]?.url);

  console.log('\n— o endpoint é público, então recusa o que não conhece —');
  chamadas = [];
  res = fakeRes();
  await tratarBeacon(REQ({ pagina: '/mentoria', evento: 'evento_inventado' }), res);
  ok(res.statusCode === 400 && chamadas.length === 0, 'evento fora da lista não grava nada', res.statusCode);

  res = fakeRes();
  await tratarBeacon(REQ({ pagina: '/outra-pagina', evento: 'scroll', valor: '50' }), res);
  ok(res.statusCode === 400, 'página fora do beacon é recusada', res.statusCode);

  console.log('\n— bot não conta —');
  chamadas = [];
  res = fakeRes();
  await tratarBeacon({ body: { pagina: '/mentoria', evento: 'scroll', valor: '25' },
                       headers: { 'user-agent': 'Googlebot/2.1' }, socket: {} }, res);
  ok(res.statusCode === 204 && chamadas.length === 0, 'bot não grava evento', res.statusCode);

  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo verde');
  process.exit(falhas ? 1 : 0);
})();
