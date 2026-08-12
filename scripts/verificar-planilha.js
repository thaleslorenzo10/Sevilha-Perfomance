'use strict';

/**
 * Confere a leitura das planilhas de leads (node scripts/verificar-planilha.js).
 *
 * Existe porque o jeito como isso quebra é em silêncio: aba faltando não dá
 * erro, dá menos lead. Entre abr/2026 e ago/2026 o dashboard leu 773 dos 1.564
 * leads que a Central tinha e nada em lugar nenhum reclamou. Este script diz,
 * em voz alta, quantas abas entraram e quantos leads vieram de cada uma.
 *
 * Roda com as mesmas variáveis do Vercel:
 *   LEADS_SHEET_ID + LEADS_SHEET_GID_FORMS            (modo CSV)
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY (modo Service Account)
 *
 * Um .env na raiz é carregado se existir, para não precisar exportar tudo à mão.
 */

const fs = require('fs');
const path = require('path');

/* ── .env opcional ────────────────────────────────────────────────────── */

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const linha of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    // Aspas ao redor são do formato do arquivo, não do valor.
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
  console.log(`(variáveis lidas de ${envPath})\n`);
}

const { readAllTabs, readLPTabs } = require('../lib/sheets');
const { extrairForms, extrairLP } = require('./leads-10mais');

const temSA = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
const gids  = String(process.env.LEADS_SHEET_GID_FORMS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

let alertas = 0;
const alerta = msg => { alertas++; console.log(`  ⚠  ${msg}`); };

async function main() {
  console.log('CENTRAL DE EVENTOS — export do formulário instantâneo');
  console.log('─'.repeat(72));
  console.log(`  modo ................ ${temSA ? 'Service Account' : 'CSV público por gid'}`);
  if (temSA) console.log(`  conta de serviço .... ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
  console.log(`  planilha ............ ${process.env.LEADS_SHEET_ID || '(não configurada)'}`);
  console.log(`  gids configurados ... ${gids.length ? gids.join(', ') : '(nenhum)'}`);

  // A armadilha: com Service Account e gid configurado, a descoberta por
  // título não roda e continua lendo só a aba listada.
  if (temSA && gids.length) {
    alerta('com Service Account, LEADS_SHEET_GID_FORMS deveria ficar VAZIO — '
         + 'com ele preenchido, só as abas listadas são lidas e a próxima que '
         + 'alguém criar continuará invisível.');
  }
  if (!temSA && gids.length < 2) {
    alerta('no modo CSV, cada aba do export precisa do seu gid. Hoje existem '
         + 'pelo menos duas ("Leads Forms" e "Leads Forms 2").');
  }

  let abas;
  try {
    abas = await readAllTabs();
  } catch (e) {
    console.log(`\n  ✗ não deu para ler: ${e.message}`);
    if (e.tentativas) e.tentativas.forEach(t => console.log(`      ${t}`));
    process.exit(1);
  }

  console.log(`\n  abas lidas: ${abas.length}`);
  let total = 0;
  for (const aba of abas) {
    const leads = extrairForms([aba]);
    total += leads.length;
    const datas = leads.map(l => l.data).filter(Boolean).sort();
    const periodo = datas.length ? `${datas[0]} → ${datas[datas.length - 1]}` : 'sem lead de formulário';
    console.log(`    · ${String(aba.titulo).padEnd(22)} gid ${String(aba.gid).padEnd(12)} `
              + `${String(leads.length).padStart(5)} leads  ${periodo}`);
  }

  // Deduplicado, que é como api/sheet-leads.js conta.
  const unicos = extrairForms(abas);
  console.log(`\n  total de leads de FORMS: ${unicos.length}`);
  if (unicos.length !== total) {
    console.log(`  (${total - unicos.length} repetidos entre abas, descartados)`);
  }
  if (!unicos.length) alerta('nenhum lead de formulário encontrado — confira os gids.');

  const q = unicos.filter(l => l.porte === 'MAIOR_10').length;
  console.log(`  destes, 10+ colaboradores: ${q} (${(100 * q / (unicos.length || 1)).toFixed(1)}%)`);

  // Continuidade: buraco grande entre uma aba e a seguinte costuma ser aba
  // que ninguém listou.
  const dias = [...new Set(unicos.map(l => l.data).filter(Boolean))].sort();
  if (dias.length > 1) {
    let maior = 0, onde = '';
    for (let i = 1; i < dias.length; i++) {
      const g = (new Date(dias[i]) - new Date(dias[i - 1])) / 86400000;
      if (g > maior) { maior = g; onde = `${dias[i - 1]} → ${dias[i]}`; }
    }
    console.log(`  período coberto: ${dias[0]} → ${dias[dias.length - 1]}`);
    if (maior > 7) alerta(`buraco de ${Math.round(maior)} dias sem lead nenhum (${onde}) — pode ser aba faltando.`);
  }

  /* ── LP ────────────────────────────────────────────────────────────── */

  console.log('\n\nPLANILHA DO RESPONDI — landing page');
  console.log('─'.repeat(72));
  console.log('  (sempre por CSV público; a Service Account não alcança esta planilha)');
  try {
    const lp = extrairLP(await readLPTabs());
    const datas = lp.map(l => l.data).filter(Boolean).sort();
    console.log(`  leads: ${lp.length}   ${datas[0]} → ${datas[datas.length - 1]}`);
    const semUtm = lp.filter(l => !l.adsetId).length;
    console.log(`  sem utm_term (não dá para atribuir ao público): ${semUtm}`);
  } catch (e) {
    console.log(`  ✗ não deu para ler: ${e.message}`);
    alertas++;
  }

  console.log('\n' + '─'.repeat(72));
  console.log(alertas ? `${alertas} ponto(s) de atenção acima.` : 'Tudo certo.');
  process.exit(alertas ? 1 : 0);
}

main().catch(e => { console.error('\nFalhou:', e.message); process.exit(1); });
