const assert = require('node:assert/strict');
const fs = require('node:fs');
const workflow = JSON.parse(fs.readFileSync('docs/whatsapp-aula-2026-10-06-workflow.json', 'utf8'));
for (const node of workflow.nodes) {
  const expression = node.parameters.jsonBody;
  if (expression?.startsWith('={{')) {
    assert.equal(expression.indexOf('}}'), expression.length - 2, `${node.name}: premature n8n expression delimiter`);
  }
}
const code = workflow.nodes.find(n => n.name === 'Conferir recusa e validade').parameters.jsCode;
const run = new Function('$input', '$', code);
function check({text = '', global = [], http = 200, expires = Date.now() + 60000} = {}) {
  const job = {channel: 'private', expires_at: new Date(expires).toISOString()};
  const history = {statusCode: 200, body: {messages: {pages: 1, records: [{key: {fromMe: false}, message: {conversation: text}}]}}};
  const input = {all: () => [{json: {statusCode: http, body: global}}]};
  const lookup = name => ({itemMatching: () => ({json: name === 'Um por vez' ? job : history})});
  return run(input, lookup)[0].json;
}
assert.equal(check().allow, true);
assert.equal(check({text: 'Não quero receber mais mensagens'}).allow, false);
assert.equal(check({text: 'SAIR'}).allow, false);
assert.equal(check({global: [{origem: 'self-check'}]}).allow, false);
assert.equal(check({http: 500}).allow, false);
assert.equal(check({expires: Date.now() - 1}).allow, false);
assert.match(workflow.nodes.find(n => n.name === 'Enviar lembrete').parameters.jsonBody, /expired_before_post/);
console.log('WhatsApp guards: passou; nenhuma rede ou mensagem enviada');
