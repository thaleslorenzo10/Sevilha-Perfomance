'use strict';

const assert = require('node:assert/strict');
const { unificar } = require('../lib/leads-unificados');
const { montarEventos, dataValida } = require('../lib/eventos-dashboard');
const { agregarCompras } = require('../lib/eventos-dashboard-compras');

const registro = (id, dia, pagina = '/aula-gestao-operacional', email = 'mesmo@example.com') => ({
  id, created_at: `${dia}T12:00:00-03:00`, pagina, email, utm_campaign: '[SE] campanha legada',
});
const opcoes = { grupo: 'AULA', inicioEdicao: '2026-10-14', fimEdicao: '2026-10-27' };
const registros = [registro(1, '2026-10-13'), registro(2, '2026-10-14'), registro(3, '2026-10-15'),
  registro(4, '2026-10-14', '/cafe-com-sevilha/'), registro(5, '2026-10-28', '/aula-gestao-operacional', 'fora@example.com')];
const aula = unificar({ supabase: registros }, '2026-10-14', '2026-10-27', opcoes);
assert.equal(aula.total.leads, 1, 'reinscrição da edição anterior conta uma vez nesta edição');
assert.equal(aula.por_grupo.AULA.leads, 1);
const cafe = unificar({ supabase: registros }, '2026-10-14', '2026-11-11', { ...opcoes, grupo: 'CAFE', fimEdicao: '2026-11-11' });
assert.equal(cafe.total.leads, 1, 'mesmo contato pode participar de ofertas diferentes');
assert.equal(unificar({ supabase: registros }, '2026-10-15', '2026-10-15', opcoes).total.leads, 0, 'subperíodo preserva dedupe da edição');
const compra = { order_id: 'a', status: 'paid', valor_centavos: 1990, pago_em: '2026-10-14T03:00:00Z', payload: { Product: { product_name: 'Aula Gestão Operacional' } } };
const agregado = agregarCompras([compra, compra, { ...compra, order_id: 'b', status: 'refunded', valor_centavos: 1000 },
  { ...compra, order_id: 'fora', pago_em: '2026-10-14T02:59:59Z' }], '2026-10-14', '2026-10-27'),
  esperado = { pagas: 1, reembolsadas: 1, receita: 19.9, valor_reembolsado: 10 };
for (const [k, v] of Object.entries(esperado)) assert.equal(agregado[k], v);
assert.equal(agregarCompras([compra, { ...compra, status: 'refunded', updated_at: '2026-10-15' }], '2026-10-14', '2026-10-27').pagas, 0);
assert.equal(dataValida('2026-02-30'), false);
assert.equal(dataValida('2026-13-01'), false);
assert.equal(dataValida('9999-01-01'), false);
assert.equal(dataValida('2026-10-14'), true);

async function testarFontes() {
  let chamadas = 0;
  const fontes = {
    leads: async (since, until, escopo) => { chamadas++; return unificar({ supabase: registros }, since, until, escopo); },
    compras: async () => agregarCompras([compra], '2026-10-14', '2026-10-27'),
  };
  const fora = await montarEventos('2026-08-01', '2026-08-31', fontes);
  assert.equal(chamadas, 0);
  assert.equal(fora.eventos[0].periodo, null);
  assert.equal(fora.eventos[0].leads.total.leads, 0);
  const dentro = await montarEventos('2026-10-01', '2026-11-30', fontes);
  assert.deepEqual(dentro.eventos[0].periodo, { since: '2026-10-14', until: '2026-10-27' });
  assert.equal(dentro.eventos[1].compras, null);
  assert.equal(dentro.eventos[2].id, 'aula-2026-10-06');
  assert.deepEqual(dentro.eventos[2].periodo, { since: '2026-10-01', until: '2026-10-06' });
  const falha = await montarEventos('2026-10-14', '2026-10-14', {
    leads: async () => ({ fontes: [{ nome: 'FORMS', erro: 'offline' }] }),
    compras: async () => { throw new Error('offline'); },
  });
  assert.equal(falha.eventos[0].leads, null);
  assert.equal(falha.eventos[0].compras, null);
  assert.equal(falha.eventos[0].erros.length, 2);
  await assert.rejects(montarEventos('2026-02-30', '2026-03-01', fontes));
  assert.equal(JSON.stringify(dentro).includes('mesmo@example.com'), false, 'resposta agregada sem PII');
}

testarFontes().then(() => console.log('eventos-dashboard: OK')).catch(err => { console.error(err); process.exitCode = 1; });
