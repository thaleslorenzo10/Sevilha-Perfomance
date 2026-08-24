#!/usr/bin/env node
'use strict';

/**
 * Confere a comparação por página de /api/stats, sem rede real.
 *
 *   • toda página do banco entra, mesmo sem estar em nenhuma lista fixa
 *   • qualificado usa a regra de porte (10+), não a contagem crua
 *   • página sem acesso registrado devolve conversão null, não 0 —
 *     zero por cento e "não dá para saber" são respostas diferentes
 *
 * Rode com: node scripts/test-stats-paginas.js
 */

const assert = require('assert');

process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';

const VIEWS = [
  { pagina: '/mentoria' }, { pagina: '/mentoria' }, { pagina: '/mentoria' },
  { pagina: '/mentoria-2' }, { pagina: '/mentoria-2' },
];
const LEADS = [
  { pagina: '/mentoria',   colaboradores: 'De 20 a 29' },  // qualifica
  { pagina: '/mentoria',   colaboradores: 'De 5 a 9'   },  // não
  { pagina: '/mentoria-2', colaboradores: 'De 10 a 19' },  // qualifica
  { pagina: '/pagina-sem-beacon', colaboradores: 'Mais de 50' }, // sem acesso contado
];

global.fetch = async (url) => ({
  ok: true,
  status: 200,
  json: async () => (String(url).includes('page_views') ? VIEWS : LEADS),
  text: async () => '',
});

const handler = require('../api/stats');

function resFalso() {
  const r = { corpo: null, statusCode: null };
  r.setHeader = () => {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}

(async () => {
  const res = resFalso();
  await handler({ method: 'GET', url: '/api/stats?since=2026-08-01&until=2026-08-31' }, res);

  const por = Object.fromEntries((res.corpo.paginas || []).map(p => [p.pagina, p]));

  assert.ok(por['/mentoria-2'], 'página nova entra sem estar em lista fixa');
  assert.ok(por['/pagina-sem-beacon'], 'página desconhecida também entra');

  assert.strictEqual(por['/mentoria'].visits, 3);
  assert.strictEqual(por['/mentoria'].leads, 2);
  assert.strictEqual(por['/mentoria'].leads_qualificados, 1, 'só o de 20 a 29 qualifica');
  assert.strictEqual(por['/mentoria'].conversion_rate, 66.67);
  assert.strictEqual(por['/mentoria'].qualification_rate, 50);

  assert.strictEqual(por['/mentoria-2'].leads_qualificados, 1);
  assert.strictEqual(por['/mentoria-2'].conversion_rate, 50);

  assert.strictEqual(por['/pagina-sem-beacon'].visits, 0);
  assert.strictEqual(por['/pagina-sem-beacon'].conversion_rate, null,
    'sem acesso contado a conversão é desconhecida, não zero');

  // O relatório antigo do A/B continua respondendo igual.
  assert.ok(Array.isArray(res.corpo.variants) && res.corpo.variants.length === 3);

  console.log('✓ comparação por página passou');
})();
