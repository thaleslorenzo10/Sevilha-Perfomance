'use strict';
const assert = require('node:assert/strict');
const { sendToRDCRM } = require('../lib/lead-integracoes');
process.env.RD_CRM_TOKEN = 'fixture';
process.env.RD_CRM_STAGE_ID_SE = 'stage-fixture';
let errors;
let error;
let links = [];
let posts = 0;
global.fetch = async (raw, options = {}) => {
  const url = new URL(raw);
  let body;
  if (url.pathname.endsWith('/contacts') && !options.method) body = { contacts: [{ _id: 'contact-fixture' }] };
  else if (url.pathname.endsWith('/contacts/contact-fixture')) {
    if (options.method === 'PUT') {
      const contact = JSON.parse(options.body).contact;
      if (contact.deal_ids) links = contact.deal_ids;
    }
    body = { _id: 'contact-fixture', deal_ids: links };
  } else {
    assert.equal(options.method, 'POST');
    posts++;
    body = { ...(error || (errors && Object.keys(errors).length) ? {} : { _id: 'deal-fixture' }), errors, error };
  }
  return { ok: true, status: 200, json: async () => body };
};
(async () => {
  for (const [shape, expected] of [[{}, 'enviado'], [[], 'enviado'], [{ campo: ['invalido'] }, 'falhou'], [['invalido'], 'falhou'], ['invalido', 'falhou']]) {
    errors = shape; error = undefined; links = []; posts = 0;
    const checkpoints = [];
    const r = await sendToRDCRM({ pagina: '/formulario-consultoria', email: 'fixture@example.invalid', nome: 'Fixture' }, {}, async state => checkpoints.push(state));
    assert.equal(r.status, expected);
    assert.equal(posts, 1);
    if (expected === 'enviado') {
      assert.equal(r.deal_id, 'deal-fixture');
      assert.equal(checkpoints[0].deal_id, 'deal-fixture');
      assert.deepEqual(links, ['deal-fixture']);
    }
  }
  errors = {}; error = {};
  const rejected = await sendToRDCRM({ pagina: '/formulario-consultoria', email: 'fixture@example.invalid' });
  assert.equal(rejected.status, 'falhou', 'error presente continua recusado mesmo se vazio');
  process.stdout.write('consultoria CRM: errors vazio aceita sucesso; erros reais continuam recusados\n');
})().catch(e => { process.stderr.write(`${e.stack || e.message}\n`); process.exitCode = 1; });
