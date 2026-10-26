'use strict';

const NOMES = { aula: 'Aula Gestão Operacional', gravacao: 'Gravação da aula - Aula Gestão Operacional' };
const normalizar = v => String(v || '').normalize('NFC').trim().toLowerCase();

function classificar(payload = {}) {
  const p = payload.Product || {};
  if (normalizar(p.product_offer_name) === 'teste' || normalizar(p.product_name) === 'example product') return 'teste';
  if (p.product_id === 'f1e55370-b1d3-11f1-8d3b-5d78e00f2487') return 'aula';
  for (const [tipo, nome] of Object.entries(NOMES)) {
    if (normalizar(p.product_name) === normalizar(nome)) return tipo;
  }
  return 'outro';
}

function centavos(valor) {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function valores(registro) {
  const c = registro.payload?.Commissions || {};
  return {
    base: centavos(c.product_base_price),
    cobrado: centavos(registro.valor_centavos),
    liquido: centavos(c.my_commission),
  };
}

module.exports = { classificar, valores, centavos, NOMES };
