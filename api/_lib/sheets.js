'use strict';

/**
 * Leitura da planilha de leads do Google Sheets.
 *
 * Dois modos, nesta ordem de preferência:
 *
 *  1. Service Account (recomendado — a planilha continua privada)
 *       GOOGLE_SERVICE_ACCOUNT_EMAIL = conta@projeto.iam.gserviceaccount.com
 *       GOOGLE_PRIVATE_KEY           = -----BEGIN PRIVATE KEY-----\n...
 *       LEADS_SHEET_ID               = 1cedv5kfJhdwcySI1KcqQM4jS_LjIPnUhdYv1aU-SMxg
 *     Basta compartilhar a planilha com o e-mail da Service Account (leitor).
 *
 *  2. CSV publicado (fallback rápido, sem credencial)
 *       LEADS_SHEET_CSV_URLS = url1,url2,url3
 *     Atenção: "publicar na web" deixa a planilha acessível a quem tiver a URL.
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

/** Lê as abas a partir de URLs de CSV publicado. */
async function readViaCsv() {
  const urls = (process.env.LEADS_SHEET_CSV_URLS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!urls.length) throw new Error('LEADS_SHEET_CSV_URLS não configurado');

  const out = [];
  for (const url of urls) {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      console.warn('[sheets] CSV falhou', res.status, url);
      continue;
    }
    // O gid vai na própria URL do CSV publicado.
    const gid = (url.match(/[?&]gid=(\d+)/) || [])[1] || '';
    out.push({ gid, titulo: `csv:${gid || out.length}`, rows: parseCsv(await res.text()) });
  }
  return out;
}

async function readAllTabs() {
  if (getServiceAccount()) return readViaServiceAccount();
  return readViaCsv();
}

module.exports = { readAllTabs, parseCsv };
