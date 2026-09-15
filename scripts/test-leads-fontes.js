'use strict';
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';

// Planilhas em memória: a Central com um registro FORMS; o Respondi vazio.
const sheets = require('../lib/sheets');
sheets.readAllTabs = async () => [{ modo: 'stub', rows: [
  ['l:1', '2026-09-10T10:00:00-03:00', '1', 'AD 07', '2', 'HOT', '3', '[SE] [FORMS] [LEAD] [HOT]', '4', 'F', 'false', 'ig',
   'Maria', 'maria@x.com', '', 'De 10 a 19', 'dono/sócio', '', '', '', '', '', ''],
] }];
sheets.readLPTabs = async () => { throw new Error('planilha do Respondi indisponível'); };

// Supabase paginado: 1000 linhas na primeira página, 1 na segunda.
const linha = i => ({ id: i, created_at: '2026-09-11T12:00:00+00:00', pagina: '/mentoria', email: `u${i}@x.com`,
  telefone: '', utm_source: 'Instagram_Feed', utm_medium: 'HOT', utm_campaign: '[SE] [PÁGINA NOVA]', utm_content: 'AD 1',
  colaboradores: 'de_0_a_4', cargo: '' });
// Compras da aula: a tabela ainda não existe (404) — não pode derrubar o payload.
const pedidos = [];
global.fetch = async (url, opts = {}) => {
  if (String(url).includes('sevilha_compras_aula')) return { ok: false, status: 404, text: async () => 'relation does not exist' };
  pedidos.push({ url: String(url), range: opts.headers && opts.headers.Range });
  const ini = Number((opts.headers.Range || '0-').split('-')[0]);
  const lote = ini === 0 ? Array.from({ length: 1000 }, (_, i) => linha(i)) : [linha(1000)];
  return { ok: true, status: 206, json: async () => lote, text: async () => '' };
};

const { montarUnificados } = require('../lib/leads-fontes');

(async () => {
  const r = await montarUnificados('2026-09-10', '2026-09-13');
  assert.equal(r.total.leads, 1002, '1 FORMS + 1001 Supabase');
  assert.equal(pedidos.length, 2, 'duas páginas de 1000');
  assert.ok(pedidos[0].url.includes('created_at=gte.2026-03-14T00:00:00-03:00'), 'lookback de 180 dias a partir do since');
  assert.ok(pedidos[0].url.includes('order=created_at.asc'));
  assert.equal(pedidos[1].range, '1000-1999');
  const resp = r.fontes.find(f => f.nome === 'RESPONDI');
  assert.equal(resp.erro, 'planilha do Respondi indisponível', 'fonte que falha vira erro na resposta, não 502');
  assert.equal(r.fontes.find(f => f.nome === 'FORMS').modo, 'stub');
  assert.equal(r.compras, null, 'compras indisponíveis viram null, sem perder os leads');
  assert.ok(r.gerado_em);
  console.log('✓ leads-fontes');
})();
