'use strict';

/**
 * Extração de leads das planilhas — export do Meta (FORMS) e formulário do
 * Respondi (LP). Só leitura; a agregação fica em quem chama.
 */

const { norm } = require('./texto');

/**
 * Aceita os três formatos que aparecem na planilha:
 *   ISO  2026-04-06T08:13:53-05:00   (export do Meta)
 *   BR   06/04/2026                  (dd/mm/aaaa)
 *   US   9/7/2025                     (m/d/aaaa — export do Google em locale en-US)
 *
 * BR e US são ambíguos entre si (03/04 pode ser 3/abr ou 4/mar). O desempate é
 * o zero à esquerda: o Sheets exporta US sem zero ("9/7/2025") e o formato BR
 * digitado vem com dois dígitos ("09/07/2026"). Quando um dos componentes é
 * maior que 12, ele decide sozinho.
 */
function toISODate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;

  let [, a, b, ano] = m;
  const na = parseInt(a, 10), nb = parseInt(b, 10);

  let dia, mes;
  if (na > 12)      { dia = na; mes = nb; }            // só pode ser dd/mm
  else if (nb > 12) { mes = na; dia = nb; }            // só pode ser mm/dd
  else if (a.length === 2 && b.length === 2) { dia = na; mes = nb; }  // 09/07 → BR
  else              { mes = na; dia = nb; }            // 9/7   → US (Sheets)

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
}

// Regra única de lead de teste — usada tanto pelo dashboard quanto pela
// varredura que dispara LeadQualificado, para as duas nunca discordarem.
function ehLeadDeTeste(celulas) {
  const blob = norm(celulas.map(v => String(v ?? '')).join(' '));
  return blob.includes('<test lead') || blob.includes('test@meta.com');
}

/* ── Identificação das abas ──────────────────────────────────────────── */

const TAB_FORMS = 'FORMS';
const TAB_LP    = 'LP';

/**
 * Cabeçalho do formulário do Respondi ("Qual seu nome? | Qual seu e-mail? |
 * ... | Data"). Ao contrário do export do Meta, essas linhas não são
 * auto-identificáveis e dependem mesmo do cabeçalho. O formato "Eventos
 * Geral" (Data | Funil | UTM Campaign), que já foi fonte de LP, saiu junto
 * com a Central — era a cópia que perdia leads.
 */
function findLPHeaders(rows) {
  const found = [];
  rows.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      if (norm(cell).startsWith('qual seu nome')) {
        found.push({ tipo: TAB_LP, rowIdx, offset: colIdx });
      }
    });
  });
  return found;
}

/**
 * Localiza uma coluna pelo cabeçalho. Percorre `names` na ordem de prioridade
 * e só depois aceita correspondência por prefixo — varrer as colunas primeiro
 * faria "DATA STATUS" ser escolhida quando o alvo é "DATA ENTRADA".
 */
function columnIndex(headerRow, offset, names) {
  for (const n of names) {
    for (let i = offset; i < headerRow.length; i++) {
      if (norm(headerRow[i]) === n) return i;
    }
  }
  for (const n of names) {
    for (let i = offset; i < headerRow.length; i++) {
      if (norm(headerRow[i]).startsWith(n)) return i;
    }
  }
  return -1;
}

/* ── Extração ────────────────────────────────────────────────────────── */

/**
 * Extrai os leads de formulário instantâneo do Meta.
 *
 * O export do Meta tem ordem de colunas fixa e o `id` é auto-identificável
 * ("l:123..."), então localizamos cada registro pelo próprio id em vez de
 * depender do cabeçalho. Isso evita perder um bloco inteiro em silêncio
 * quando alguém cola duas tabelas lado a lado ou apaga a linha de título.
 *
 *   0 id · 1 created_time · 2 ad_id · 3 ad_name · 4 adset_id · 5 adset_name
 *   6 campaign_id · 7 campaign_name · 8 form_id · 9 form_name
 *   10 is_organic · 11 platform · 12+ perguntas do formulário
 */
const META_EXPORT_WIDTH = 23;

// A forma mais ampla das duas regexes que existiam ("10 a 19" digitado entra).
const RE_COLABORADORES = /^(de\s+\d+\s+a\s+\d+|\d+\s*(a|à)\s*\d+|mais de\s+\d+|acima de\s+\d+.*)$/i;
const RE_CARGO         = /^(dono\s*\/\s*s[oó]cio|cargo_gerencial.*|cargo_operacional.*|s[oó]cio.*)$/i;
const RE_EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TELEFONE = /^\+?[\d\s().-]{8,}$/;

function extractForms(rows) {
  const out = [];

  for (const row of rows) {
    if (!row || !row.length) continue;

    for (let off = 0; off < row.length; off++) {
      const id = String(row[off] || '').trim();
      if (!/^l:\d+$/.test(id)) continue;

      const rec = row.slice(off, off + META_EXPORT_WIDTH);
      if (ehLeadDeTeste(rec)) continue;

      const data = toISODate(rec[1]);
      if (!data) continue;

      // As perguntas do formulário mudam de posição conforme o formulário,
      // então são localizadas pelo formato da resposta dentro do registro.
      const respostas = rec.slice(12).map(v => String(v || '').trim());
      const colaboradores = respostas.find(v => RE_COLABORADORES.test(v)) || '';
      const cargo         = respostas.find(v => RE_CARGO.test(v)) || '';
      const email    = respostas.find(v => RE_EMAIL.test(v)) || '';
      const telefone = respostas.find(v => RE_TELEFONE.test(v)) || '';

      out.push({
        fonte:      TAB_FORMS,
        id,
        data,
        formulario: String(rec[9]  || '').trim() || 'Sem formulário',
        campanha:   String(rec[7]  || '').trim() || 'Sem campanha',
        adset:      String(rec[5]  || '').trim(),
        anuncio:    String(rec[3]  || '').trim(),
        plataforma: String(rec[11] || '').trim(),
        colaboradores,
        cargo,
        email,
        telefone,
      });

      off += META_EXPORT_WIDTH - 1; // pula para depois deste registro
    }
  }
  return out;
}

/**
 * Formulário do Respondi — o formulário da landing page (campanhas [SE] [LEAD]).
 *
 * Só conta linha com e-mail ou telefone: o Respondi registra toda submissão,
 * inclusive quem abandonou o formulário no meio, e sem contato não há lead
 * para o time chamar. O contato também é a chave de deduplicação — quem
 * reenvia o formulário (acontece em ~10% dos leads) conta uma vez só.
 */
function extractLP(rows, header) {
  const head = rows[header.rowIdx];
  const off  = header.offset;

  const idx = {
    data:     columnIndex(head, off, ['data entrada', 'data']),
    email:    columnIndex(head, off, ['qual seu e-mail', 'qual seu email']),
    telefone: columnIndex(head, off, ['telefone', 'qual seu whatsapp']),
    campanha: columnIndex(head, off, ['utm campaign', 'utm_campaign']),
    origem:   columnIndex(head, off, ['utm source', 'utm_source']),
    colab:    columnIndex(head, off, ['numero de colaboradores', 'quantos colaboradores']),
    cargo:    columnIndex(head, off, ['cargo que ocupa', 'qual a sua posicao', 'qualificacao']),
    // A LP grava o nome do anúncio no utm_content ({{ad.name}}), o que
    // permite ranquear criativo por lead real também nesse formato.
    anuncio:  columnIndex(head, off, ['utm content', 'utm_content']),
  };

  const out = [];
  for (let r = header.rowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    if (ehLeadDeTeste(row)) continue;

    const data = toISODate(row[idx.data]);
    if (!data) continue;

    const email    = String(row[idx.email]    ?? '').trim();
    const telefone = String(row[idx.telefone] ?? '').trim();
    if (!email && !telefone) continue;

    out.push({
      fonte:      TAB_LP,
      id:         email || telefone,
      data,
      formulario: 'Formulário da Landing Page',
      campanha:   String(row[idx.campanha] ?? '').trim() || '[SE] [LEAD]',
      adset:      '',
      anuncio:    String(row[idx.anuncio] ?? '').trim(),
      plataforma: String(row[idx.origem] ?? '').trim(),
      colaboradores: String(row[idx.colab] ?? '').trim(),
      cargo:      String(row[idx.cargo] ?? '').trim(),
      email,
      telefone,
    });
  }
  return out;
}

/**
 * Os dois formulários gravam a mesma resposta com grafias diferentes
 * ("dono/sócio" no Meta, "Dono/Sócio" na LP). Sem unificar, o mesmo perfil
 * aparece como duas linhas no dashboard.
 */
function labelCargo(v) {
  const n = norm(v);
  if (!n) return '';
  if (n.includes('dono') || n.includes('socio')) return 'Dono / Sócio';
  if (n.includes('gerencial')) return 'Cargo gerencial';
  if (n.includes('operacional')) return 'Cargo operacional';
  return String(v).trim();
}

function labelColaboradores(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  // "De 0 a 4" / "0 à 9" / "Mais de 50" / "Acima de 30 colaboradores"
  return s.replace(/\s+/g, ' ')
          .replace(/^de\s+/i, 'De ')
          .replace(/ à /g, ' a ');
}

module.exports = {
  TAB_FORMS, TAB_LP, toISODate, ehLeadDeTeste, findLPHeaders, columnIndex,
  extractForms, extractLP, labelCargo, labelColaboradores,
};
