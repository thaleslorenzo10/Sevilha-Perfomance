'use strict';

/**
 * Leitura da planilha de leads do Google Sheets.
 *
 * Dois modos, nesta ordem de preferência:
 *
 *  1. CSV por ID + gid (padrão — mesmo esquema do dashboard da Ambiental Pro)
 *       LEADS_SHEET_ID        = 1cedv5kfJhdwcySI1KcqQM4jS_LjIPnUhdYv1aU-SMxg
 *       LEADS_SHEET_GID_LP    = 1200600305
 *       LEADS_SHEET_GID_FORMS = 1331027312
 *     A planilha precisa estar compartilhada como "qualquer pessoa com o link
 *     pode ver". Sem credencial nenhuma.
 *
 *  2. Service Account (opcional — mantém a planilha privada)
 *       GOOGLE_SERVICE_ACCOUNT_EMAIL = conta@projeto.iam.gserviceaccount.com
 *       GOOGLE_PRIVATE_KEY           = -----BEGIN PRIVATE KEY-----\n...
 *     Se estas duas estiverem definidas, têm prioridade sobre o CSV.
 *
 * Abas usadas (planilha [CENTRAL DE EVENTOS] Sevilha Perfomance):
 *   LEADS_SHEET_GID_LP    = 1200600305  → "Leads Respondi"  (campanhas [SE] [LEAD])
 *   LEADS_SHEET_GID_FORMS = 1331027312  → "Leads Formulário Nativo" ([SE] [FORMS])
 * Se não forem informados, todas as abas são lidas e identificadas pelo cabeçalho.
 *
 * Em qualquer um dos modos a leitura acontece no servidor e só agregados
 * saem daqui — nome, e-mail e telefone nunca chegam ao navegador.
 */

const crypto = require('crypto');

const TOKEN_URL  = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE      = 'https://www.googleapis.com/auth/spreadsheets.readonly';

/* ── Auth ────────────────────────────────────────────────────────────── */

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function getServiceAccount() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // A chave costuma ser colada com \n literal nas variáveis do Vercel.
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) return null;
  return { email, key };
}

let cachedToken = null; // { token, exp }

async function getAccessToken() {
  const sa = getServiceAccount();
  if (!sa) throw new Error('Service Account do Google não configurada');

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim  = b64url(JSON.stringify({
    iss:   sa.email,
    scope: SCOPE,
    aud:   TOKEN_URL,
    iat:   now,
    exp:   now + 3600,
  }));

  const signature = crypto.createSign('RSA-SHA256')
    .update(`${header}.${claim}`)
    .sign(sa.key);

  const jwt = `${header}.${claim}.${b64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Falha ao autenticar no Google: ${json.error_description || json.error || res.status}`);
  }

  cachedToken = { token: json.access_token, exp: now + (json.expires_in || 3600) };
  return cachedToken.token;
}

/* ── Leitura ─────────────────────────────────────────────────────────── */

/**
 * Lê as abas da planilha via Sheets API.
 * Retorna [{ gid, titulo, rows }] — o gid permite endereçar a aba certa mesmo
 * que alguém a renomeie (a API de valores trabalha com nome, não com gid).
 */
async function readViaServiceAccount() {
  const sheetId = process.env.LEADS_SHEET_ID;
  if (!sheetId) throw new Error('LEADS_SHEET_ID não configurado');

  const token = await getAccessToken();
  const auth  = { Authorization: `Bearer ${token}` };

  const metaRes = await fetch(
    `${SHEETS_API}/${sheetId}?fields=sheets.properties(sheetId,title)`,
    { headers: auth }
  );
  const metaJson = await metaRes.json();
  if (!metaRes.ok) {
    throw new Error(`Sheets API ${metaRes.status}: ${metaJson.error?.message || 'erro'}`);
  }

  let abas = (metaJson.sheets || []).map(s => ({
    gid:    String(s.properties.sheetId),
    titulo: s.properties.title,
  }));
  if (!abas.length) return [];

  // Se os gids das abas de lead foram informados, lê só elas — menos dados
  // trafegados e imune a outras abas de trabalho da planilha.
  const gidsAlvo = [process.env.LEADS_SHEET_GID_LP, process.env.LEADS_SHEET_GID_FORMS]
    .filter(Boolean).map(String);
  if (gidsAlvo.length) {
    const filtradas = abas.filter(a => gidsAlvo.includes(a.gid));
    if (filtradas.length) abas = filtradas;
    else console.warn('[sheets] gids configurados não encontrados; lendo todas as abas');
  }

  const ranges = abas
    .map(a => `ranges=${encodeURIComponent(`'${a.titulo.replace(/'/g, "''")}'`)}`)
    .join('&');
  const valRes = await fetch(
    `${SHEETS_API}/${sheetId}/values:batchGet?${ranges}&majorDimension=ROWS`,
    { headers: auth }
  );
  const valJson = await valRes.json();
  if (!valRes.ok) {
    throw new Error(`Sheets API ${valRes.status}: ${valJson.error?.message || 'erro'}`);
  }

  return abas.map((a, i) => ({ ...a, rows: valJson.valueRanges?.[i]?.values || [] }));
}

/** Parser de CSV tolerante a aspas, vírgulas e quebras de linha dentro do campo. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Monta as URLs de CSV a partir do ID da planilha e dos gids das abas.
 *
 * Usa o endpoint /export em vez do gviz: o gviz para de ler na primeira linha
 * em branco do meio da aba, o /export devolve a aba inteira.
 *
 * Não exige publicar na web — basta a planilha estar compartilhada como
 * "qualquer pessoa com o link pode ver".
 */
function csvUrlsFromEnv() {
  const explicitas = (process.env.LEADS_SHEET_CSV_URLS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (explicitas.length) return explicitas;

  const id = process.env.LEADS_SHEET_ID;
  if (!id) return [];

  return [process.env.LEADS_SHEET_GID_LP, process.env.LEADS_SHEET_GID_FORMS]
    .filter(Boolean)
    .map(gid => `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`);
}

/** Lê as abas via CSV. */
async function readViaCsv() {
  const urls = csvUrlsFromEnv();
  if (!urls.length) {
    throw new Error(
      'Planilha não configurada: defina LEADS_SHEET_ID com LEADS_SHEET_GID_LP e ' +
      'LEADS_SHEET_GID_FORMS (ou LEADS_SHEET_CSV_URLS).'
    );
  }

  const out = [];
  const erros = [];

  for (const url of urls) {
    const gid = (url.match(/[?&]gid=(\d+)/) || [])[1] || '';
    try {
      const res = await fetch(url, { redirect: 'follow' });

      // Planilha sem acesso público: o Google responde 401/403, ou devolve
      // 200 com a página de login em HTML. Sem esta checagem o CSV "vazio"
      // viraria zero lead em silêncio, que é o pior desfecho possível.
      const tipo = res.headers.get('content-type') || '';
      if (!res.ok) {
        erros.push(`aba ${gid}: HTTP ${res.status}`);
        continue;
      }
      if (tipo.includes('text/html')) {
        erros.push(
          `aba ${gid}: a planilha não está acessível publicamente — ` +
          'compartilhe como "qualquer pessoa com o link pode ver"'
        );
        continue;
      }

      out.push({ gid, titulo: `csv:${gid || out.length}`, rows: parseCsv(await res.text()) });
    } catch (e) {
      erros.push(`aba ${gid}: ${e.message}`);
    }
  }

  if (!out.length) throw new Error(erros.join(' · ') || 'Nenhuma aba pôde ser lida');
  if (erros.length) console.warn('[sheets] abas ignoradas —', erros.join(' · '));

  return out;
}

async function readAllTabs() {
  if (getServiceAccount()) return readViaServiceAccount();
  return readViaCsv();
}

module.exports = { readAllTabs, parseCsv };
