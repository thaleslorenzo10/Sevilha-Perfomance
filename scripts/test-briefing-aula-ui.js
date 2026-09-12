const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = readFileSync(path.join(__dirname, '../briefing-aula/briefing.js'), 'utf8');
const html = readFileSync(path.join(__dirname, '../briefing-aula/index.html'), 'utf8');

function createPage(storage = new Map()) {
  const names = [...html.matchAll(/<textarea id="([^"]+)"/g)].map(match => match[1]);
  const fields = names.map(name => ({
    name, value: '', required: true,
    setCustomValidity() {},
    addEventListener(_event, handler) { this.input = handler; },
  }));
  const form = {
    querySelectorAll: () => fields,
    reportValidity: () => true,
    elements: { website: { value: '' } },
    addEventListener(_event, handler) { this.submit = handler; },
  };
  const button = { disabled: true };
  const status = { dataset: {}, focus() {} };
  const draft = {};
  const page = { fields, button, status, draft, requests: [], mode: 'offline' };
  const elements = { '#briefing': form, '#submit-button': button, '#submit-status': status, '#draft-status': draft };
  const context = {
    document: { querySelector: selector => elements[selector] },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    crypto: { randomUUID }, AbortController, TextEncoder, setTimeout, clearTimeout,
    fetch: async (_url, options) => {
      const request = JSON.parse(options.body);
      page.requests.push(request);
      if (page.mode === 'offline') throw new Error('offline');
      return {
        status: typeof page.mode === 'number' ? page.mode : 200,
        ok: typeof page.mode !== 'number',
        json: async () => ({ ok: true, id: page.mode === 'wrong-id' ? 'wrong' : request.id }),
      };
    },
  };
  vm.runInNewContext(source, context);
  page.submit = () => form.submit({ preventDefault() {} });
  return page;
}

async function checkRetryAndDraft() {
  const storage = new Map();
  const page = createPage(storage);
  assert.equal(page.button.disabled, false);
  page.fields.forEach(field => { field.value = 'Resposta'; field.input(); });
  await page.submit();
  await page.submit();
  assert.equal(page.requests[0].id, page.requests[1].id, 'Retry must preserve the protocol');
  assert.equal(page.status.dataset.state, 'error');
  const restored = createPage(storage);
  assert.equal(restored.fields[0].value, 'Resposta', 'Reload must restore unsent answers');
  await restored.submit();
  assert.equal(restored.requests[0].id, page.requests[0].id, 'Reload must preserve a pending protocol');
  restored.fields[0].value = 'Resposta alterada';
  restored.fields[0].input();
  await restored.submit();
  assert.notEqual(restored.requests[0].id, restored.requests[1].id, 'Changed answers need a new protocol');
  await checkReceipt(restored);
}

async function checkReceipt(restored) {
  restored.mode = 'wrong-id';
  await restored.submit();
  assert.equal(restored.status.dataset.state, 'error', 'An unrelated receipt must never show success');
  restored.mode = 'success';
  await restored.submit();
  assert.equal(restored.status.dataset.state, 'success');
  assert.equal(restored.fields[0].value, 'Resposta alterada');
  assert.equal(restored.button.disabled, false);
}

async function checkRejectedPayloads() {
  const page = createPage();
  page.mode = 409;
  await page.submit();
  await page.submit();
  assert.notEqual(page.requests[0].id, page.requests[1].id, 'Conflict must reset the pending protocol');
  page.mode = 413;
  await page.submit();
  assert.match(page.status.textContent, /limite total/);
  page.mode = 422;
  await page.submit();
  assert.match(page.status.textContent, /inválidas/);
  const requestCount = page.requests.length;
  page.fields.forEach(field => { field.value = '漢'.repeat(3000); });
  await page.submit();
  assert.equal(page.requests.length, requestCount, 'Oversized Unicode must be caught before fetch');
  assert.match(page.status.textContent, /limite total/);
  assert.equal(page.fields[0].value.length, 3000, 'Validation must preserve answers');
  assert.equal(page.button.disabled, false);
}

assert.match(html, /<form id="briefing" method="post" action="\/api\/briefing-aula">/);
assert.match(html, /id="submit-button" disabled/);
checkRetryAndDraft().then(checkRejectedPayloads).then(() => {
  process.stdout.write('Briefing UI: draft, retries, receipt validation, no-JS and Unicode checks passed.\n');
}).catch(error => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
