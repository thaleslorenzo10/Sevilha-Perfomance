'use strict';

/**
 * Porte do escritório: 10 ou mais colaboradores × menos de 10.
 *
 * É a definição de lead qualificado do projeto. Alimenta o dashboard (taxa de
 * perfil, custo por lead com perfil) e o evento LeadQualificado enviado ao Meta
 * — uma mudança aqui muda os dois, que é exatamente a razão de a regra morar
 * num lugar só.
 *
 * A resposta chega em formatos diferentes conforme o formulário:
 *   faixa do Meta   → "De 0 a 4", "De 10 a 19", "Mais de 50"
 *   faixa da LP     → "0 à 9", "10 à 19", "Acima de 30 colaboradores"
 *   slug do site    → "de_0_a_4"
 *   número digitado → "12", "35"
 *
 * O corte usa o LIMITE INFERIOR da faixa: "De 5 a 9" é menor que 10;
 * "De 10 a 19" é 10+. Faixas que cruzam o corte ("6 a 10") e respostas em
 * branco caem em INDEFINIDO em vez de serem chutadas para um dos lados.
 */

const { norm } = require('./texto');

const PORTE_MAIOR = 'MAIOR_10';
const PORTE_MENOR = 'MENOR_10';
const PORTE_INDEF = 'INDEFINIDO';

function classificarPorte(raw) {
  // O formulário do site grava em slug ("de_0_a_4"); o do Meta, por extenso.
  const s = norm(raw).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return PORTE_INDEF;

  // Ruído de colunas desalinhadas (ex.: "1,20249E+17").
  if (/e\+\d+/.test(s)) return PORTE_INDEF;

  // "mais de 50" / "acima de 30 colaboradores"
  const acima = s.match(/(?:mais de|acima de)\s+(\d+)/);
  if (acima) return parseInt(acima[1], 10) >= 10 ? PORTE_MAIOR : PORTE_MENOR;

  // Faixa com só o teto informado. "menos de"/"abaixo de" excluem o número
  // ("menos de 10" é no máximo 9); "até"/"no máximo" incluem ("até 10" chega
  // a 10). A diferença decide o corte: "menos de 10" é MENOR, "até 10" cruza.
  const teto = s.match(/(?:(menos de|abaixo de)|ate|no maximo)\s+(\d+)/);
  if (teto) {
    const max = parseInt(teto[2], 10) - (teto[1] ? 1 : 0);
    return max < 10 ? PORTE_MENOR : PORTE_INDEF;
  }

  // "de 10 a 19" / "10 a 19" / "0 a 9"
  const faixa = s.match(/(\d+)\s*(?:a|-)\s*(\d+)/);
  if (faixa) {
    const min = parseInt(faixa[1], 10);
    const max = parseInt(faixa[2], 10);
    if (min >= 10) return PORTE_MAIOR;
    if (max < 10)  return PORTE_MENOR;
    return PORTE_INDEF; // faixa cruza o corte — não dá para atribuir
  }

  // Número digitado direto.
  const n = s.match(/^(\d{1,5})$/);
  if (n) return parseInt(n[1], 10) >= 10 ? PORTE_MAIOR : PORTE_MENOR;

  return PORTE_INDEF;
}

/** Atalho para quem só quer saber se dispara o evento de lead qualificado. */
function ehQualificado(raw) {
  return classificarPorte(raw) === PORTE_MAIOR;
}

module.exports = { classificarPorte, ehQualificado, PORTE_MAIOR, PORTE_MENOR, PORTE_INDEF };
