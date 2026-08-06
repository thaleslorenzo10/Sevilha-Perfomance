'use strict';

/**
 * Sevilha Performance — Leads reais (planilhas)
 * GET /api/sheet-leads?since=YYYY-MM-DD&until=YYYY-MM-DD
 *
 * Lê as planilhas no servidor e devolve APENAS números agregados. Nome,
 * e-mail e telefone não saem daqui.
 *
 * Cada formato de campanha tem a sua fonte:
 *   • FORMS — formulário instantâneo do Meta, exportado para a planilha
 *     [CENTRAL DE EVENTOS] (colunas form_id / form_name / created_time).
 *   • LP — formulário da landing page, lido direto da planilha que a
 *     integração nativa do Respondi preenche (colunas "Qual seu nome?" /
 *     "Data" / utm_*). As cópias de LP que existem na Central são ignoradas:
 *     a aba "base" morreu em set/2025 e o log "Eventos Geral" perdeu ~130
 *     leads em panes de sincronização (13 dias parado na virada 2025→2026).
 *
 * Lead de LP só conta com e-mail ou telefone — o Respondi grava toda
 * submissão, inclusive abandonos de formulário (~8% sem nenhum contato).
 *
 * As linhas são identificadas pelo conteúdo/cabeçalho, não pelo nome da aba —
 * assim a função continua funcionando se alguém renomear ou adicionar abas.
 */

const { readAllTabs, readLPTabs } = require('../lib/sheets');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ── Normalização ────────────────────────────────────────────────────── */

function norm(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

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

function isTestLead(values) {
  const blob = norm(values.join(' '));
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

const RE_COLABORADORES = /^(de\s+\d+\s+a\s+\d+|mais de\s+\d+|acima de\s+\d+.*)$/i;
const RE_CARGO         = /^(dono\s*\/\s*s[oó]cio|cargo_gerencial.*|cargo_operacional.*|s[oó]cio.*)$/i;

function extractForms(rows) {
  const out = [];

  for (const row of rows) {
    if (!row || !row.length) continue;

    for (let off = 0; off < row.length; off++) {
      const id = String(row[off] || '').trim();
      if (!/^l:\d+$/.test(id)) continue;

      const rec = row.slice(off, off + META_EXPORT_WIDTH);
      if (isTestLead(rec)) continue;

      const data = toISODate(rec[1]);
      if (!data) continue;

      // As perguntas do formulário mudam de posição conforme o formulário,
      // então são localizadas pelo formato da resposta dentro do registro.
      const respostas = rec.slice(12).map(v => String(v || '').trim());
      const colaboradores = respostas.find(v => RE_COLABORADORES.test(v)) || '';
      const cargo         = respostas.find(v => RE_CARGO.test(v)) || '';

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
    if (isTestLead(row)) continue;

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
    });
  }
  return out;
}

/* ── Agregação ───────────────────────────────────────────────────────── */

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
          .replace(/\bà\b/g, 'a');
}

/**
 * Porte do escritório: 10 ou mais colaboradores × menos de 10.
 *
 * A resposta chega em três formatos diferentes conforme o formulário:
 *   faixa do Meta   → "De 0 a 4", "De 10 a 19", "Mais de 50"
 *   faixa da LP     → "0 à 9", "10 à 19", "Acima de 30 colaboradores"
 *   número digitado → "12", "35"
 *
 * O corte usa o LIMITE INFERIOR da faixa: "De 5 a 9" é menor que 10;
 * "De 10 a 19" é 10+. Faixas que cruzam o corte (ex.: "0 à 9" não cruza,
 * mas uma futura "5 a 14" cruzaria) e respostas em branco caem em
 * INDEFINIDO em vez de serem chutadas para um dos lados.
 */
const PORTE_MAIOR = 'MAIOR_10';
const PORTE_MENOR = 'MENOR_10';
const PORTE_INDEF = 'INDEFINIDO';

function classificarPorte(raw) {
  // O formulário do site grava em slug ("de_0_a_4"); o do Meta, por extenso.
  const s = norm(raw).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return PORTE_INDEF;

  // Ruído de colunas desalinhadas (ex.: "1,20249E+17").
  if (/e\+\d+/.test(s)) return PORTE_INDEF;

  // "mais de 50" / "acima de 30 colaboradores"
  const acima = s.match(/(?:mais de|acima de)\s+(\d+)/);
  if (acima) return parseInt(acima[1], 10) >= 10 ? PORTE_MAIOR : PORTE_MENOR;

  // "de 10 a 19" / "10 a 19" / "0 a 9"
  const faixa = s.match(/(\d+)\s*(?:a|à|-)\s*(\d+)/);
  if (faixa) {
    const min = parseInt(faixa[1], 10);
    const max = parseInt(faixa[2], 10);
    if (min >= 10) return PORTE_MAIOR;
    if (max < 10)  return PORTE_MENOR;
    return PORTE_INDEF; // faixa cruza o corte — não dá para atribuir
  }

  // Número digitado direto.
  const n = s.match(/^(\d{1,5})$/);
  if (n) return parseInt(n[1], 10) >= 10 ? PORTE_MAIOR : PORTE_MENOR;

  return PORTE_INDEF;
}

function countBy(items, keyFn) {
  const map = {};
  for (const i of items) {
    const k = keyFn(i);
    if (!k) continue;
    map[k] = (map[k] || 0) + 1;
  }
  return map;
}

function toSortedList(map, chave) {
  return Object.entries(map)
    .map(([k, v]) => ({ [chave]: k, leads: v }))
    .sort((a, b) => b.leads - a.leads);
}

function coverage(items) {
  if (!items.length) return { total: 0, primeiro: null, ultimo: null };
  const datas = items.map(i => i.data).sort();
  return { total: items.length, primeiro: datas[0], ultimo: datas[datas.length - 1] };
}

/**
 * Monta os agregados da planilha para um período. Exportado à parte do handler
 * para o resumo do WhatsApp usar exatamente os mesmos números do dashboard.
 */
async function montarLeads(since, until) {
  {
    // Cada fonte com o seu extrator, sem cruzar: a Central ainda guarda
    // cópias antigas de LP (a aba "base" e o log "Eventos Geral") que
    // voltariam a contar — em dobro — se ela passasse pelo extractLP.
    const [tabsCentral, tabsLP] = await Promise.all([readAllTabs(), readLPTabs()]);

    let todos = [];
    for (const { rows } of tabsCentral) {
      todos = todos.concat(extractForms(rows));
    }
    for (const { rows } of tabsLP) {
      for (const header of findLPHeaders(rows)) {
        todos = todos.concat(extractLP(rows, header));
      }
    }

    // Deduplica: re-submissões do mesmo contato na LP e, no export do Meta,
    // blocos colados repetidos na mesma aba.
    const vistos = new Set();
    todos = todos.filter(l => {
      const chave = `${l.fonte}|${l.id}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

    const noPeriodo = todos.filter(l => l.data >= since && l.data <= until);
    const forms = noPeriodo.filter(l => l.fonte === TAB_FORMS);
    const lp    = noPeriodo.filter(l => l.fonte === TAB_LP);

    // Série diária por formato.
    const porDiaMap = {};
    for (const l of noPeriodo) {
      if (!porDiaMap[l.data]) porDiaMap[l.data] = { data: l.data, FORMS: 0, LP: 0, total: 0 };
      porDiaMap[l.data][l.fonte]++;
      porDiaMap[l.data].total++;
    }

    // Porte do escritório — total e quebrado por formato de campanha, para
    // dar pra ver qual formato traz mais escritório grande e a que custo.
    const contarPorte = itens => ({
      MAIOR_10:   itens.filter(l => classificarPorte(l.colaboradores) === PORTE_MAIOR).length,
      MENOR_10:   itens.filter(l => classificarPorte(l.colaboradores) === PORTE_MENOR).length,
      INDEFINIDO: itens.filter(l => classificarPorte(l.colaboradores) === PORTE_INDEF).length,
    });

    return {
      periodo: { since, until },
      total: noPeriodo.length,
      por_formato: { FORMS: forms.length, LP: lp.length },
      porte: contarPorte(noPeriodo),
      porte_por_formato: { FORMS: contarPorte(forms), LP: contarPorte(lp) },
      por_formulario: toSortedList(countBy(noPeriodo, l => l.formulario), 'formulario'),
      por_campanha:   toSortedList(countBy(noPeriodo, l => l.campanha),   'campanha'),
      // Cobre os dois formatos: o export do Meta traz ad_name e a LP traz o
      // nome no utm_content. Antes só contava FORMS, o que subestimava
      // qualquer criativo que também rodasse para a landing page.
      por_anuncio: Object.entries(
        noPeriodo.reduce((acc, l) => {
          const nome = (l.anuncio || '').trim();
          if (!nome) return acc;
          acc[nome] = acc[nome] || { anuncio: nome, leads: 0, FORMS: 0, LP: 0 };
          acc[nome].leads++;
          acc[nome][l.fonte]++;
          return acc;
        }, {})
      ).map(([, v]) => v).sort((a, b) => b.leads - a.leads).slice(0, 25),
      por_dia: Object.values(porDiaMap).sort((a, b) => a.data.localeCompare(b.data)),
      qualificacao: {
        cargo:         countBy(noPeriodo, l => labelCargo(l.cargo)),
        colaboradores: countBy(noPeriodo, l => labelColaboradores(l.colaboradores)),
        plataforma:    countBy(noPeriodo, l => l.plataforma),
      },
      // Cobertura sobre a planilha inteira, para o dashboard avisar quando o
      // sync parou — sem isso um período vazio parece "zero lead" e não "sem dado".
      cobertura: {
        FORMS: coverage(todos.filter(l => l.fonte === TAB_FORMS)),
        LP:    coverage(todos.filter(l => l.fonte === TAB_LP)),
      },
      gerado_em: new Date().toISOString(),
    };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const params = new URL(req.url, 'http://localhost').searchParams;
  const since = params.get('since');
  const until = params.get('until');

  if (!DATE_RE.test(since || '') || !DATE_RE.test(until || '')) {
    return res.status(400).json({ error: 'Informe since e until no formato YYYY-MM-DD' });
  }

  try {
    return res.status(200).json(await montarLeads(since, until));
  } catch (err) {
    console.error('[api/sheet-leads]', err.message);
    return res.status(502).json({
      error: err.message,
      // Abra estas URLs no navegador: se baixarem o CSV, o problema é só de
      // acesso sem login; se derem 404, o id ou o gid está errado.
      ...(err.tentativas ? { urls_tentadas: err.tentativas } : {}),
    });
  }
};

module.exports.montarLeads = montarLeads;
