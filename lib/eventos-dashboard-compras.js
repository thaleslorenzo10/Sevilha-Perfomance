'use strict';

const { rest, lerTudo } = require('./supabase');
const { diaDe, inicioDoDia } = require('./fuso');

function ordensUnicas(registros) {
  const ordens = new Map();
  for (const r of registros) {
    if (!r.order_id) continue;
    const anterior = ordens.get(r.order_id);
    if (!anterior || String(r.updated_at || '') >= String(anterior.updated_at || '')) ordens.set(r.order_id, r);
  }
  return ordens.values();
}

function agregarCompras(registros, since, until) {
  const total = { pagas: 0, reembolsadas: 0, receita: 0, valor_reembolsado: 0 };
  for (const r of ordensUnicas(registros)) {
    const dia = diaDe(r.pago_em);
    if (!dia || dia < since || dia > until || !['paid', 'refunded'].includes(r.status)) continue;
    if (!Number.isFinite(Number(r.valor_centavos)) || r.valor_centavos == null) throw new Error('Compra sem valor válido');
    if (r.status === 'paid') { total.pagas++; total.receita += Number(r.valor_centavos); }
    else { total.reembolsadas++; total.valor_reembolsado += Number(r.valor_centavos); }
  }
  total.receita /= 100;
  total.valor_reembolsado /= 100;
  return total;
}

async function lerCompras(since, until) {
  const url = rest('sevilha_compras_aula',
    `select=order_id,status,valor_centavos,pago_em,updated_at&pago_em=gte.${inicioDoDia(since)}&pago_em=lte.${until}T23:59:59.999-03:00&order=pago_em.asc,order_id.asc`);
  if (!url) throw new Error('Supabase não configurado');
  return agregarCompras(await lerTudo(url), since, until);
}

module.exports = { agregarCompras, lerCompras };
