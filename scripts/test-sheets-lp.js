'use strict';

/**
 * Teste offline da leitura da planilha do Respondi (LP)
 * (node scripts/test-sheets-lp.js). Nenhuma chamada de rede.
 *
 * A planilha de LP é do cliente (bruno@sevilhaperformance.com.br) e hoje só é
 * legível porque está aberta a quem tem o link — com nome, e-mail e telefone
 * de mais de mil leads dentro. Ler por Service Account é o que permite fechar
 * o acesso público.
 *
 * O risco de ligar isso é trocar uma leitura que funciona por uma que depende
 * de o cliente ter compartilhado a planilha com a conta de serviço. Enquanto
 * ele não compartilhar, a leitura precisa continuar de pé pelo CSV — mas
 * dizendo em voz alta que caiu para o plano B, senão vira o mesmo silêncio que
 * escondeu a aba faltando no FORMS por quatro meses.
 *
 * Cobertura:
 *   1. Sem Service Account, segue por CSV público (comportamento de hoje).
 *   2. LEADS_SHEET_LP_GID aceita vários gids.
 *   3. Com Service Account e planilha compartilhada, lê pela API.
 *   4. Com Service Account e planilha NÃO compartilhada, avisa e cai para o
 *      CSV — sem perder lead nenhum.
 *   5. Se os dois caminhos falharem, o erro diz o que foi tentado.
 */

const crypto = require('crypto');

delete process.env.LEADS_SHEET_LP_GID;
process.env.LEADS_SHEET_LP_ID = '1_Y8o6WDFUSpThp8R519QC7t6A0nfh8fFER0oxacZVH0';

let falhas = 0;
function ok(cond, titulo, detalhe) {
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${titulo}${detalhe !== undefined ? ` — ${detalhe}` : ''}`);
  if (!cond) falhas++;
}

/* ── stubs ────────────────────────────────────────────────────────────── */

const CABECALHO = 'Qual seu nome?,Qual seu e-mail?,Qual seu Whatsapp?,Escritório,'
                + 'Qual a sua posição no escritório Contábil?,Quantos colaboradores você tem?,'
                + 'Pontuação,Data,ID,utm_source,utm_medium,utm_campaign,utm_term,utm_content,gclid,fbclid';
const linhaCsv = (nome, id) =>
  `${nome},${nome}@ex.com,55 31 90000-0000,,Dono/Sócio,10 à 19,0,2026-08-01 10:00:00,${id},`
  + 'Instagram_Feed,Warm,[SE] [LEAD] [HOT],120222095208110526,AD16,,';

// gid -> CSV. Sem gid na URL, o /export devolve a primeira aba.
const CSV = {
  '':      `${CABECALHO}\n${linhaCsv('Ana', 'a1')}\n`,
  '0':     `${CABECALHO}\n${linhaCsv('Ana', 'a1')}\n`,
  '99':    `${CABECALHO}\n${linhaCsv('Bruno', 'b1')}\n`,
};

const avisos = [];
const warnOriginal = console.warn;
console.warn = (...a) => { avisos.push(a.join(' ')); };

let modoSA = 'ok';   // 'ok' | 'negado'
let pediuCsv = [];

function instalarFetch() {
  pediuCsv = [];
  global.fetch = async (url) => {
    const u = String(url);

    if (u.includes('oauth2.googleapis.com')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'x', expires_in: 3600 }) };
    }

    if (u.includes('sheets.googleapis.com')) {
      if (modoSA === 'negado') {
        return { ok: false, status: 403,
                 json: async () => ({ error: { message: 'The caller does not have permission' } }) };
      }
      if (u.includes('values:batchGet')) {
        const n = (u.match(/ranges=/g) || []).length;
        return { ok: true, status: 200, json: async () => ({
          valueRanges: Array.from({ length: n }, () => ({
            values: [CABECALHO.split(','), linhaCsv('Ana', 'a1').split(',')],
          })),
        }) };
      }
      return { ok: true, status: 200, json: async () => ({
        sheets: [{ properties: { sheetId: 0, title: 'Página1' } }],
      }) };
    }

    // docs.google.com/export
    const gid = (u.match(/[?&]gid=(\d+)/) || [])[1] || '';
    pediuCsv.push(gid);
    const corpo = CSV[gid];
    if (corpo === undefined) {
      return { ok: false, status: 404, headers: { get: () => 'text/plain' }, text: async () => '' };
    }
    return { ok: true, status: 200, headers: { get: () => 'text/csv' }, text: async () => corpo };
  };
}

const { readLPTabs } = require('../lib/sheets');

function comSA(ligada) {
  if (!ligada) {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    return;
  }
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'leitor@projeto.iam.gserviceaccount.com';
  process.env.GOOGLE_PRIVATE_KEY = crypto
    .generateKeyPairSync('rsa', { modulusLength: 2048 })
    .privateKey.export({ type: 'pkcs8', format: 'pem' });
}

/** Nome do lead em cada aba, para provar que o conteúdo chegou. */
const nomes = abas => abas.flatMap(a => a.rows.slice(1).map(r => r[0])).filter(Boolean);

/* ── cenários ─────────────────────────────────────────────────────────── */

async function main() {
  console.log('\n— sem Service Account: CSV público, como hoje —');
  comSA(false); instalarFetch();
  let abas = await readLPTabs();
  ok(abas.length === 1, 'lê a primeira aba', `${abas.length} aba(s)`);
  ok(nomes(abas).includes('Ana'), 'com o conteúdo da planilha', nomes(abas).join(','));

  console.log('\n— sem Service Account, dois gids configurados —');
  process.env.LEADS_SHEET_LP_GID = '0,99';
  instalarFetch();
  abas = await readLPTabs();
  ok(abas.length === 2, 'lê as duas abas', `${abas.length} aba(s)`);
  ok(nomes(abas).join(',') === 'Ana,Bruno', 'o conteúdo das duas chega', nomes(abas).join(','));
  delete process.env.LEADS_SHEET_LP_GID;

  console.log('\n— com Service Account e planilha compartilhada —');
  comSA(true); modoSA = 'ok'; instalarFetch(); avisos.length = 0;
  abas = await readLPTabs();
  ok(abas.length === 1, 'lê pela API do Sheets', `${abas.length} aba(s)`);
  ok(nomes(abas).includes('Ana'), 'com o conteúdo', nomes(abas).join(','));
  ok(pediuCsv.length === 0, 'e nem tenta o CSV público', `${pediuCsv.length} tentativa(s)`);

  console.log('\n— com Service Account e planilha NÃO compartilhada —');
  comSA(true); modoSA = 'negado'; instalarFetch(); avisos.length = 0;
  abas = await readLPTabs();
  ok(abas.length === 1, 'cai para o CSV e continua lendo', `${abas.length} aba(s)`);
  ok(nomes(abas).includes('Ana'), 'sem perder lead', nomes(abas).join(','));
  ok(avisos.some(a => /respondi|lp/i.test(a)),
     'e avisa que caiu para o plano B', avisos.join(' | ') || '(nenhum aviso)');

  console.log('\n— com Service Account negada e CSV também fora —');
  comSA(true); modoSA = 'negado';
  instalarFetch();
  const semCsv = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('docs.google.com')) {
      return { ok: false, status: 403, headers: { get: () => 'text/html' }, text: async () => '<html>' };
    }
    return semCsv(url);
  };
  let erro = null;
  try { await readLPTabs(); } catch (e) { erro = e; }
  ok(erro !== null, 'falha em vez de devolver vazio');
  ok(erro && /respondi/i.test(erro.message), 'e o erro diz qual planilha era', erro && erro.message);

  console.log('\n— o caminho usado fica marcado na aba —');
  comSA(true); modoSA = 'ok'; instalarFetch();
  abas = await readLPTabs();
  ok(abas.every(a => a.modo === 'service-account'),
     'lida pela API, a aba vem marcada como service-account', abas.map(a => a.modo).join(','));
  comSA(false); instalarFetch();
  abas = await readLPTabs();
  ok(abas.every(a => a.modo === 'csv-publico'),
     'lida por CSV, vem marcada como csv-publico', abas.map(a => a.modo).join(','));
  comSA(true); modoSA = 'negado'; instalarFetch();
  abas = await readLPTabs();
  ok(abas.every(a => a.modo === 'csv-publico'),
     'e na queda para o plano B a marca acompanha a realidade', abas.map(a => a.modo).join(','));

  console.warn = warnOriginal;
  console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo certo\n');
  process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.warn = warnOriginal; console.error(e); process.exit(1); });
