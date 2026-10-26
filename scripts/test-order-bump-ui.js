'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const D = { fmtN: n => String(n), fmtR: n => 'R$ ' + Number(n).toFixed(2), fmtDia: n => n,
  esc: n => String(n).replaceAll('<', '&lt;'), razao: (a, b) => b ? a / b : null, cruzar: () => [] };
vm.runInNewContext(fs.readFileSync('assets/js/dash/eventos.js', 'utf8'), { window: { SPD: D } });
const evento = { id: 'aula-2026-10-27', periodo: { since: '2026-10-14', until: '2026-10-26' }, erros: [], leads: { total: { leads: 20 } },
  compras: { pagas: 2, receita: 54, aula: { pagas: 2, receita: 54 }, gravacao: { pagas: 1, receita: 97 },
    combinado: { receita: 151, cobrado: 151, liquido: null, ticket_medio: 75.5, adesao: 0.5 }, datas_aproximadas: 1 } };
let html = D.markupEvento(evento, { total: { spend: 100 } }, false);
for (const texto of ['Gravação', '97.00', '151.00', '75.50', '50,0%', '50.00', 'aproximadas']) assert.ok(html.includes(texto), texto);
assert.ok(html.includes('n/d'), 'líquido desconhecido');
html = D.markupEvento({ ...evento, compras: null }, null, true);
assert.ok(!html.includes('NaN') && !html.includes('Infinity'));
assert.ok(html.includes('n/d'));
html = D.markupEvento({ ...evento, id: 'aula-2026-10-06', periodo: { since: '2026-09-18', until: '2026-10-06' } }, null, false);
assert.ok(html.includes('2026-09-17'));
html = D.markupEvento({ ...evento, id: 'cafe-2026-11-11', compras: null }, null, false);
assert.ok(html.includes('não possui fonte própria de vendas'));
const pagina = fs.readFileSync('dashboard.html', 'utf8');
assert.ok(pagina.includes('data-tab="aula-2026-10-06"'));
assert.ok(pagina.includes('id="painel-aula-2026-10-06"'));
console.log('order-bump-ui: OK');
