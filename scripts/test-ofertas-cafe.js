'use strict';

/**
 * A página do Café precisa cair na oferta [CAFÉ] em /api/leads
 * (node scripts/test-ofertas-cafe.js).
 *
 * Fora do mapa OFERTAS, o lead cai no padrão e entra no funil do Clube da
 * Performance — sem erro nenhum. Este teste posta um lead com
 * pagina='/cafe-com-sevilha' com os tokens do RD "ligados" (valor falso) e
 * confere, nos corpos que sairiam para o RD Marketing e para o RD CRM, o
 * identificador de conversão, a marca no nome do deal e a etapa vinda da
 * variável de ambiente própria do Café. Roda offline: o fetch é substituído.
 */

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_KEY;
delete process.env.META_CAPI_TOKEN;
process.env.RD_MARKETING_TOKEN   = 'rdm-teste';
process.env.RD_CRM_TOKEN         = 'crm-teste';
process.env.RD_CRM_STAGE_ID_CAFE    = 'stage-cafe-teste';
process.env.RD_CRM_CAMPAIGN_ID_CAFE = 'campanha-cafe-teste';

const handler = require('../api/leads');

const corpos = [];
global.fetch = async (url, opts) => {
  if (String(url).includes('geolite.info')) return { ok: false, status: 404, json: async () => ({}) };
  if (opts && opts.body) corpos.push({ url: String(url), body: String(opts.body) });
  return { ok: true, status: 200, json: async () => ({ id: 'deal-1', contacts: [] }), text: async () => '' };
};

function fakeRes() {
  const r = { statusCode: null, corpo: null };
  r.setHeader = () => r;
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}

let falhas = 0;
function ok(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); return; }
  falhas++;
  console.error(`  ✗ ${msg}`);
}

async function postar(pagina) {
  corpos.length = 0;
  const res = fakeRes();
  await handler({
    method: 'POST',
    headers: { 'user-agent': 'teste', 'x-forwarded-for': '203.0.113.9' },
    socket: { remoteAddress: '203.0.113.9' },
    body: { nome: 'Maria Teste', email: 'maria@example.com', telefone: '(31) 99999-0000',
            cargo: 'Dono/Sócio', colaboradores: 'De 10 a 19', pagina, event_id: 'ev_cafe_1' },
  }, res);
  ok(res.statusCode === 200, `${pagina} → 200`);
  const todos = corpos.map(c => c.body).join('\n');
  return { todos, rdm: corpos.find(c => c.url.includes('api.rd.services/platform/conversions')) };
}

(async () => {
  console.log('\n/cafe-com-sevilha');
  const cafe = await postar('/cafe-com-sevilha');
  ok(!!cafe.rdm && cafe.rdm.body.includes('"conversion_identifier":"cafe-com-sevilha-site"'),
     'RD Marketing recebe o identificador cafe-com-sevilha-site (não o da LP antiga)');
  ok(cafe.todos.includes('"name":"[CAFÉ] Maria Teste"'), 'deal do CRM nasce marcado [CAFÉ]');
  ok(cafe.todos.includes('"deal_stage_id":"stage-cafe-teste"'), 'etapa vem de RD_CRM_STAGE_ID_CAFE');
  ok(cafe.todos.includes('"campaign_id":"campanha-cafe-teste"'), 'campanha vem de RD_CRM_CAMPAIGN_ID_CAFE');

  console.log('\n/mentoria (não pode mudar)');
  const se = await postar('/mentoria');
  ok(!!se.rdm && se.rdm.body.includes('"conversion_identifier":"sessao-estrategica-consultoria"'), 'Sessão Estratégica continua na conversão dela');
  ok(se.todos.includes('"name":"[SE] Maria Teste"'), 'deal [SE] intacto');

  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo verde');
  process.exit(falhas ? 1 : 0);
})();
