'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { test } = require('node:test');

function carregarModulos(fetch = async () => ({ ok: true, json: async () => ({}) })) {
  const elementos = new Map();
  const classes = new Set();
  const document = {
    body: { classList: { toggle: (c, on) => on ? classes.add(c) : classes.delete(c) } },
    getElementById: id => {
      if (!elementos.has(id)) elementos.set(id, { innerHTML: '' });
      return elementos.get(id);
    },
  };
  const ctx = { window: {}, document, console, fetch };
  vm.createContext(ctx);
  for (const m of ['formato', 'cruzamento', 'api', 'eventos']) {
    vm.runInContext(readFileSync(path.join(__dirname, `../assets/js/dash/${m}.js`), 'utf8'), ctx);
  }
  return { D: ctx.window.SPD, elementos, classes };
}
const periodo = { since: '2026-10-14', until: '2026-10-20' };
const evento = {
  id: 'aula-2026-10-27', periodo,
  leads: { total: { leads: 3, mql: 1 }, por_campanha: [{ campanha: '[AULA] Nova', leads: 3, mql: 1 }] },
  compras: { pagas: 2, receita: 200, reembolsadas: 1, valor_reembolsado: 100 }, erros: [],
};
const meta = {
  grupos: { AULA: { spend: 120, leads: 7 }, CAFE: { spend: 20, leads: 2 } },
  campanhas: [{ nome: '[AULA] Nova', grupo: 'AULA', spend: 120, leads: 7 }, { nome: '[CAFÉ] Outra', grupo: 'CAFE', spend: 20, leads: 2 }],
  conjuntos: [{ grupo: 'CAFE' }, { grupo: 'AULA' }], anuncios: [{ grupo: 'CAFE' }],
  serie: [{ data: '2026-10-14', AULA: { spend: 120 }, CAFE: { spend: 20 } }],
};
const tick = () => new Promise(resolve => setImmediate(resolve));

test('edição cruza somente suas campanhas e distingue atribuição, compras e reembolso', () => {
  const { D } = carregarModulos();
  const filtrado = D.filtrarMetaEvento(meta, 'AULA');
  assert.equal(filtrado.campanhas.length, 1);
  assert.equal(filtrado.conjuntos.length, 1);
  assert.equal(filtrado.anuncios.length, 0);
  assert.equal(filtrado.serie[0].spend, 120);
  const html = D.markupEvento(evento, filtrado, false);
  assert.match(html, /R\$ 40,00/);
  assert.match(html, /Inscrições pagas/);
  assert.match(html, /Valor reembolsado/);
  assert.match(html, /14\/10\/2026 a 20\/10\/2026/);
  assert.doesNotMatch(html, /\[CAFÉ\] Outra/);
});

test('falhas de fontes produzem n/d, mantendo fontes disponíveis e sem vendas do CRM no Café', () => {
  const { D } = carregarModulos();
  const html = D.markupEvento(evento, null, true);
  assert.match(html, /Meta Ads indisponível/);
  assert.match(html, /<td class="num">n\/d<\/td><td class="num">3<\/td>/);
  const semLeads = D.markupEvento({ ...evento, leads: null, compras: null }, D.filtrarMetaEvento(meta, 'AULA'), false);
  assert.match(semLeads, /R\$ 120,00/);
  assert.match(semLeads, /Leads reais indisponíveis/);
  assert.match(semLeads, /Compras Kiwify indisponíveis/);
  assert.match(D.markupEvento({ ...evento, id: 'cafe-2026-11-11', compras: null }, null, true), /Vendas e receita: n\/d/);
  assert.match(D.markupEvento({ ...evento, periodo: null }, null, false), /Sem interseção/);
});

test('cache compartilha Meta na mesma janela e remove falha para permitir retry', async () => {
  let chamadas = 0;
  const { D } = carregarModulos(async () => { chamadas++; return { ok: true, json: async () => meta }; });
  const a = D.buscarMeta('2026-10-14', '2026-10-20');
  assert.equal(a, D.buscarMeta('2026-10-14', '2026-10-20'));
  await a;
  assert.equal(chamadas, 1);
  let falhas = 0;
  const outro = carregarModulos(async () => { falhas++; throw new Error('Offline'); }).D;
  await assert.rejects(outro.buscarMeta('a', 'b'));
  await assert.rejects(outro.buscarMeta('a', 'b'));
  assert.equal(falhas, 2);
});

test('eventos são lazy e trocas rápidas de período não mostram resposta antiga', async () => {
  const { D, elementos, classes } = carregarModulos();
  const pendentes = [];
  D.buscarEventos = () => new Promise(resolve => pendentes.push(resolve));
  D.buscarMeta = async () => meta;
  D.periodoEventos('2026-10-14', '2026-10-19');
  assert.equal(pendentes.length, 0);
  D.abrirEvento(evento.id);
  assert.equal(pendentes.length, 1);
  assert.equal(classes.has('evento-ativo'), true);
  D.periodoEventos('2026-10-14', '2026-10-20');
  pendentes[1]({ eventos: [evento] });
  await tick();
  const painel = elementos.get('painel-' + evento.id);
  const atual = painel.innerHTML;
  pendentes[0]({ eventos: [{ ...evento, periodo: { ...periodo, until: '2026-10-19' } }] });
  await tick();
  assert.equal(painel.innerHTML, atual);
  assert.match(atual, /20\/10\/2026/);
  D.abrirEvento('geral');
  assert.equal(classes.has('evento-ativo'), false);
});

test('troca rápida de evento não aplica Meta pendente a outra edição; Meta offline mantém leads', async () => {
  const { D, elementos } = carregarModulos();
  D.buscarEventos = async () => ({ eventos: [evento, { ...evento, id: 'cafe-2026-11-11', compras: null }] });
  const metas = [];
  D.buscarMeta = () => new Promise((resolve, reject) => metas.push({ resolve, reject }));
  D.periodoEventos('2026-10-14', '2026-10-20');
  D.abrirEvento(evento.id);
  await tick();
  D.abrirEvento('cafe-2026-11-11');
  await tick();
  metas[1].reject(new Error('Meta offline'));
  await tick();
  const cafe = elementos.get('painel-cafe-2026-11-11').innerHTML;
  assert.match(cafe, /Meta Ads indisponível/);
  assert.match(cafe, /Leads reais<\/div><div class="kpi-value">3/);
  metas[0].resolve(meta);
  await tick();
  assert.equal(elementos.get('painel-cafe-2026-11-11').innerHTML, cafe);
});
