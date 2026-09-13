'use strict';
const assert = require('node:assert/strict');
const f = require('../lib/fuso');

assert.equal(f.FUSO, '-03:00');
assert.equal(f.diaDe('2026-09-13'), '2026-09-13', 'data pura passa intacta');
assert.equal(f.diaDe('2026-09-13T02:30:00Z'), '2026-09-12', '02:30 UTC ainda é dia 12 em Brasília');
assert.equal(f.diaDe('2026-09-13T03:00:00Z'), '2026-09-13', '03:00 UTC vira meia-noite do dia 13');
assert.equal(f.diaDe('2026-04-06T23:30:00-05:00'), '2026-04-07', 'export do Meta em -05:00 vira dia seguinte');
assert.equal(f.diaDe(new Date('2026-01-01T01:00:00Z')), '2025-12-31');
assert.equal(f.diaDe(''), null); assert.equal(f.diaDe('abc'), null);
assert.equal(f.inicioDoDia('2026-09-01'), '2026-09-01T00:00:00-03:00');
assert.equal(f.fimDoDia('2026-09-01'), '2026-09-01T23:59:59-03:00');
assert.deepEqual(f.cadaDia('2026-08-30', '2026-09-01'), ['2026-08-30', '2026-08-31', '2026-09-01']);
assert.equal(f.deslocarDias('2026-09-01', -1), '2026-08-31');
assert.deepEqual(f.periodoAnterior('2026-09-07', '2026-09-13'), { since: '2026-08-31', until: '2026-09-06' });
console.log('✓ fuso');
