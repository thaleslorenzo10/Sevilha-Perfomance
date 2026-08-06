'use strict';

/**
 * Normalização de texto compartilhada: sem acento, minúsculo, sem espaço nas
 * pontas. Usada para comparar cabeçalhos de planilha e respostas de formulário,
 * que chegam com grafias diferentes conforme a origem ("Dono/Sócio" na landing
 * page, "dono / sócio" no formulário do Meta).
 */

// Marcas de acentuação que o NFD separa da letra base.
const ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g');

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(ACENTOS, '')
    .toLowerCase().trim();
}

module.exports = { norm };
