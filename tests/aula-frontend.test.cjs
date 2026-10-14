const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function browser(now = '2026-10-14T12:00:00Z') {
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, {
      dataset: { destino: 'kiwify', textos: 'aula' }, style: {}, elements: {},
      classList: { remove() {}, add() {}, contains() { return false; } },
      addEventListener() {}, scrollIntoView() {},
    });
    return elements.get(id);
  };
  const RealDate = Date;
  const context = {
    window: { AULA: { data: '2026-10-27', hora: '19:30', encerramento: '2026-10-27T17:30:00-03:00', checkoutUrl: 'https://pay.kiwify.com.br/cGv131E' }, location: { search: '?utm_source=meta&utm_campaign=turma27', href: 'initial' } },
    document: { getElementById: el, querySelectorAll: () => [], addEventListener() {}, body: { style: {} } },
    sessionStorage: { getItem() { throw new Error('blocked'); } },
    Date: class extends RealDate { static now() { return new RealDate(now).getTime(); } },
    URL, URLSearchParams, console, setInterval() {}, setTimeout() { throw new Error('Unexpected redirect'); },
    FormData: class { *[Symbol.iterator]() { yield ['event_id', 'ev_test']; yield ['email', 'test@example.com']; } },
  };
  vm.createContext(context);
  vm.runInContext(read('aula-gestao-operacional/aula.js'), context);
  vm.runInContext(read('aula-gestao-operacional/form-steps.js'), context);
  return { context, el };
}

test('checkout preserves lead event_id and URL UTMs when session storage is blocked', () => {
  const { context } = browser();
  const url = new URL(context.window.SP_urlCheckout({ event_id: 'ev_test', email: 'test@example.com' }));
  assert.equal(url.origin + url.pathname, 'https://pay.kiwify.com.br/cGv131E');
  assert.equal(url.searchParams.get('sck'), 'ev_test');
  assert.equal(url.searchParams.get('utm_campaign'), 'turma27');
});

test('failed persistence leaves visitor on form with retry enabled', () => {
  const { context, el } = browser();
  context.window.SP_handleSubmit = (_event, _form, _success, error) => error();
  context.window.submitForm({ preventDefault() {} });
  assert.equal(context.window.location.href, 'initial');
  assert.equal(el('submit-btn').disabled, false);
  assert.equal(el('submit-btn').textContent, 'Tentar novamente');
});

test('inscriptions close exactly two hours before class in Brasilia', () => {
  assert.equal(browser('2026-10-27T20:29:59Z').context.window.SP_inscricoesEncerradas(), false);
  assert.equal(browser('2026-10-27T20:30:00Z').context.window.SP_inscricoesEncerradas(), true);
});
