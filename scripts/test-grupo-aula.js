'use strict';
/** Grupo AULA no pipeline: classificação, por_grupo e agregado de compras.
 *   node scripts/test-grupo-aula.js */
let falhas = 0;
const ok = (c, d) => { console.log(`  ${c ? '✓' : '✗'} ${d}`); if (!c) falhas += 1; };

const { classifyCampaign } = require('../lib/meta');
console.log('\nlib/meta.js');
ok(classifyCampaign('[AULA] [LEAD] [COLD] - Teste').grupo === 'AULA', '[AULA] → AULA');
ok(classifyCampaign('[SE] [FORMS] x').grupo === 'SE', '[SE] continua SE');

const lu = require('../lib/leads-unificados');
console.log('\nlib/leads-unificados.js');
ok(lu.GRUPO_POR_PAGINA['/aula-gestao-operacional'] === 'AULA', 'página da aula → AULA');
ok(typeof lu.agregarCompras === 'function', 'agregarCompras exportado');
if (typeof lu.agregarCompras === 'function') {
  const compras = [
    { order_id: 'o1', status: 'paid', email: 'a@x.com', valor_centavos: 4700, pago_em: '2026-10-01T23:00:00Z', utm_campaign: '[AULA] T', utm_medium: 'HOT', utm_content: 'AD1' },
    { order_id: 'o2', status: 'refunded', email: 'b@x.com', valor_centavos: 4700, pago_em: '2026-10-02T12:00:00Z' },
    { order_id: 'o3', status: 'paid', email: 'c@x.com', valor_centavos: 4700, pago_em: '2026-09-01T12:00:00Z' },
  ];
  const deals = [{ nome: '[SE] Ana', email: 'a@x.com', criado_em: '2026-10-03T12:00:00Z' }];
  const r = lu.agregarCompras({ compras, deals, since: '2026-10-01', until: '2026-10-31' });
  ok(r.total === 1 && r.receita_centavos === 4700, 'só paid no período conta');
  ok(r.por_dia.find(d => d.dia === '2026-10-01').compras === 1, 'pago_em convertido para o dia no fuso do painel');
  ok(r.por_campanha[0].campanha === '[AULA] T' && r.por_campanha[0].compras === 1, 'por_campanha pela utm_campaign');
  ok(r.compradores_com_sessao === 1, 'comprador com deal [SE] depois da compra conta');

  // unificar é puro: compras chegam como dados; sem compras, `compras` é null.
  const u = lu.unificar({ compras }, '2026-10-01', '2026-10-31');
  ok(u.compras && u.compras.total === 1, 'unificar agrega compras recebidas como dados');
  ok(lu.unificar({}, '2026-10-01', '2026-10-31').compras === null, 'sem compras → null');
}

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
