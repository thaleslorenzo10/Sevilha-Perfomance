'use strict';

/**
 * Leitura das planilhas de leads do Google Sheets.
 *
 * Duas fontes independentes, uma por formato de campanha:
 *
 *  • LP — planilha "Respondi | Formulário SEVILHA PERFORMANCE - CONSULTORIA",
 *    preenchida pela integração nativa do Respondi com o Google Sheets
 *    (readLPTabs). É a fonte primária desde 06/08/2026: a cópia que a Central
 *    recebia ficou 13 dias sem gravar na virada 2025→2026 e perdeu ~130 leads
 *    (docs/superpowers/specs/2026-08-06-lp-planilha-respondi-design.md).
 *    Lida pela Service Account quando ela alcança a planilha, e por CSV
 *    público quando não. A planilha é do cliente e hoje está como "qualquer
 *    pessoa com o link pode ver" — o que expõe nome, e-mail e telefone dos
 *    leads a quem tiver o endereço. Compartilhá-la com a conta de serviço é o
 *    que permite fechar isso sem parar a leitura; até lá o CSV segura, com
 *    aviso no log. Overrides: LEADS_SHEET_LP_ID (id ou URL) e
 *    LEADS_SHEET_LP_GID (lista de gids; sem ela, a primeira aba — a única que
 *    a integração cria).
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
 *    LEADS_SHEET_GID_LP (1200600305) apontava para a aba "Eventos Geral" da
 *    Central, alimentada pelo workflow n8n "[SEVILHA PERFOMANCE] Respondi ->
 *    Sheets -> Pipedrive". Ela continua viva, mas não grava e-mail, telefone
 *    nem cargo, e os buracos que motivaram a troca são execuções falhas desse
 *    workflow. A variável é ignorada desde a troca de fonte.
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

/**
 * Põe a chave privada no formato que o OpenSSL aceita, absorvendo o que
 * acontece com um PEM ao passar por um campo de formulário web.
 *
 * A chave é copiada de dentro de um JSON e colada no painel do Vercel, e
 * cinco recortes diferentes chegam aqui — só dois funcionavam:
 *
 *   quebras de linha de verdade ................... já funcionava
 *   \n literais (valor cru do campo private_key) .. já funcionava
 *   com as aspas do JSON em volta .................. quebrava
 *   achatada numa linha só ......................... quebrava
 *   com espaço ou linha em branco nas pontas ....... quebrava
 *
 * Todas as três últimas são a chave certa com a formatação estragada, e o
 * erro que o OpenSSL devolve para qualquer uma delas é o mesmo
 * "DECODER routines::unsupported", que não diz o que houve. Remontar é seguro:
 * o corpo é base64 e nada nele depende de onde a quebra de linha estava.
 */
function normalizarChave(raw) {
  let k = String(raw || '').trim();
  if (!k) return '';

  // Aspas do JSON, quando o valor é copiado com elas junto.
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  k = k.replace(/\\n/g, '\n');

  const pem = k.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!pem) return k;   // sem cara de PEM: devolve como veio, o erro vem depois

  const corpo = pem[2].replace(/\s+/g, '').match(/.{1,64}/g) || [];
  return `-----BEGIN ${pem[1]}-----\n${corpo.join('\n')}\n-----END ${pem[1]}-----\n`;
}

function getServiceAccount() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = normalizarChave(process.env.GOOGLE_PRIVATE_KEY);
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

  // O erro cru do OpenSSL aqui é "DECODER routines::unsupported", que não diz
  // nada a quem está colando a chave no painel do Vercel pela primeira vez —
  // e o engano quase sempre é o mesmo: colar só um pedaço do JSON, ou perder
  // as quebras de linha no caminho.
  let signature;
  try {
    signature = crypto.createSign('RSA-SHA256')
      .update(`${header}.${claim}`)
      .sign(sa.key);
  } catch (e) {
    // A formatação já foi normalizada em normalizarChave, então o que sobra
    // aqui é conteúdo: ou não é um PEM, ou o PEM está incompleto.
    const pista = !sa.key.includes('BEGIN')
      ? 'o valor não parece um PEM — copie o campo "private_key" do JSON da conta '
        + 'de serviço, do "-----BEGIN" ao "-----END"'
      : 'o trecho entre BEGIN e END não forma uma chave — provavelmente foi copiado '
        + 'pela metade, ou é de outro arquivo';
    throw new Error(`GOOGLE_PRIVATE_KEY inválida: ${pista} (${e.message})`);
  }

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
 * Lê abas de uma planilha pela Sheets API.
 * Retorna [{ gid, titulo, rows }] — o gid permite endereçar a aba certa mesmo
 * que alguém a renomeie (a API de valores trabalha com nome, não com gid).
 *
 * Serve as duas planilhas: `gids` restringe por id de aba, `tituloRe` descobre
 * por nome. Sem nenhum dos dois, lê todas — que é o certo para a planilha do
 * Respondi, onde a integração cria uma aba só e sem padrão de nome.
 */
async function abasViaServiceAccount(sheetId, { gids = [], tituloRe = null, rotulo = 'planilha' } = {}) {
  if (!sheetId) throw new Error(`${rotulo}: id não configurado`);

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

  // Gids informados restringem a leitura — menos dados trafegados e imune a
  // outras abas de trabalho da planilha.
  if (gids.length) {
    const filtradas = abas.filter(a => gids.includes(a.gid));
    const ausentes  = gids.filter(g => !abas.some(a => a.gid === g));
    // Gid configurado que não existe mais é erro de configuração e precisa
    // aparecer: calado, ele vira aba faltando no dashboard sem nenhum sinal.
    if (ausentes.length) {
      console.warn(`[sheets] ${rotulo}: gids configurados e não encontrados: ${ausentes.join(', ')}`);
    }
    if (filtradas.length) abas = filtradas;
    else console.warn(`[sheets] ${rotulo}: nenhum gid configurado bateu; lendo todas as abas`);
  } else if (tituloRe) {
    // Sem gid, acha as abas pelo título ("Leads Forms", "Leads Forms 2", ...).
    // É o único caminho que não quebra sozinho quando alguém cria a próxima —
    // por isso a Service Account é preferível ao CSV por gid, que exige
    // lembrar de atualizar a variável.
    const casadas = abas.filter(a => tituloRe.test(String(a.titulo).trim()));
    if (casadas.length) abas = casadas;
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

/** Abas de FORMS da [CENTRAL DE EVENTOS], pela Sheets API. */
async function readViaServiceAccount() {
  return abasViaServiceAccount(process.env.LEADS_SHEET_ID, {
    gids:     gidsDeForms(),
    tituloRe: /^leads\s*forms/i,
    rotulo:   'Central de Eventos',
  });
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

/**
 * Gids das abas de FORMS, em lista.
 *
 * O export do formulário instantâneo não cabe numa aba só: quando uma enche,
 * nasce a seguinte ("Leads Forms", depois "Leads Forms 2"...). Enquanto isto
 * lia um gid só, o dia em que a segunda aba apareceu foi o dia em que os leads
 * da primeira sumiram do dashboard e da varredura do LeadQualificado — sem
 * erro, só com metade dos números. Toda aba precisa estar listada aqui.
 */
function gidsDeForms() {
  return String(process.env.LEADS_SHEET_GID_FORMS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}

function csvUrlsFromEnv() {
  const explicitas = (process.env.LEADS_SHEET_CSV_URLS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (explicitas.length) return explicitas;

  const id = normalizeSheetId(process.env.LEADS_SHEET_ID);
  if (!id) return [];

  return gidsDeForms()
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

/** Gids das abas de LP, em lista. Sem nenhum, o /export devolve a primeira. */
function gidsDeLP() {
  return String(process.env.LEADS_SHEET_LP_GID || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Lê a planilha de leads do Respondi (fonte dos leads de LP).
 *
 * Tenta a Service Account primeiro e cai para o CSV público se ela não
 * alcançar a planilha. A ordem importa por um motivo que não é técnico: a
 * planilha é do cliente (bruno@sevilhaperformance.com.br) e hoje só é legível
 * porque está aberta a quem tem o link — com nome, e-mail e telefone de mais
 * de mil leads dentro. Ler pela conta de serviço é o que permite fechar esse
 * acesso, e a leitura continua funcionando no dia em que ele fechar.
 *
 * A queda para o CSV existe porque o compartilhamento depende do cliente: até
 * ele acontecer, derrubar a leitura de LP tiraria o dashboard e o
 * LeadQualificado do ar por uma melhoria que ninguém pediu com pressa. Mas cai
 * avisando — silêncio aqui é como a aba faltando do FORMS passou quatro meses
 * despercebida.
 */
async function readLPTabs() {
  const id   = normalizeSheetId(process.env.LEADS_SHEET_LP_ID) || RESPONDI_SHEET_ID;
  const gids = gidsDeLP();

  if (getServiceAccount()) {
    try {
      const abas = await abasViaServiceAccount(id, { gids, rotulo: 'Respondi (LP)' });
      if (abas.length) return abas;
      console.warn('[sheets] Respondi (LP): a Service Account não achou aba nenhuma; tentando o CSV público');
    } catch (e) {
      console.warn(
        `[sheets] Respondi (LP): a Service Account não alcançou a planilha (${e.message}). `
        + 'Seguindo pelo CSV público — para fechar o acesso por link, o dono da planilha '
        + `precisa compartilhá-la com ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} como leitor.`
      );
    }
  }

  const base = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  const urls = gids.length ? gids.map(g => `${base}&gid=${g}`) : [base];

  const erros = [];
  const tentativas = [];
  const out = [];
  for (const url of urls) {
    const tab = await fetchCsvTab(url, erros, tentativas);
    if (tab) out.push(tab);
  }
  if (!out.length) {
    const err = new Error(`planilha do Respondi (LP): ${erros.join(' · ')}`);
    err.tentativas = tentativas;
    throw err;
  }
  if (erros.length) console.warn('[sheets] Respondi (LP): abas ignoradas —', erros.join(' · '));

  return out;
}

module.exports = { readAllTabs, readLPTabs, parseCsv, normalizarChave };
