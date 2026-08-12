'use strict';

/**
 * Teste offline da seleção de abas em lib/sheets.js
 * (node scripts/test-sheets-abas.js). Nenhuma chamada de rede: o fetch global
 * é substituído por um stub que devolve CSV de mentira.
 *
 * O que motivou este teste
 * ------------------------
 * O export do formulário instantâneo da Central não vive numa aba só. Quando
 * uma enche, alguém cria a seguinte — "Leads Forms" (21/12/2025 a 06/04/2026)
 * e depois "Leads Forms 2" (06/04/2026 em diante). O código lia UM gid, então
 * no dia em que a segunda aba nasceu os 793 leads da primeira sumiram do
 * dashboard e da varredura do LeadQualificado. Sem erro nenhum: a leitura
 * continuava respondendo 200 com metade dos leads.
 *
 * Cobertura:
 *   1. LEADS_SHEET_GID_FORMS aceita vários gids separados por vírgula.
 *   2. Todas as abas configuradas voltam de readAllTabs (CSV).
 *   3. O mesmo vale no caminho da Service Account.
 *   4. Um gid configurado que não existe na planilha é denunciado, não
 *      engolido — era o silêncio que escondia o problema.
 *   5. Sem gid nenhum configurado, a Service Account lê todas as abas.
 */

process.env.LEADS_SHEET_ID = '1cedv5kfJhdwcySI1KcqQM4jS_LjIPnUhdYv1aU-SMxg';
delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_PRIVATE_KEY;
delete process.env.LEADS_SHEET_CSV_URLS;

let falhas = 0;
function ok(cond, titulo, detalhe) {
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${titulo}${detalhe !== undefined ? ` — ${detalhe}` : ''}`);
  if (!cond) falhas++;
}

/* ── stub de rede ─────────────────────────────────────────────────────── */

// gid -> conteúdo CSV. Uma linha de export do Meta por aba, com id próprio.
const ABAS_CSV = {
  '111': 'id,created_time,ad_id\nl:100,2026-02-01T10:00:00-03:00,ag:1\n',
  '1331027312': 'id,created_time,ad_id\nl:200,2026-07-01T10:00:00-03:00,ag:2\n',
};

const urlsPedidas = [];
global.fetch = async (url) => {
  urlsPedidas.push(String(url));
  const gid = (String(url).match(/[?&]gid=(\d+)/) || [])[1];
  const corpo = ABAS_CSV[gid];
  if (corpo === undefined) {
    return { ok: false, status: 404, headers: { get: () => 'text/plain' }, text: async () => '' };
  }
  return { ok: true, status: 200, headers: { get: () => 'text/csv' }, text: async () => corpo };
};

const avisos = [];
const warnOriginal = console.warn;
console.warn = (...a) => { avisos.push(a.join(' ')); };

const { readAllTabs } = require('../lib/sheets');

/* ── cenários ─────────────────────────────────────────────────────────── */

async function main() {
  console.log('\n— CSV com dois gids —');
  process.env.LEADS_SHEET_GID_FORMS = '111,1331027312';
  urlsPedidas.length = 0;
  let abas = await readAllTabs();
  ok(abas.length === 2, 'as duas abas configuradas são lidas', `${abas.length} aba(s)`);
  ok(urlsPedidas.some(u => u.includes('gid=111')), 'pediu a aba antiga (gid 111)');
  ok(urlsPedidas.some(u => u.includes('gid=1331027312')), 'pediu a aba nova (gid 1331027312)');
  const ids = abas.flatMap(a => a.rows.map(r => r[0])).filter(x => /^l:/.test(x));
  ok(ids.length === 2 && ids.includes('l:100') && ids.includes('l:200'),
     'os leads das duas abas chegam juntos', ids.join(' '));

  console.log('\n— CSV com um gid só (comportamento antigo, ainda válido) —');
  process.env.LEADS_SHEET_GID_FORMS = '1331027312';
  abas = await readAllTabs();
  ok(abas.length === 1, 'um gid configurado lê uma aba', `${abas.length} aba(s)`);

  console.log('\n— CSV com espaços e vírgula sobrando —');
  process.env.LEADS_SHEET_GID_FORMS = ' 111 , 1331027312 ,';
  abas = await readAllTabs();
  ok(abas.length === 2, 'lista tolerante a espaço e vírgula final', `${abas.length} aba(s)`);

  console.log('\n— CSV com um gid inexistente no meio —');
  avisos.length = 0;
  process.env.LEADS_SHEET_GID_FORMS = '111,999999';
  abas = await readAllTabs();
  ok(abas.length === 1, 'a aba que existe continua vindo', `${abas.length} aba(s)`);
  ok(avisos.some(a => a.includes('999999')),
     'o gid que não existe vira aviso, não silêncio', avisos.join(' | ') || '(nenhum aviso)');

  /* ── Service Account ───────────────────────────────────────────────── */

  console.log('\n— Service Account com dois gids —');
  const TABS_API = [
    { properties: { sheetId: 111, title: 'Leads Forms' } },
    { properties: { sheetId: 1331027312, title: 'Leads Forms 2' } },
    { properties: { sheetId: 777, title: 'Eventos Geral' } },
  ];
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'x', expires_in: 3600 }) };
    }
    if (u.includes('values:batchGet')) {
      const n = (u.match(/ranges=/g) || []).length;
      return { ok: true, status: 200,
               json: async () => ({ valueRanges: Array.from({ length: n }, (_, i) => ({ values: [[`l:${i}`]] })) }) };
    }
    return { ok: true, status: 200, json: async () => ({ sheets: TABS_API }) };
  };
  // Chave só para o formato — nada é assinado de verdade porque o token é stub.
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'x@y.iam.gserviceaccount.com';
  process.env.GOOGLE_PRIVATE_KEY = require('crypto')
    .generateKeyPairSync('rsa', { modulusLength: 2048 })
    .privateKey.export({ type: 'pkcs8', format: 'pem' });

  process.env.LEADS_SHEET_GID_FORMS = '111,1331027312';
  abas = await readAllTabs();
  ok(abas.length === 2, 'Service Account também lê as duas abas', `${abas.length} aba(s)`);
  ok(abas.every(a => a.titulo !== 'Eventos Geral'), 'e não arrasta as abas de outro formato');

  console.log('\n— Service Account sem gid configurado —');
  delete process.env.LEADS_SHEET_GID_FORMS;
  abas = await readAllTabs();
  ok(abas.length === 2, 'acha as abas do export pelo título, sem configuração',
     abas.map(a => a.titulo).join(' + '));
  ok(abas.every(a => /^Leads Forms/.test(a.titulo)), 'e só elas');

  console.log('\n— Service Account, aba nova aparecendo sozinha —');
  TABS_API.push({ properties: { sheetId: 424242, title: 'Leads Forms 3' } });
  abas = await readAllTabs();
  ok(abas.length === 3, 'a próxima aba entra sem ninguém mexer na configuração',
     abas.map(a => a.titulo).join(' + '));

  console.log('\n— Service Account com títulos fora do padrão —');
  const salvo = TABS_API.splice(0, TABS_API.length,
    { properties: { sheetId: 1, title: 'Eventos Geral' } },
    { properties: { sheetId: 2, title: 'base' } });
  abas = await readAllTabs();
  ok(abas.length === 2, 'sem aba de export, não devolve vazio — cai para todas',
     `${abas.length} aba(s)`);
  TABS_API.splice(0, TABS_API.length, ...salvo);

  console.warn = warnOriginal;
  console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo certo\n');
  process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.warn = warnOriginal; console.error(e); process.exit(1); });
