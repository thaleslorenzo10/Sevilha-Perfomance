'use strict';
const assert = require('node:assert/strict');
const { classificar, valores } = require('../lib/kiwify-produtos');
const { agregarCompras } = require('../lib/eventos-dashboard-compras');
const registro = (id, nome, preco, extra = {}) => ({ order_id: id, status: 'paid', email: 'a@example.invalid',
  valor_centavos: preco, pago_em: '2026-10-20T12:00:00-03:00', payload: {
    Product: { product_name: nome }, Commissions: { product_base_price: preco, charge_amount: preco, my_commission: preco - 100 },
  }, ...extra });
const aula = registro('a', 'Aula Gestão Operacional', 2700);
const bump = registro('b', 'Gravação da aula - Aula Gestão Operacional', 9700);
assert.equal(classificar(aula.payload), 'aula');
assert.equal(classificar(bump.payload), 'gravacao');
assert.equal(classificar({ Product: { product_name: 'Example product' } }), 'teste');
assert.equal(classificar({ Product: { product_name: 'Aula Gestão Operacional', product_offer_name: 'Teste' } }), 'teste');
assert.equal(classificar({ Product: { product_name: 'Clube da Perfomance' } }), 'outro');
assert.equal(classificar({}), 'outro');
assert.deepEqual(valores({ ...aula, valor_centavos: 2842 }), { base: 2700, cobrado: 2842, liquido: 2600 });
let c = agregarCompras([aula, bump, bump, registro('x', 'Example product', 4020), registro('y', 'Clube da Perfomance', 54700)], '2026-10-14', '2026-10-27');
assert.equal(c.pagas, 1); assert.equal(c.receita, 27);
assert.equal(c.gravacao.pagas, 1); assert.equal(c.gravacao.receita, 97);
assert.equal(c.combinado.receita, 124); assert.equal(c.combinado.ticket_medio, 124);
assert.equal(c.combinado.adesao, 1);
c = agregarCompras([aula, { ...bump, email: 'outro@example.invalid' }], '2026-10-14', '2026-10-27');
assert.equal(c.combinado.adesao, 0, 'adesão exige comprador comum, não divisão de pedidos');
c = agregarCompras([aula, bump, { ...bump, status: 'refunded', updated_at: '2026-10-21' }], '2026-10-14', '2026-10-27');
assert.equal(c.gravacao.pagas, 0); assert.equal(c.gravacao.reembolsadas, 1);
assert.equal(c.combinado.receita, 27);
c = agregarCompras([], '2026-10-14', '2026-10-27');
assert.equal(c.combinado.ticket_medio, null); assert.equal(c.combinado.adesao, null);
c = agregarCompras([{ ...bump, payload: { ...bump.payload, importacao: { data_pagamento: 'criacao_aproximada' } } }], '2026-10-14', '2026-10-27');
assert.equal(c.datas_aproximadas, 1); assert.equal(c.combinado.ticket_medio, null);
assert.equal(JSON.stringify(c).includes('@'), false);
console.log('kiwify-produtos: OK');
