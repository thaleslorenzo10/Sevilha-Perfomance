'use strict';
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';
process.env.RD_MARKETING_WEBHOOK_SECRET = 'segredo';
process.env.RESPONDI_WEBHOOK_SECRET = 'outro';

const { leadDe, responder } = require('../lib/rd-webhook');

const contato = {
  uuid: 'abc-123', name: 'Maria', email: 'maria@x.com', mobile_phone: '+55 11 99999-0000',
  last_conversion: {
    content: { identificador: 'cafe-com-sevilha', traffic_source: 'Instagram_Feed', traffic_campaign: '[CAFÉ COM SEVILHA] COLD',
               traffic_content: 'AD 02', cf_numero_de_colaboradores: 'De 10 a 19', cf_cargo: 'Sócio' },
  },
};
const lead = leadDe(contato);
assert.equal(lead.pagina, 'rd:cafe-com-sevilha');
assert.equal(lead.event_id, 'rd:abc-123');
assert.equal(lead.utm_source, 'Instagram_Feed');
assert.equal(lead.utm_campaign, '[CAFÉ COM SEVILHA] COLD');
assert.equal(lead.colaboradores, 'De 10 a 19');
assert.equal(lead.cargo, 'Sócio');
assert.equal(lead.telefone, '+55 11 99999-0000');
assert.equal(leadDe({ email: 'x@x.com', last_conversion: { content: { identificador: 'a' } } }).event_id.startsWith('rd:'), true, 'sem uuid deriva do e-mail');

function resFalso() { const r = { statusCode: null, corpo: null }; r.status = c => { r.statusCode = c; return r; }; r.json = b => { r.corpo = b; return r; }; r.end = () => r; return r; }
const chamadas = [];
let existente = false;
global.fetch = async (url, opts = {}) => {
  chamadas.push({ url: String(url), metodo: opts.method || 'GET', corpo: opts.body });
  if (!opts.method) return { ok: true, json: async () => (existente ? [{ id: 1 }] : []) };
  return { ok: true, status: 201, text: async () => '' };
};

(async () => {
  let res = resFalso();
  await responder({ method: 'POST', url: '/api/respondi?fonte=rd-marketing&token=errado', body: { leads: [contato] } }, res);
  assert.equal(res.statusCode, 401);

  res = resFalso();
  await responder({ method: 'POST', url: '/api/respondi?fonte=rd-marketing&token=segredo', body: JSON.stringify({ leads: [contato] }) }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.corpo, { ok: true, recebidos: 1, gravados: 1, ignorados: 0 });
  assert.equal(chamadas.filter(c => c.metodo === 'POST').length, 1);
  assert.ok(chamadas[0].url.includes('event_id=eq.rd%3Aabc-123'));
  assert.equal(JSON.parse(chamadas[1].corpo).pagina, 'rd:cafe-com-sevilha');

  existente = true; res = resFalso();
  await responder({ method: 'POST', url: '/api/respondi?fonte=rd-marketing&token=segredo', body: { leads: [contato] } }, res);
  assert.deepEqual(res.corpo, { ok: true, recebidos: 1, gravados: 0, ignorados: 1 }, 'reenvio do RD não duplica');
  console.log('✓ rd-webhook');
})();
