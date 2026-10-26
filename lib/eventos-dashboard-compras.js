'use strict';

const { rest, lerTudo } = require('./supabase');
const { diaDe, inicioDoDia } = require('./fuso');
const { classificar, valores } = require('./kiwify-produtos');

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
  const grupos = { aula: [], gravacao: [] };
  let aproximadas = 0;
  for (const r of ordensUnicas(registros)) {
    const dia = diaDe(r.pago_em);
    if (!dia || dia < since || dia > until || !['paid', 'refunded'].includes(r.status)) continue;
    const tipo = classificar(r.payload);
    if (!grupos[tipo]) continue;
    if (!Number.isFinite(Number(r.valor_centavos)) || r.valor_centavos == null) throw new Error('Compra sem valor válido');
    grupos[tipo].push(r);
    if (r.payload?.importacao?.data_pagamento === 'criacao_aproximada') aproximadas++;
    if (tipo === 'aula') {
      if (r.status === 'paid') { total.pagas++; total.receita += Number(r.valor_centavos); }
      else { total.reembolsadas++; total.valor_reembolsado += Number(r.valor_centavos); }
    }
  }
  total.receita /= 100;
  total.valor_reembolsado /= 100;
  total.aula = resumo(grupos.aula);
  total.gravacao = resumo(grupos.gravacao);
  const compradoresAula = emailsPagos(grupos.aula), compradoresGravacao = emailsPagos(grupos.gravacao);
  const comuns = [...compradoresGravacao].filter(e => compradoresAula.has(e)).length;
  const soma = campo => total.aula[campo] == null || total.gravacao[campo] == null ? null : Math.round((total.aula[campo] + total.gravacao[campo]) * 100) / 100;
  total.combinado = { receita: soma('receita'), cobrado: soma('cobrado'), liquido: soma('liquido'),
    ticket_medio: total.aula.pagas && soma('receita') != null ? soma('receita') / total.aula.pagas : null,
    adesao: compradoresAula.size ? comuns / compradoresAula.size : null };
  total.datas_aproximadas = aproximadas;
  return total;
}

function emailsPagos(registros) {
  return new Set(registros.filter(r => r.status === 'paid' && r.email).map(r => r.email.trim().toLowerCase()));
}

function resumo(registros) {
  const pagas = registros.filter(r => r.status === 'paid'), reembolsadas = registros.filter(r => r.status === 'refunded');
  const soma = (lista, campo) => {
    const ns = lista.map(r => valores(r)[campo]);
    return ns.some(n => n == null) ? null : ns.reduce((s, n) => s + n, 0) / 100;
  };
  return { pagas: pagas.length, reembolsadas: reembolsadas.length,
    receita: soma(pagas, 'base'), valor_reembolsado: soma(reembolsadas, 'base'),
    cobrado: soma(pagas, 'cobrado'), liquido: soma(pagas, 'liquido'), compradores: emailsPagos(pagas).size };
}

async function lerCompras(since, until) {
  const url = rest('sevilha_compras_aula',
    `select=order_id,status,email,valor_centavos,pago_em,updated_at,payload&pago_em=gte.${inicioDoDia(since)}&pago_em=lte.${until}T23:59:59.999-03:00&order=pago_em.asc,order_id.asc`);
  if (!url) throw new Error('Supabase não configurado');
  return agregarCompras(await lerTudo(url), since, until);
}

module.exports = { agregarCompras, lerCompras };
