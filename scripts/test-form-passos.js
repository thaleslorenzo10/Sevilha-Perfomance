'use strict';

/**
 * Sevilha Performance — contrato do formulário de dois passos
 *
 *   node scripts/test-form-passos.js
 *
 * O formulário virou três arquivos que precisam concordar entre si:
 *
 *   assets/form-steps.js   decide o passo e o roteamento
 *   mentoria/index.html    e mentoria-2/index.html: os campos e os atalhos
 *   lib/porte.js           classifica o porte para o LeadQualificado
 *
 * Nada disso quebra com erro na tela. Um `value` com uma letra diferente entre
 * o atalho do topo e o rádio do modal faz o atalho simplesmente não marcar
 * nada, e a página continua parecendo certa. Uma faixa nova de porte que o
 * lib/porte.js classifique de outro jeito faz a página oferecer o Clube para
 * quem o Meta vai receber como lead qualificado — silenciosamente.
 *
 * Este teste lê os arquivos e compara. Sem navegador, sem dependência.
 */

const fs   = require('fs');
const path = require('path');

const { classificarPorte, PORTE_MAIOR, PORTE_MENOR } = require('../lib/porte');
const { EVENTOS_ACEITOS } = require('../lib/pageviews');

const RAIZ = path.join(__dirname, '..');

const PAGINAS = ['mentoria/index.html', 'mentoria-2/index.html'];

/** Ids que o assets/form-steps.js procura por getElementById. */
const IDS_OBRIGATORIOS = [
  'modal-overlay', 'form-wrapper', 'sessao-form', 'modal-foot',
  'passo-1', 'passo-2', 'passo-rotulo', 'modal-title', 'modal-sub',
  'route-porte', 'clube-link', 'route-continuar', 'route-cargo', 'grupo-cargo',
  'form-error', 'err-wa', 'form-success', 'wa-link', 'submit-btn',
  'voltar-passo-1', 'f-name', 'f-phone',
];

/** `name=` que o /api/leads lê do corpo. Mudar aqui quebra a integração. */
const CAMPOS_CONTRATO = [
  'nome', 'email', 'telefone', 'escritorio', 'cargo', 'colaboradores',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ttclid', 'msclkid', 'fbp', 'fbc',
  'external_id', 'event_id', 'page_url', 'user_agent', 'pagina',
];

/** Fora do porte na página — precisa bater com o que o lib/porte.js pensa. */
const FORA_DO_PORTE = ['De 0 a 4', 'De 5 a 9'];

let falhas = 0;

function ok(condicao, descricao, detalhe) {
  if (condicao) {
    console.log(`  ✓ ${descricao}`);
    return true;
  }
  falhas += 1;
  console.log(`  ✗ ${descricao}`);
  if (detalhe) console.log(`      ${detalhe}`);
  return false;
}

function ler(arquivo) {
  return fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
}

/** Todos os `value=` de um grupo de rádio, na ordem em que aparecem. */
function valoresDeRadio(html, nome) {
  const re = new RegExp(`<input[^>]*type="radio"[^>]*name="${nome}"[^>]*>`, 'g');
  return (html.match(re) || [])
    .map(tag => (tag.match(/value="([^"]*)"/) || [])[1])
    .filter(Boolean);
}

/* ── 1. Cada página tem o que o form-steps.js procura ─────────────────── */

for (const pagina of PAGINAS) {
  console.log(`\n${pagina}`);
  const html = ler(pagina);

  const semId = IDS_OBRIGATORIOS.filter(id => !html.includes(`id="${id}"`));
  ok(semId.length === 0, 'todos os ids que o form-steps.js usa existem',
     semId.length ? `faltam: ${semId.join(', ')}` : '');

  const semCampo = CAMPOS_CONTRATO.filter(n => !html.includes(`name="${n}"`));
  ok(semCampo.length === 0, 'todos os campos do contrato com /api/leads existem',
     semCampo.length ? `faltam: ${semCampo.join(', ')}` : '');

  /* O atalho do topo marca o rádio do modal procurando pelo `value` exato.
     Divergência de uma letra = clique que não faz nada. */
  const chips  = [...html.matchAll(/class="chip porte-chip" data-porte="([^"]+)"/g)].map(m => m[1]);
  const radios = valoresDeRadio(html, 'colaboradores');

  ok(chips.length > 0, 'a página tem atalhos de porte no topo');
  ok(radios.length > 0, 'o modal tem o grupo de rádio de porte');

  const orfaos = chips.filter(c => !radios.includes(c));
  ok(orfaos.length === 0, 'todo atalho do topo casa com um rádio do modal',
     orfaos.length ? `sem rádio correspondente: ${orfaos.join(' | ')}` : '');

  ok(chips.length === radios.length,
     'atalhos e rádios oferecem as mesmas faixas',
     `atalhos: ${chips.length}, rádios: ${radios.length}`);

  const cargos = valoresDeRadio(html, 'cargo');
  ok(cargos.length === 3, 'o grupo de cargo tem as três posições', `achou ${cargos.length}`);

  /* O passo 2 começa escondido e o rodapé com o botão de enviar também: com o
     botão na tela no passo 1, o navegador tenta validar campo obrigatório
     escondido e trava o envio sem conseguir mostrar onde. */
  ok(/<div id="passo-2" hidden>/.test(html), 'o passo 2 começa escondido');
  ok(/id="modal-foot" hidden>/.test(html), 'o rodapé com o botão de enviar começa escondido');

  /* Nenhum rádio pode ser `required`: no passo 2 eles estão em container
     escondido, e um obrigatório invisível é envio travado sem mensagem. */
  const radiosObrigatorios = (html.match(/<input[^>]*type="radio"[^>]*required[^>]*>/g) || []).length;
  ok(radiosObrigatorios === 0, 'nenhum rádio é required (quem garante é o passo)',
     radiosObrigatorios ? `${radiosObrigatorios} rádio(s) com required` : '');

  /* Escritório deixou de ser obrigatório de propósito — era o quarto campo
     obrigatório seguido. Nome, telefone e e-mail continuam. */
  for (const [campo, esperado] of [['nome', true], ['telefone', true], ['email', true], ['escritorio', false]]) {
    const tag = (html.match(new RegExp(`<input[^>]*name="${campo}"[^>]*>`, 's')) || [])[0] || '';
    ok(/\brequired\b/.test(tag) === esperado,
       `campo ${campo} ${esperado ? 'é' : 'não é'} obrigatório`);
  }

  /* Os dois arquivos de comportamento entram, e o gtag saiu. */
  ok(html.includes('/assets/tracking.js?v='), 'carrega o tracking.js versionado');
  ok(html.includes('/assets/form-steps.js?v='), 'carrega o form-steps.js versionado');
  ok(!html.includes('googletagmanager.com'), 'não carrega mais o gtag.js de exemplo');
  ok(html.includes("localStorage.getItem('_sp_interno')"),
     'o Pixel respeita a marca de tráfego interno');

  /* Poppins em dois pesos: cada peso a mais é um woff2 no caminho crítico. */
  const fonte = (html.match(/family=Poppins:wght@([\d;]+)/) || [])[1] || '';
  ok(fonte === '700;800', 'Poppins pedida em dois pesos', `pediu: ${fonte || '(nada)'}`);
}

/* ── 2. A página e o lib/porte.js concordam sobre o corte de 10 ───────── */

console.log('\nporte: página × lib/porte.js');
{
  const html   = ler(PAGINAS[0]);
  const faixas = valoresDeRadio(html, 'colaboradores');

  for (const faixa of faixas) {
    const esperado = FORA_DO_PORTE.includes(faixa) ? PORTE_MENOR : PORTE_MAIOR;
    ok(classificarPorte(faixa) === esperado,
       `"${faixa}" → ${esperado}`,
       `lib/porte.js classificou como ${classificarPorte(faixa)}`);
  }

  /* Se as duas páginas oferecessem faixas diferentes, o teste A/B compararia
     ofertas diferentes, não layouts. */
  const outras = valoresDeRadio(ler(PAGINAS[1]), 'colaboradores');
  ok(JSON.stringify(faixas) === JSON.stringify(outras),
     'as duas variantes oferecem exatamente as mesmas faixas',
     `v1: ${faixas.join('|')}\n      v2: ${outras.join('|')}`);
}

/* ── 3. Eventos novos aceitos pelo endpoint ───────────────────────────── */

console.log('\neventos do funil');
{
  const formSteps = ler('assets/form-steps.js');
  const tracking  = ler('assets/tracking.js');

  // Todo marcar('x') dos dois arquivos precisa estar na lista fechada do
  // endpoint, senão o evento é recusado com 400 e o degrau some do funil.
  const usados = new Set();
  for (const fonte of [formSteps, tracking]) {
    for (const m of fonte.matchAll(/marcar\('([a-z_0-9]+)'/g)) usados.add(m[1]);
  }

  const recusados = [...usados].filter(e => !EVENTOS_ACEITOS.has(e));
  ok(recusados.length === 0, 'todo evento disparado é aceito por lib/pageviews.js',
     recusados.length ? `recusados: ${recusados.join(', ')}` : '');

  for (const novo of ['pageview', 'passo_2', 'cta_chip', 'clube']) {
    ok(EVENTOS_ACEITOS.has(novo), `evento "${novo}" está na lista de aceitos`);
  }
  ok(usados.has('pageview'), 'o beacon marca "pageview" (base do visitante distinto)');
}

console.log(falhas === 0
  ? '\nOK — contrato do formulário de dois passos íntegro.'
  : `\n${falhas} falha(s).`);

process.exit(falhas === 0 ? 0 : 1);
