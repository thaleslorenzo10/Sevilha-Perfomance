const assert = require('node:assert/strict');
const fs = require('node:fs');
const w = JSON.parse(fs.readFileSync('docs/whatsapp-aula-recuperacao-2026-10-06-workflow.json'));
const run = new Function('$input', '$', w.nodes.find(n => n.name === 'Conferir recusa e validade').parameters.jsCode);
function check({eligible = true, status = 200, records = [], optout = [], expiry = Date.now() + 60000} = {}) {
  const job = {channel: 'private', expires_at: new Date(expiry).toISOString()};
  const nodes = {'Um por vez': job, Historico: {statusCode: 200, body: {messages: {pages: 1, records}}}, 'Recusa atual': {statusCode: 200, body: optout}};
  return run({all: () => [{json: {statusCode: status, body: [{eligible}]}}]}, name => ({itemMatching: () => ({json: nodes[name]})}))[0].json;
}
assert.equal(check().allow, true);
assert.equal(check({eligible: false}).allow, false);
assert.equal(check({status: 500}).allow, false);
assert.equal(check({expiry: Date.now() - 1}).allow, false);
assert.equal(check({optout: [{}]}).allow, false);
assert.equal(check({records: [{key: {fromMe: false}, message: {conversation: 'SAIR'}}]}).allow, false);
assert.equal(check({records: [{key: {fromMe: true}, message: {conversation: 'aula_20261006_recuperacao'}}]}).allow, false);
for (const n of w.nodes) {
  const expression = n.parameters.jsonBody;
  if (expression?.startsWith('={{')) assert.equal(expression.indexOf('}}'), expression.length - 2, n.name);
}
assert.match(w.nodes.find(n => n.name === 'Enviar lembrete').parameters.jsonBody, /expired_before_post/);
console.log('Recovery guards passed; no network or sends.');
