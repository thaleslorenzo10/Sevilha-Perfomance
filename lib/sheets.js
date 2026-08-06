'use strict';

/**
 * Leitura das planilhas de leads do Google Sheets.
 *
 * Duas fontes independentes, uma por formato de campanha:
 *
 *  • LP — planilha "Respondi | Formulário SEVILHA PERFORMANCE - CONSULTORIA",
 *    preenchida pela integração nativa do Respondi (readLPTabs). É a fonte
 *    primária desde 06/08/2026: a cópia que a automação mantinha na Central
 *    ficou 13 dias sem gravar na virada 2025→2026 e perdeu ~130 leads
 *    (docs/superpowers/specs/2026-08-06-lp-planilha-respondi-design.md).
 *    Sempre lida via CSV público — a planilha é do cliente e está como
 *    "qualquer pessoa com o link pode ver"; a Service Account abaixo não a
 *    alcança. Overrides: LEADS_SHEET_LP_ID (id ou URL) e LEADS_SHEET_LP_GID
 *    (sem ele, a primeira aba — a única que a integração cria).
 *
 *  • FORMS — export do formulário instantâneo do Meta, na planilha
 *    [CENTRAL DE EVENTOS] Sevilha Perfomance (readAllTabs), em um de dois
 *    modos, nesta ordem de preferência:
 *
 *     1. CSV por ID + gid (padrão — mesmo esquema do dashboard da Ambiental Pro)
 *          LEADS_SHEET_ID        = 1cedv5kfJhdwcySI1KcqQM4jS_LjIPnUhdYv1aU-SMxg
 *          LEADS_SHEET_GID_FORMS = 1331027312
 *        A planilha precisa estar compartilhada como "qualquer pessoa com o
 *        link pode ver". Sem credencial nenhuma.
 *
 *     2. Service Account (opcional — mantém a planilha privada)
 *          GOOGLE_SERVICE_ACCOUNT_EMAIL = conta@projeto.iam.gserviceaccount.com
 *          GOOGLE_PRIVATE_KEY           = -----BEGIN PRIVATE KEY-----\n...
 *        Se estas duas estiverem definidas, têm prioridade sobre o CSV.
 *
 *    LEADS_SHEET_GID_LP apontava a cópia de LP na Central ("Leads Respondi",
 *    depois renomeada para "base") — morta desde 15/09/2025. A variável é
 *    ignorada desde a troca de fonte.
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

  // Se o gid da aba de FORMS foi informado, lê só ela — menos dados
  // trafegados e imune a outras abas de trabalho da planilha.
  const gidsAlvo = [process.env.LEADS_SHEET_GID_FORMS]
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
/**
 * Aceita tanto o id puro quanto a URL inteira da planilha colada na variável
 * — colar a URL é o engano mais comum, e sem isto ele produz uma URL sem
 * sentido que o Google rejeita com o mesmo 401 de um problema de permissão.
 */
function normalizeSheetId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const naUrl = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return naUrl ? naUrl[1] : s;
}

function csvUrlsFromEnv() {
  const explicitas = (process.env.LEADS_SHEET_CSV_URLS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (explicitas.length) return explicitas;

  const id = normalizeSheetId(process.env.LEADS_SHEET_ID);
  if (!id) return [];

  return [process.env.LEADS_SHEET_GID_FORMS]
    .filter(Boolean)
    .map(gid => `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`);
}

/**
 * Baixa uma aba em CSV com as checagens de acesso. Planilha sem acesso
 * público se manifesta de duas formas: 401/403, ou 200 devolvendo a página
 * de login em HTML. Sem estas checagens o CSV "vazio" viraria zero lead em
 * silêncio, o pior desfecho possível.
 *
 * A URL tentada vai junto no diagnóstico: sem ela, um id com a URL inteira
 * colada dentro (engano comum) é indistinguível de um problema de permissão —
 * os dois dão 401. O id de uma planilha não é segredo: quem o tem continua
 * sem acesso se ela for privada.
 *
 * Devolve { gid, titulo, rows } ou null, registrando o motivo em erros.
 */
async function fetchCsvTab(url, erros, tentativas) {
  const gid = (url.match(/[?&]gid=(\d+)/) || [])[1] || '';
  try {
    const res = await fetch(url, { redirect: 'follow' });
    tentativas.push(`${url} → HTTP ${res.status}`);

    const tipo = res.headers.get('content-type') || '';
    const semAcesso = res.status === 401 || res.status === 403
      || (res.ok && tipo.includes('text/html'));

    if (semAcesso) {
      erros.push(
        `aba ${gid || 'primeira'}: o Google exigiu login (HTTP ${res.status}) — a planilha não está ` +
        'acessível sem autenticação. Deixe-a como "qualquer pessoa com o link pode ver"'
      );
      return null;
    }
    if (!res.ok) {
      erros.push(`aba ${gid || 'primeira'}: HTTP ${res.status}`);
      return null;
    }

    return { gid, titulo: `csv:${gid || 'primeira'}`, rows: parseCsv(await res.text()) };
  } catch (e) {
    erros.push(`aba ${gid || 'primeira'}: ${e.message}`);
    tentativas.push(`${url} → ${e.message}`);
    return null;
  }
}

/** Lê as abas da Central via CSV. */
async function readViaCsv() {
  const urls = csvUrlsFromEnv();
  if (!urls.length) {
    throw new Error(
      'Planilha não configurada: defina LEADS_SHEET_ID com ' +
      'LEADS_SHEET_GID_FORMS (ou LEADS_SHEET_CSV_URLS).'
    );
  }

  const out = [];
  const erros = [];
  const tentativas = [];

  for (const url of urls) {
    const tab = await fetchCsvTab(url, erros, tentativas);
    if (tab) out.push(tab);
  }

  if (!out.length) {
    const err = new Error(erros.join(' · ') || 'Nenhuma aba pôde ser lida');
    err.tentativas = tentativas;
    throw err;
  }
  if (erros.length) console.warn('[sheets] abas ignoradas —', erros.join(' · '));

  return out;
}

async function readAllTabs() {
  if (getServiceAccount()) return readViaServiceAccount();
  return readViaCsv();
}

/* ── Fonte LP: planilha do Respondi ──────────────────────────────────── */

/**
 * Fica fixa no código de propósito: o id não é segredo e assim a troca de
 * fonte entra em vigor no deploy, sem depender de mexer nas variáveis do
 * Vercel. LEADS_SHEET_LP_ID sobrepõe quando precisar.
 */
const RESPONDI_SHEET_ID = '1_Y8o6WDFUSpThp8R519QC7t6A0nfh8fFER0oxacZVH0';

/**
 * Lê a planilha de leads do Respondi (fonte dos leads de LP). Sempre via CSV
 * público, mesmo quando a Service Account está configurada — a planilha é do
 * cliente e a conta de serviço não tem acesso a ela. Sem gid, o /export
 * devolve a primeira aba, a única que a integração do Respondi cria.
 */
async function readLPTabs() {
  const id  = normalizeSheetId(process.env.LEADS_SHEET_LP_ID) || RESPONDI_SHEET_ID;
  const gid = String(process.env.LEADS_SHEET_LP_GID || '').trim();
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`
            + (gid ? `&gid=${gid}` : '');

  const erros = [];
  const tentativas = [];
  const tab = await fetchCsvTab(url, erros, tentativas);
  if (!tab) {
    const err = new Error(`planilha do Respondi (LP): ${erros.join(' · ')}`);
    err.tentativas = tentativas;
    throw err;
  }
  return [tab];
}

module.exports = { readAllTabs, readLPTabs, parseCsv };
