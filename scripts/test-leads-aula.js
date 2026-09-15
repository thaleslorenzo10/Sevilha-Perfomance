'use strict';
/**
 * /api/leads para a aula paga: oferta [AULA] e o par Lead + InitiateCheckout.
 *   node scripts/test-leads-aula.js
 * Sem rede: fetch é stubado e só o que iria para a CAPI é inspecionado.
 */
process.env.META_CAPI_TOKEN = 'teste';
// A trava de reenvio do LeadQualificado (lib/eventos-enviados.js) lança
// exceção sem essas duas — de propósito, fora deste teste. Com fetch
// stubado, mantê-las setadas deixa o LeadQualificado seguir até a CAPI.
process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';
delete process.env.RD_CRM_TOKEN;
delete process.env.RD_MARKETING_TOKEN;
delete process.env.MAXMIND_ACCOUNT_ID;

const chamadas = [];
global.fetch = async (url, opts = {}) => {
  chamadas.push({ url: String(url), body: opts.body ? JSON.parse(opts.body) : null });
  // A trava de reenvio (lib/eventos-enviados.js) espera um array do Supabase
  // REST; devolver isso vazio deixa o LeadQualificado passar pela trava.
  const dado = String(url).includes('supabase') ? [] : { events_received: 1 };
  return { ok: true, status: 200, json: async () => dado, text: async () => '' };
};

const handler = require('../api/leads.js');
let falhas = 0;
const ok = (c, d) => { console.log(`  ${c ? '✓' : '✗'} ${d}`); if (!c) falhas += 1; };

function req(body) {
  return { method: 'POST', body, headers: { 'user-agent': 'teste', referer: 'https://x/' }, socket: { remoteAddress: '127.0.0.1' } };
}
function res() {
  const r = { code: 0, json: null };
  r.status = c => { r.code = c; return r; };
  r.json = j => { r.dado = j; return r; };
  r.setHeader = () => r;
  return r;
}
const eventosCapi = () => chamadas.filter(c => c.url.includes('graph.facebook.com')).map(c => c.body.data[0]);

(async () => {
  console.log('\n/aula-gestao-operacional');
  chamadas.length = 0;
  await handler(req({ nome: 'Teste', email: 't@x.com', telefone: '31999990000', pagina: '/aula-gestao-operacional', colaboradores: 'De 10 a 19', cargo: 'Dono/Sócio', event_id: 'ev_1' }), res());
  const ev = eventosCapi();
  const lead = ev.find(e => e.event_name === 'Lead');
  const ic   = ev.find(e => e.event_name === 'InitiateCheckout');
  ok(lead && lead.event_id === 'ev_1', 'Lead com o event_id do formulário');
  ok(lead && lead.custom_data.content_category === 'aula' && lead.custom_data.value === 47, 'Lead com content_category aula e value 47');
  ok(ic && ic.event_id === 'ic:ev_1', 'InitiateCheckout com event_id ic:<event_id>');
  ok(ic && ic.custom_data.currency === 'BRL' && ic.custom_data.value === 47, 'InitiateCheckout com valor da aula');
  ok(ev.some(e => e.event_name === 'LeadQualificado'), 'LeadQualificado continua para 10+');

  console.log('\n/mentoria (sem regressão)');
  chamadas.length = 0;
  await handler(req({ nome: 'Teste', email: 't2@x.com', telefone: '31999990001', pagina: '/mentoria', colaboradores: 'De 5 a 9', cargo: 'Dono/Sócio', event_id: 'ev_2' }), res());
  const ev2 = eventosCapi();
  ok(!ev2.some(e => e.event_name === 'InitiateCheckout'), 'sem InitiateCheckout fora da aula');
  ok(ev2.find(e => e.event_name === 'Lead').custom_data.content_category === 'pre-inscricao', 'content_category antigo preservado');

  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
  process.exit(falhas ? 1 : 0);
})();
