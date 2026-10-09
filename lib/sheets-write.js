'use strict';

/**
 * Gravação dos leads da landing page em uma aba do Google Sheets.
 *
 * A leitura (lib/sheets.js) existe porque as planilhas são preenchidas por
 * terceiros — o Respondi e o export do Meta. A página /mentoria tem formulário
 * próprio, então nada preenche planilha nenhuma por ela: quem grava é isto.
 *
 * A aba é criada na primeira gravação, com cabeçalho. O append usa
 * `valueInputOption=RAW` de propósito: telefone com DDD e datas ISO não podem
 * ser reinterpretados pelo Sheets como número ou data local.
 *
 * Variáveis de ambiente:
 *   LEADS_SHEET_WRITE_ID   = id (ou URL) da planilha onde gravar.
 *                            Sem ela, cai para LEADS_SHEET_ID (a Central).
 *   LEADS_SHEET_WRITE_TAB  = nome da aba. Padrão: "Leads Mentoria".
 *   LEADS_SHEET_WRITE_PAGES= lista de páginas que gravam, separada por vírgula.
 *                            Padrão: "/mentoria".
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY — a conta de serviço
 *                            precisa de permissão de EDITOR na planilha; a de
 *                            leitor não basta e a API devolve 403.
 */

const { getAccessToken, getServiceAccount, SHEETS_API, SCOPE_RW } = require('./sheets');

const TAB_PADRAO   = 'Leads Mentoria';
const PAGES_PADRAO = '/mentoria,/mentoria-2';

/** Aceita id cru ou URL completa da planilha, como o resto do projeto já faz. */
function extrairId(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  const m = v.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : v;
}

const COLUNAS = [
  'data',        'pagina',      'nome',        'email',      'telefone',
  'escritorio',  'cargo',       'colaboradores',
  'utm_source',  'utm_medium',  'utm_campaign', 'utm_term',  'utm_content',
  'fbclid',      'gclid',       'event_id',     'page_url',
];

function linhaDe(lead) {
  return [
    new Date().toISOString(),
    lead.pagina        || '',
    lead.nome          || '',
    lead.email         || '',
    lead.telefone      || '',
    lead.escritorio    || '',
    lead.cargo         || '',
    lead.colaboradores || '',
    lead.utm_source    || '',
    lead.utm_medium    || '',
    lead.utm_campaign  || '',
    lead.utm_term      || '',
    lead.utm_content   || '',
    lead.fbclid        || '',
    lead.gclid         || '',
    lead.event_id      || '',
    lead.page_url      || '',
  ];
}

function paginasQueGravam() {
  return (process.env.LEADS_SHEET_WRITE_PAGES || PAGES_PADRAO)
    .split(',').map(s => s.trim()).filter(Boolean);
}

/** A aba só é criada uma vez; a chamada repetida devolve erro que é ignorado. */
async function garantirAba(sheetId, aba, auth) {
  const meta = await fetch(`${SHEETS_API}/${sheetId}?fields=sheets.properties.title`, { headers: auth, signal: AbortSignal.timeout(8000) });
  if (!meta.ok) throw new Error(`não foi possível ler a planilha: ${meta.status} ${await meta.text()}`);

  const json     = await meta.json();
  const existe   = (json.sheets || []).some(s => s.properties?.title === aba);
  if (existe) return;

  const criar = await fetch(`${SHEETS_API}/${sheetId}:batchUpdate`, {
    method:  'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ requests: [{ addSheet: { properties: { title: aba } } }] }),
    signal: AbortSignal.timeout(8000),
  });
  if (!criar.ok) throw new Error(`não foi possível criar a aba "${aba}": ${criar.status} ${await criar.text()}`);

  await fetch(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(aba)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method:  'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ values: [COLUNAS] }),
      signal: AbortSignal.timeout(8000),
    }
  );
}

/**
 * Grava o lead na planilha. Nunca lança: uma falha de planilha não pode
 * derrubar o cadastro, que já foi salvo no Supabase antes daqui.
 * Devolve { ok, motivo } para o log de quem chamou.
 */
async function gravarLead(lead, { seguro = false } = {}) {
  const paginas = paginasQueGravam();
  if (paginas.length && !paginas.includes(lead.pagina)) {
    return { ok: false, status: 'nao_aplicavel', motivo: 'pagina fora da lista de gravação' };
  }

  if (!getServiceAccount()) {
    console.warn('[Sheets] conta de serviço não configurada — lead não gravado na planilha');
    return { ok: false, status: 'nao_configurado', motivo: 'service account ausente' };
  }

  const sheetId = extrairId(process.env.LEADS_SHEET_WRITE_ID || process.env.LEADS_SHEET_ID);
  if (!sheetId) {
    console.warn('[Sheets] LEADS_SHEET_WRITE_ID não definido — lead não gravado na planilha');
    return { ok: false, status: 'nao_configurado', motivo: 'planilha não configurada' };
  }

  const aba = process.env.LEADS_SHEET_WRITE_TAB || TAB_PADRAO;

  try {
    const token = await getAccessToken(SCOPE_RW, { signal: AbortSignal.timeout(8000) });
    const auth  = { Authorization: `Bearer ${token}` };

    await garantirAba(sheetId, aba, auth);

    const res = await fetch(
      `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(aba)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method:  'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ values: [linhaDe(lead)] }),
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      // 403 aqui é quase sempre a conta de serviço sem permissão de edição —
      // o erro cru não diz isso e o próximo a ler o log vai procurar no lugar errado.
      const pista = res.status === 403
        ? ' — a conta de serviço precisa de permissão de EDITOR na planilha'
        : '';
      if (!seguro) console.error('[Sheets Error]', res.status, txt + pista);
      return { ok: false, status: res.status >= 500 ? 'incerto' : 'falhou', motivo: `HTTP ${res.status}` };
    }

    if (seguro) {
      const json = await res.json();
      const range = json.updates?.updatedRange;
      if (json.error || json.updates?.updatedRows !== 1 || typeof range !== 'string') return { ok: false, status: 'incerto' };
      // Apenas coordenadas, nunca titulo de aba/payload devolvido pelo destino.
      return { ok: true, range: range.split('!').pop().replace(/[^A-Z0-9:]/g, '') };
    }
    console.log(`[Sheets OK] lead gravado na aba "${aba}" — pagina=${lead.pagina} email=${lead.email}`);
    return { ok: true };
  } catch (e) {
    if (!seguro) console.error('[Sheets Exception]', e.message);
    return { ok: false, status: 'incerto', motivo: seguro ? 'sheets_nao_confirmou' : e.message };
  }
}

module.exports = { gravarLead, COLUNAS, linhaDe, paginasQueGravam, extrairId };
