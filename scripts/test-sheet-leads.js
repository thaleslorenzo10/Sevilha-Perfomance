'use strict';

/**
 * Teste offline de /api/sheet-leads (node scripts/test-sheet-leads.js).
 *
 * Substitui as leituras de planilha por abas em memória ANTES de carregar o
 * handler — o require de api/sheet-leads.js desestrutura lib/sheets na carga,
 * então a ordem aqui importa. Nenhuma chamada de rede acontece.
 *
 * O que está coberto:
 *   1. LP vem da planilha do Respondi (integração direta), não da Central.
 *   2. Linha do Respondi sem e-mail E sem telefone (abandono de formulário)
 *      não conta como lead.
 *   3. Toda submissão conta, inclusive de quem já se inscreveu antes. O que
 *      colapsa é a linha idêntica repetida na planilha (mesmo id de submissão).
 *   4. Abas da Central com formato de LP (ex.: a aba morta "base") não geram
 *      lead LP — senão o período abr–set/2025 contaria em dobro.
 *   5. FORMS continua sendo extraído da Central como sempre.
 *   6. Campos de qualificação do formato Respondi (cargo, colaboradores)
 *      alimentam o dashboard.
 *
 * Se o CSV real da planilha do Respondi existir (TEST_RESPONDI_CSV), roda uma
 * validação de ponta a ponta com os números do dossiê de 06/08/2026.
 */

const fs = require('fs');
const path = require('path');

// Sem gids configurados o código não deve tentar filtrar nada nos stubs.
delete process.env.LEADS_SHEET_GID_LP;
delete process.env.LEADS_SHEET_GID_FORMS;
delete process.env.LEADS_SHEET_LP_ID;
delete process.env.LEADS_SHEET_LP_GID;

/* ── Fixtures ────────────────────────────────────────────────────────── */

const HDR_RESPONDI = [
  'Qual seu nome?', 'Qual seu e-mail?', 'Qual seu Whatsapp?',
  'Qual o nome do Escritório de Contabilidade?',
  'Qual a sua posição no escritório Contábil?', 'Quantos colaboradores você tem?',
  'Pontuação', 'Data', 'ID', 'utm_source', 'utm_medium', 'utm_campaign',
  'utm_term', 'utm_content', 'gclid', 'fbclid',
];

function linhaRespondi({ nome, email = '', fone = '', cargo = '', colab = '', data, id, campanha = '[SE] [LEAD] [HOT] [FASE01]', anuncio = '' }) {
  return [nome, email, fone, '', cargo, colab, '0', data, id,
          'Instagram_Feed', 'Warm', campanha, '', anuncio, '', ''];
}

const ABA_RESPONDI = {
  gid: '0', titulo: 'respondi', rows: [
    HDR_RESPONDI,
    // lead completo — conta
    linhaRespondi({ nome: 'Ana', email: 'ana@ex.com', fone: '55 11 91111-1111',
                    cargo: 'Dono/Sócio', colab: '10 à 19', data: '2026-08-01 10:00:00', id: 'uuid-1' }),
    // Ana volta e preenche de novo: submissão nova, id novo — conta como
    // segundo lead. Quem já se inscreveu antes não deixa de contar.
    linhaRespondi({ nome: 'Ana', email: 'ana@ex.com', fone: '', data: '2026-08-01 10:05:00', id: 'uuid-2' }),
    // só e-mail — conta
    linhaRespondi({ nome: 'Beto', email: 'beto@ex.com', cargo: 'Cargo_Gerencial',
                    colab: '0 à 9', data: '2026-08-02 09:00:00', id: 'uuid-3' }),
    // só telefone — conta
    linhaRespondi({ nome: 'Carla', fone: '55 21 92222-2222', data: '2026-08-02 11:00:00', id: 'uuid-4' }),
    // Carla também volta — outro id, outro lead.
    linhaRespondi({ nome: 'Carla', fone: '55 21 92222-2222', data: '2026-08-02 11:03:00', id: 'uuid-5' }),
    // Linha IDÊNTICA à anterior, mesmo id: a integração às vezes grava a mesma
    // submissão duas vezes. Isso é o mesmo lead, não dois.
    linhaRespondi({ nome: 'Carla', fone: '55 21 92222-2222', data: '2026-08-02 11:03:00', id: 'uuid-5' }),
    // abandono: sem e-mail e sem telefone — NÃO conta
    linhaRespondi({ nome: 'Rodrigo', data: '2026-08-03 08:00:00', id: 'uuid-6' }),
    // lead de teste do Meta — NÃO conta (regra que já existia)
    linhaRespondi({ nome: 'Test', email: 'test@meta.com', data: '2026-08-03 09:00:00', id: 'uuid-7' }),
  ],
};

// Registro no formato do export do Meta (23 colunas, id auto-identificável).
function linhaMeta(id, quando) {
  const r = new Array(23).fill('');
  r[0] = id; r[1] = quando;
  r[3] = 'AD01'; r[5] = 'Adset'; r[7] = '[SE] [FORMS] 2'; r[9] = 'Form Nativo';
  r[11] = 'ig'; r[12] = 'De 10 a 19'; r[13] = 'dono / sócio';
  return r;
}

const ABAS_CENTRAL = [
  { gid: '111', titulo: 'Leads Forms', rows: [linhaMeta('l:100', '2026-08-01T12:00:00-03:00')] },
  // Aba "base" (a antiga "Leads Respondi", morta desde set/2025): tem formato
  // de LP e um contato válido — não pode virar lead LP de novo.
  { gid: '222', titulo: 'base', rows: [
    ['', 'Qual seu nome?', 'Qual seu e-mail?', 'Qual seu Whatsapp?', 'Cargo que Ocupa',
     'Quantos colaboradores você tem?', 'F1', 'F2', 'Status', 'Status', 'DATA STATUS',
     'observação', 'DATA PRÓXIMO CONTATO:', 'DATA ENTRADA', 'Apresentaçao'],
    ['', 'Duplicado', 'outro@ex.com', '55 31 93333-3333', 'Dono/Sócio', '0 à 9',
     '', '', 'Com Perfil', '', '', '', '', '01/08/2026', ''],
  ] },
];

/* ── Stubs antes de carregar o handler ───────────────────────────────── */

// O handler desestrutura lib/sheets na carga, então os stubs precisam estar
// no lugar antes do require — e delegar a variáveis para o segundo cenário
// (CSV real) poder trocar as abas sem recarregar módulo.
let abasCentral = ABAS_CENTRAL;
let abasLP      = [ABA_RESPONDI];

const sheets = require('../lib/sheets');
sheets.readAllTabs = async () => abasCentral;
sheets.readLPTabs  = async () => abasLP;

const { montarLeads } = require('../api/sheet-leads');

/* ── Asserções ───────────────────────────────────────────────────────── */

let falhas = 0;
function ok(cond, msg, extra) {
  if (cond) { console.log(`  ✓ ${msg}`); return; }
  falhas++;
  console.error(`  ✗ ${msg}${extra !== undefined ? ` — obtido: ${JSON.stringify(extra)}` : ''}`);
}

async function fixtures() {
  console.log('— fixtures sintéticas —');
  const r = await montarLeads('2026-08-01', '2026-08-31');

  ok(r.por_formato.LP === 5,
     'toda submissão com contato conta, inclusive de quem já se inscreveu (5)', r.por_formato.LP);
  ok(r.total === 6, 'linha idêntica repetida na planilha conta uma vez só', r.total);
  ok(r.por_formato.FORMS === 1,
     'FORMS vem da Central, e a aba "base" não gera lead LP', r.por_formato.FORMS);

  const dias = Object.fromEntries(r.por_dia.map(d => [d.data, d.LP]));
  ok(dias['2026-08-01'] === 2 && dias['2026-08-02'] === 3 && !dias['2026-08-03'],
     'série diária LP conta cada submissão, e nada em dia sem lead contável', r.por_dia);

  ok(r.qualificacao.cargo['Dono / Sócio'] >= 1 && r.qualificacao.cargo['Cargo gerencial'] === 1,
     'cargo do formato Respondi alimenta a qualificação', r.qualificacao.cargo);
  ok(r.porte.MAIOR_10 === 2 && r.porte.MENOR_10 === 1,
     'porte por colaboradores (10 à 19 + FORMS → 2 maiores; 0 à 9 → 1 menor)', r.porte);

  const camp = r.por_campanha.find(c => c.campanha === '[SE] [LEAD] [HOT] [FASE01]');
  ok(camp && camp.leads === 5, 'campanha [SE] [LEAD] agregada a partir do Respondi', r.por_campanha);
  ok(r.cobertura.LP.ultimo === '2026-08-02',
     'cobertura LP considera só leads contáveis', r.cobertura.LP);
}

/* ── Validação com o CSV real (opcional) ─────────────────────────────── */

const CSV_REAL = process.env.TEST_RESPONDI_CSV
  || path.join(__dirname, '..', 'respondi-novo-completo.csv');

async function csvReal() {
  if (!fs.existsSync(CSV_REAL)) {
    console.log(`— CSV real não encontrado (${CSV_REAL}) — validação pulada —`);
    return;
  }
  console.log('— CSV real da planilha do Respondi —');
  const rows = sheets.parseCsv(fs.readFileSync(CSV_REAL, 'utf8'));
  abasLP      = [{ gid: '0', titulo: 'respondi', rows }];
  abasCentral = [];

  const r = await montarLeads('2025-01-01', '2026-12-31');

  // Cálculo independente da mesma regra: uma entrada por chave e-mail-ou-fone,
  // ignorando linhas sem contato e leads de teste (test@meta.com).
  const hdr = rows[0];
  const iE = hdr.indexOf('Qual seu e-mail?'), iF = hdr.indexOf('Qual seu Whatsapp?');
  const iId = hdr.indexOf('ID');
  const chaves = new Set();
  for (const row of rows.slice(1)) {
    const email = String(row[iE] || '').trim();
    const fone  = String(row[iF] || '').trim();
    if (!email && !fone) continue;
    if (/test@meta\.com/i.test(row.join(' '))) continue;
    chaves.add(String(row[iId] || '').trim() || email || fone);
  }
  ok(r.por_formato.LP === chaves.size,
     `LP real = 1 lead por submissão (${chaves.size})`, r.por_formato.LP);
  ok(r.por_formato.FORMS === 0, 'nada do Respondi vaza para FORMS', r.por_formato.FORMS);
  // A data final nao pode ser fixa: a planilha recebe lead todo dia.
  ok(r.cobertura.LP.primeiro === '2025-04-28' && r.cobertura.LP.ultimo >= '2026-08-09',
     'cobertura real comeca em 2025-04-28 e alcanca o presente', r.cobertura.LP);
}

(async () => {
  try {
    await fixtures();
    await csvReal();
  } catch (err) {
    falhas++;
    console.error('  ✗ exceção:', err.message);
  }
  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo verde');
  process.exit(falhas ? 1 : 0);
})();
