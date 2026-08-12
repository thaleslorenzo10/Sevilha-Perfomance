'use strict';

/**
 * Teste da regra de porte (node scripts/test-porte.js).
 *
 * `classificarPorte` decide quem é escritório de 10+ colaboradores. A mesma
 * função alimenta o dashboard e o evento LeadQualificado no Meta, então uma
 * mudança aqui muda os dois — por isso os 16 formatos de resposta que existem
 * na base real estão todos cobertos, com a contagem de cada um no comentário.
 */

const { classificarPorte, PORTE_MAIOR, PORTE_MENOR, PORTE_INDEF } = require('../lib/porte');

let falhas = 0;
function ok(cond, msg, extra) {
  if (cond) { console.log(`  ✓ ${msg}`); return; }
  falhas++;
  console.error(`  ✗ ${msg}${extra !== undefined ? ` — obtido: ${JSON.stringify(extra)}` : ''}`);
}

function esperar(entrada, esperado, nota) {
  const obtido = classificarPorte(entrada);
  ok(obtido === esperado, `${JSON.stringify(entrada)} → ${esperado}${nota ? ` (${nota})` : ''}`, obtido);
}

console.log('— formatos reais da base (com a contagem de cada um) —');

// Formulário do Respondi, formato atual.
esperar('De 0 a 4',   PORTE_MENOR);   // 437
esperar('De 5 a 9',   PORTE_MENOR);   // 157
esperar('De 10 a 19', PORTE_MAIOR);   //  89
esperar('De 20 a 29', PORTE_MAIOR);   //  35
esperar('De 30 a 49', PORTE_MAIOR);   //  36
esperar('Mais de 50', PORTE_MAIOR);   //  29

// Formulário do Respondi, formato antigo (com "à").
esperar('0 à 9',   PORTE_MENOR);      // 370
esperar('10 à 19', PORTE_MAIOR);      // 113
esperar('20 à 29', PORTE_MAIOR);      //  28
esperar('Acima de 30 colaboradores', PORTE_MAIOR); // 44

// Digitados à mão em versões antigas do formulário.
esperar('20 a 30', PORTE_MAIOR);      //   3
esperar('10 a 20', PORTE_MAIOR);      //   1
esperar('0',       PORTE_MENOR);      //   1
esperar('6 a 10',  PORTE_INDEF,       // 8 — a faixa cruza o corte: 6 é menor,
        'faixa cruza o corte dos 10'); //     10 é maior. Não dá para atribuir.

console.log('\n— sem resposta —');
esperar('',        PORTE_INDEF);      // 256 (abandono de formulário)
esperar(null,      PORTE_INDEF);
esperar(undefined, PORTE_INDEF);

console.log('\n— faixa com só o teto informado —');
// "Até 5" (9 ocorrências na planilha) caía em INDEFINIDO por a função não
// entender o "até". Nenhum lead muda de lado no corte de qualificado — nem
// MENOR nem INDEFINIDO disparam evento —, só sai de "não sei" para "menor".
esperar('Até 5',       PORTE_MENOR);
esperar('no maximo 4', PORTE_MENOR);
// "menos de"/"abaixo de" excluem o número, "até"/"no máximo" incluem: por isso
// "menos de 10" é MENOR (chega a 9) e "até 10" cruza o corte.
esperar('Menos de 10', PORTE_MENOR);
esperar('Abaixo de 10', PORTE_MENOR);
esperar('Até 10',      PORTE_INDEF, 'inclui o 10, então cruza o corte');
esperar('Até 20',      PORTE_INDEF, 'cruza o corte');
esperar('Menos de 30', PORTE_INDEF, 'cruza o corte');

console.log('\n— ruído de coluna desalinhada —');
esperar('1,20249E+17', PORTE_INDEF, 'notação científica de id vazado');

console.log('\n— o formulário do site grava em slug —');
esperar('de_0_a_4',   PORTE_MENOR);
esperar('de_10_a_19', PORTE_MAIOR);

console.log('\n— o corte é o limite inferior da faixa —');
esperar('De 9 a 12',  PORTE_INDEF, 'cruza o corte');
esperar('Mais de 9',  PORTE_MENOR, '9 ainda é menor que 10');
esperar('Mais de 10', PORTE_MAIOR);

console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo verde');
process.exit(falhas ? 1 : 0);
