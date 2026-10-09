'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/form-steps.js'), 'utf8');

function populateFields(html, nodes, form) {
  form.elements = {};
  for (const match of html.matchAll(/<input[^>]*id="([^"]+)"[^>]*name="([^"]+)"[^>]*>/g)) {
    const field = nodes[match[1]];
    field.name = match[2];
    field.dispatchEvent = () => form.trigger('change', { target: field });
    field.value = (match[0].match(/value="([^"]+)"/) || [])[1] || '';
    field.maxLength = Number((match[0].match(/maxlength="(\d+)"/) || [])[1] || -1);
    if (/type="radio"/.test(match[0])) {
      form.elements[field.name] ??= [];
      form.elements[field.name].push(field);
    } else form.elements[field.name] = field;
  }
  for (const name of ['colaboradores', 'cargo']) {
    Object.defineProperty(form.elements[name], 'value', {
      get() { return this.find(field => field.checked)?.value || ''; },
    });
  }
}

function createPage(page) {
  const html = fs.readFileSync(path.join(__dirname, '..', page, 'index.html'), 'utf8');
  const nodes = {}, events = [], requests = [];
  const document = { body: { style: {} }, activeElement: null, addEventListener() {} };
  function node(id) {
    const handlers = {}, classes = new Set(), attributes = {};
    return {
      id, value: '', hidden: false, disabled: false, style: {}, validity: { valid: true },
      classList: {
        add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
        toggle(c, on) { const active = on === undefined ? !classes.has(c) : on; if (active) classes.add(c); else classes.delete(c); return active; },
      },
      setAttribute(k, v) { attributes[k] = v; },
      getAttribute(k) { return attributes[k]; },
      removeAttribute(k) { delete attributes[k]; },
      focus() { document.activeElement = this; },
      addEventListener(k, fn) { handlers[k] = fn; },
      trigger(k, extra = {}) { handlers[k]?.call(this, { target: this, preventDefault() {}, ...extra }); },
      getClientRects: () => [1], closest: () => null, matches: () => true,
    };
  }
  for (const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {
    nodes[match[1]] = node(match[1]);
    nodes[match[1]].hidden = /\bhidden\b/.test(match[0]);
  }
  const form = nodes['sessao-form'];
  populateFields(html, nodes, form);
  form.querySelectorAll = selector => selector === '[aria-invalid]'
    ? Object.values(nodes).filter(n => n.getAttribute('aria-invalid'))
    : form.elements.colaboradores;
  nodes['modal-overlay'].querySelectorAll = () => [nodes['submit-btn']];
  const window = {
    SP_marcar: (name, value) => events.push([name, value]),
    SP_handleSubmit(_event, sent, success, error) {
      requests.push(sent);
      nodes['submit-btn'].disabled = true;
      window.complete = success;
      window.fail = error;
    },
  };
  document.getElementById = id => nodes[id];
  document.querySelectorAll = () => [];
  vm.runInNewContext(source, { document, window });
  return { nodes, form, window, document, events, requests };
}

function navigation(page) {
  const p = createPage(page);
  p.next = () => p.nodes['avancar-passo'].trigger('click');
  p.back = () => p.nodes['voltar-passo-1'].trigger('click');
  p.step = n => {
    for (let i = 1; i <= 6; i += 1) assert.equal(p.nodes['passo-' + i].hidden, i !== n);
  };
  p.choose = (name, value) => {
    p.form.elements[name].forEach(field => { field.checked = field.value === value; });
    p.form.trigger('change', { target: { name } });
  };
  p.enter = field => p.form.trigger('keydown', { key: 'Enter', target: p.nodes[field] });
  p.submit = () => p.window.submitForm({ preventDefault() {} });
  return p;
}

function checkProfile(p) {
  p.step(1);
  p.window.openModal();
  p.next();
  p.step(1);
  assert.equal(p.nodes['step-error'].hidden, false, 'missing selection shows inline error');
  p.choose('colaboradores', 'De 0 a 4');
  assert.equal(p.nodes['route-porte'].classList.contains('on'), true);
  p.enter('colab-1');
  p.step(2);
  p.next();
  p.step(2);
  p.choose('cargo', 'Cargo Operacional');
  assert.equal(p.nodes['route-cargo'].classList.contains('on'), true);
  p.next();
  p.step(3);
  assert.equal(p.events.length, 0, 'qualifying questions do not mark contact stage');
}

function checkContacts(p) {
  p.next();
  p.step(4);
  assert.equal(p.events.length, 1, 'passo_2 marks entry to contact questions');
  assert.equal(p.form.elements.escritorio.value, '', 'office remains optional');
  p.form.elements.nome.value = 'Pessoa Teste';
  p.enter('f-name');
  p.step(5);
  p.form.elements.email.value = 'invalido';
  p.form.elements.email.validity.valid = false;
  p.next();
  p.step(5);
  assert.match(p.nodes['step-error'].textContent, /e-mail/);
  p.form.elements.email.value = 'teste@example.com';
  p.form.elements.email.validity.valid = true;
  p.next();
  p.step(6);
  assert.equal(p.nodes['submit-btn'].hidden, false);
  assert.equal(p.requests.length, 0, 'earlier steps never submit');
}

function checkReopen(p) {
  p.form.elements.telefone.value = '123';
  p.submit();
  assert.equal(p.requests.length, 0, 'invalid phone cannot submit');
  p.form.elements.telefone.value = '(31) 99949-1532';
  p.back();
  p.step(5);
  p.window.closeModal();
  p.window.openModal();
  p.step(5);
  assert.equal(p.form.elements.nome.value, 'Pessoa Teste', 'reopening preserves answers');
  p.next();
  p.enter('f-phone');
  assert.equal(p.requests.length, 1);
  p.submit();
  assert.equal(p.requests.length, 1, 'busy form cannot create duplicate requests');
}

function checkRetry(p) {
  p.window.fail();
  assert.equal(p.nodes['form-success'].hidden, true, 'persistence failure does not show success');
  assert.equal(p.nodes['wa-link'].href, undefined, 'WhatsApp destination only appears after success');
  assert.equal(p.form.elements.telefone.value, '(31) 99949-1532');
  p.submit();
  assert.equal(p.requests.length, 2, 'failed submission can be retried');
  p.window.complete();
  assert.equal(p.nodes['form-wrapper'].hidden, true);
  assert.equal(p.nodes['form-success'].hidden, false);
  assert.match(p.nodes['wa-link'].href, /^https:\/\/wa.me\//);
  p.window.closeModal();
  p.window.openModal(2);
  assert.equal(p.document.activeElement, p.nodes['form-success'], 'reabrir sucesso foca conteudo visivel');
  assert.equal(p.nodes['modal-title'].textContent, 'Em qual WhatsApp falamos com você?', 'reabrir sucesso nao altera etapa oculta');
  assert.ok(p.events.every(([name, value]) => name === 'passo_2' && value === undefined), 'progress events contain no contact information');
}

for (const page of ['mentoria', 'mentoria-2']) {
  const p = navigation(page);
  assert.equal(p.form.elements.nome.maxLength, 200);
  assert.equal(p.form.elements.email.maxLength, 254);
  assert.equal(p.form.elements.escritorio.maxLength, 200);
  checkProfile(p);
  checkContacts(p);
  checkReopen(p);
  checkRetry(p);
}
process.stdout.write('Consultoria UI: seis etapas, Enter, validacao, baixo porte, voltar/reabrir, retry e sucesso passaram.\n');
