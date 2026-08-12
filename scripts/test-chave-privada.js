'use strict';

/**
 * Teste da normalização da chave privada (node scripts/test-chave-privada.js).
 * Gera um par RSA na hora — nenhuma chave real toca este arquivo.
 *
 * A chave sai de dentro de um JSON e vai para um campo de formulário web. Nesse
 * caminho ela chega de cinco jeitos diferentes, e o OpenSSL devolve o mesmo
 * "error:1E08010C:DECODER routines::unsupported" para todos os que quebram —
 * o que não ajuda ninguém a descobrir qual foi o engano. Aqui cada recorte
 * vira um caso com nome.
 */

const crypto = require('crypto');
const { normalizarChave } = require('../lib/sheets');

let falhas = 0;
function ok(cond, titulo, detalhe) {
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${titulo}${detalhe !== undefined ? ` — ${detalhe}` : ''}`);
  if (!cond) falhas++;
}

const PEM = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' });

/** Assina de verdade: é o que a autenticação no Google faz. */
function assina(valor) {
  try {
    crypto.createSign('RSA-SHA256').update('teste').sign(normalizarChave(valor));
    return true;
  } catch (e) {
    return false;
  }
}

console.log('\n— recortes que já funcionavam —');
ok(assina(PEM), 'PEM com quebras de linha de verdade');
ok(assina(PEM.replace(/\n/g, '\\n')), '\\n literais (valor cru do campo private_key)');

console.log('\n— recortes que quebravam —');
ok(assina(JSON.stringify(PEM)), 'com as aspas do JSON em volta, \\n literais');
ok(assina('"' + PEM + '"'), 'com aspas em volta, quebras de verdade');
ok(assina("'" + PEM + "'"), 'com aspas simples em volta');
ok(assina(PEM.replace(/\n/g, '')), 'achatada numa linha só');
ok(assina(PEM.replace(/\n/g, ' ')), 'achatada com espaços no lugar das quebras');
ok(assina('\n  ' + PEM + '  \n'), 'com espaço e linha em branco nas pontas');
ok(assina(PEM.replace(/\n/g, '\r\n')), 'com quebras do Windows (CRLF)');

console.log('\n— o que não pode passar —');
ok(!assina(''), 'vazio não vira chave');
ok(!assina('nem parece uma chave'), 'texto solto não vira chave');
ok(!assina(PEM.replace(/-----END PRIVATE KEY-----/, '')), 'PEM truncado continua falhando');
// Corpo adulterado tem o formato certo e conteúdo errado: precisa falhar.
const corrompida = PEM.replace(/^(-----BEGIN[^\n]*\n.{20})/, (m) => m.slice(0, -4) + 'AAAA');
ok(!assina(corrompida), 'chave com o corpo adulterado falha');

console.log('\n— o formato remontado —');
const saida = normalizarChave(PEM.replace(/\n/g, ''));
const linhas = saida.trim().split('\n');
ok(linhas[0] === '-----BEGIN PRIVATE KEY-----', 'começa no BEGIN', linhas[0]);
ok(linhas[linhas.length - 1] === '-----END PRIVATE KEY-----', 'termina no END', linhas[linhas.length - 1]);
ok(linhas.slice(1, -1).every(l => l.length <= 64), 'corpo em linhas de no máximo 64');
ok(normalizarChave(PEM) === normalizarChave(normalizarChave(PEM)),
   'normalizar duas vezes dá o mesmo resultado');

console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo certo\n');
process.exit(falhas ? 1 : 0);
