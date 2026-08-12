'use strict';

/**
 * Tira do JSON da conta de serviço os dois valores que vão para o Vercel.
 *
 *   node scripts/chave-service-account.js ~/Downloads/projeto-abc123.json
 *
 * Existe porque não há nada chamado GOOGLE_PRIVATE_KEY no console do Google:
 * esse é o nome da variável aqui. No JSON os campos se chamam `client_email` e
 * `private_key`, e o engano comum é copiar só um pedaço da chave — que falha
 * depois, no deploy, com um erro de OpenSSL que não explica nada.
 *
 * O que sai daqui é segredo: vai para as Environment Variables do Vercel e
 * para mais lugar nenhum. Não commite, não cole em conversa.
 */

const fs = require('fs');
const crypto = require('crypto');

const arquivo = process.argv[2];
if (!arquivo) {
  console.error('uso: node scripts/chave-service-account.js <caminho-do-json>');
  console.error('     (o JSON que o Google baixou em Credenciais → Chaves → Criar nova chave)');
  process.exit(1);
}

let json;
try {
  json = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
} catch (e) {
  console.error(`não deu para ler ${arquivo}: ${e.message}`);
  process.exit(1);
}

if (json.type !== 'service_account') {
  console.error('este JSON não é de uma conta de serviço '
              + `(campo "type" veio como ${JSON.stringify(json.type)}).`);
  console.error('Baixe em: Credenciais → a conta de serviço → Chaves → Adicionar chave → JSON.');
  process.exit(1);
}

const { client_email: email, private_key: chave } = json;
if (!email || !chave) {
  console.error('o JSON não tem client_email e/ou private_key — parece incompleto.');
  process.exit(1);
}

// Falhar aqui é muito melhor do que falhar no deploy: se a chave não assina
// nesta máquina, também não vai assinar no Vercel.
try {
  crypto.createSign('RSA-SHA256').update('teste').sign(chave);
} catch (e) {
  console.error(`a private_key deste JSON não assina: ${e.message}`);
  process.exit(1);
}

const linhas = chave.trim().split('\n').length;

console.log('\nCole cada valor em Vercel → Settings → Environment Variables');
console.log('(marque Production, Preview e Development)\n');
console.log('─'.repeat(72));
console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL');
console.log('─'.repeat(72));
console.log(email);
console.log('\n' + '─'.repeat(72));
console.log(`GOOGLE_PRIVATE_KEY   (${linhas} linhas — cole inteiro, do BEGIN ao END)`);
console.log('─'.repeat(72));
console.log(chave.trim());
console.log('─'.repeat(72));
console.log('\nE ainda: APAGUE o valor de LEADS_SHEET_GID_FORMS.');
console.log('Com ele preenchido, a Service Account lê só as abas listadas e a');
console.log('descoberta automática não roda.\n');
console.log(`Não esqueça de compartilhar a planilha com ${email} como Leitor.`);
console.log('Depois do redeploy: node scripts/verificar-planilha.js\n');
