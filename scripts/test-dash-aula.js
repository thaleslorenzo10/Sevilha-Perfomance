'use strict';
/** Contrato da aba "Aula paga" no dashboard (sem navegador, lê os arquivos).
 *   node scripts/test-dash-aula.js */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
let falhas = 0;
const ok = (c, d) => { console.log(`  ${c ? '✓' : '✗'} ${d}`); if (!c) falhas += 1; };
const html = fs.readFileSync(path.join(RAIZ, 'dashboard.html'), 'utf8');
ok(/data-tab="aula"/.test(html), 'botão da aba aula');
ok(/id="painelAULA"/.test(html), 'painel AULA');
ok(/dash\/aula\.js\?v=dash-3/.test(html), 'aula.js carregado com v=dash-3');
ok(!/\?v=dash-2/.test(html), 'nenhum asset ainda em dash-2');
const grupo = fs.readFileSync(path.join(RAIZ, 'assets/js/dash/grupo.js'), 'utf8');
ok(/AULA: 'Aula paga'/.test(grupo), 'NOME.AULA');
ok(/AULA: 'AULA'/.test(grupo), 'FUNIL_RD.AULA');
const main = fs.readFileSync(path.join(RAIZ, 'assets/js/dash/main.js'), 'utf8');
ok(/\['SE', 'CAFE', 'CP', 'AULA'\]/.test(main), 'main renderiza AULA');
const aula = fs.readFileSync(path.join(RAIZ, 'assets/js/dash/aula.js'), 'utf8');
ok(/D\.renderAula = function/.test(aula), 'renderAula definido');
ok(/Sessões por 100 compradores/.test(aula), 'métrica do cliente presente');
ok(aula.split('\n').length <= 350, 'aula.js abaixo de 350 linhas');
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
