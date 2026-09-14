'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Os módulos do painel são scripts de navegador: aqui rodam num contexto com `window` falso.
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const m of ['formato', 'cruzamento', 'tabelas']) {
  vm.runInContext(readFileSync(path.join(__dirname, `../assets/js/dash/${m}.js`), 'utf8'), ctx, { filename: m });
}
const D = ctx.window.SPD;

assert.equal(D.nomeChave('  [SE]  Café  '), '[se] cafe');
assert.equal(D.razao(10, 0), null); assert.equal(D.pct(1, 4), 25);
assert.equal(D.delta(120, 100), 20); assert.equal(D.delta(5, 0), null);
assert.equal(D.esc('<b>'), '&lt;b&gt;');
assert.equal(D.orDash(null, D.fmtN), '—');

const meta = [
  { nome: '[SE] X', spend: 100, leads: 10, grupo: 'SE' },
  { nome: '[CAFÉ] Y', spend: 50, leads: 8, grupo: 'CAFE' },
];
const leads = [
  { campanha: '[se] x', leads: 5, mql: 2, grupo: 'SE' },
  { campanha: 'Sem etiqueta', leads: 3, mql: 1, grupo: 'CAFE' },
];
const rd = [{ campanha: '[SE] X', deals: 2 }];
const rows = D.cruzar(leads, meta, 'campanha', { rd });
assert.equal(rows.length, 3);
const x = rows.find(r => r.nome === '[SE] X');
assert.deepEqual([x.spend, x.leads, x.mql, x.meta_reporta, x.deals], [100, 5, 2, 10, 2]);
assert.equal(x.cpl, 20); assert.equal(x.cpmql, 50); assert.equal(x.mql_pct, 40); assert.equal(x.lead_deal, 40);
const semEtq = rows.find(r => r.nome === 'Sem etiqueta');
assert.equal(semEtq.spend, 0); assert.equal(semEtq.cpl, null); assert.equal(semEtq.grupo, 'CAFE');
assert.equal(rows[0].nome, '[SE] X', 'ordenado por gasto');
assert.equal(D.cruzar(leads, meta, 'campanha', { filtroGrupo: 'CAFE' }).length, 2);
const t = D.totalizar(rows);
assert.deepEqual([t.nome, t.spend, t.leads, t.mql, t.meta_reporta], ['Total', 150, 8, 3, 18]);

const r = D.resumo({
  meta: { conta: { spend: 150 } },
  leads: { total: { leads: 8, mql: 3 } },
  rd: { por_campanha: [{ campanha: 'Sem campanha', deals: 50 }, { campanha: 'Etiqueta quebrada', deals: 500 }, { campanha: '[SE] X', deals: 2 }] },
});
assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), { spend: 150, leads: 8, mql: 3, mql_pct: 37.5, cpl: 18.75, cpmql: 50, deals: 2 });
assert.equal(D.resumo({ meta: null, leads: null, rd: null }).cpl, null);

// Conjunto/anúncio sem linha própria no Meta (sem gasto no período) herda o
// grupo pela campanha do lead, via D.mapaGrupoPorCampanha.
const leadsConjunto = [{ conjunto: 'HOT', campanha: '[SE] X', leads: 2, mql: 1 }];
const grupoPorCampanha = new Map([['[se] x', 'SE']]);
const linhasConjunto = D.cruzar(leadsConjunto, [], 'conjunto', { grupoPorCampanha, filtroGrupo: 'SE' });
assert.equal(linhasConjunto.length, 1);
assert.equal(linhasConjunto[0].grupo, 'SE');

// CSV: célula que começa com =, +, - ou @ vira fórmula ao abrir no Excel/Sheets
// — um apóstrofo na frente neutraliza sem mudar o gasto formatado.
const csv = D.csvDe([{ nome: '=HYPERLINK("x")', spend: 1.5 }], ['nome', 'spend']);
assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'), 'fórmula prefixada com apóstrofo e aspas escapadas');
assert.ok(csv.includes('"1,5"'), 'número seguro passa intacto, com vírgula decimal');

console.log('✓ dash cruzamento');
