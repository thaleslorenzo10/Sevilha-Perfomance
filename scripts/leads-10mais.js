'use strict';

/**
 * Sevilha Performance — anúncios e públicos por lead de 10+ colaboradores.
 *
 *   node scripts/leads-10mais.js            # tabelas no terminal
 *   node scripts/leads-10mais.js --csv=out  # grava out-criativos.csv etc.
 *
 * Responde três perguntas que o Ads Manager sozinho não responde, porque o
 * porte do escritório só existe na resposta do formulário:
 *   • quais criativos trazem mais lead de 10+ colaboradores;
 *   • quanto custa cada um desses leads;
 *   • quais públicos qualificam melhor.
 *
 * ── Como o vínculo é feito ──────────────────────────────────────────────
 *
 * FORMS (formulário instantâneo): o export do Meta já traz ad_id, adset_id e
 *   campaign_id em cada linha. O join é exato.
 *
 * LP (landing page + Respondi): não existe ad_id. O vínculo vem das UTMs que
 *   a campanha carrega — utm_term = ID do ad set, utm_content = nome do
 *   anúncio. O par (adset_id, nome) identifica o anúncio; quando o
 *   utm_content chega truncado, cai num casamento por prefixo, e só vale se
 *   houver um único candidato dentro daquele ad set.
 *
 * ── Por que o gasto é recortado por janela ──────────────────────────────
 *
 * Cada planilha começa numa data diferente, e as campanhas são mais velhas
 * que elas. Dividir o gasto de vida inteira pelos leads de um período menor
 * inventa custo: o AD11 sai a R$ 1.038 por lead 10+ na conta cheia e a R$ 118
 * quando o gasto é recortado na janela em que a planilha de FORMS existe.
 * Por isso cada anúncio é medido na janela da planilha que registra os leads
 * dele — e as janelas saem dos próprios dados, não de constante no código.
 *
 * ── Contato junto do lead ───────────────────────────────────────────────
 *
 * Cada lead sai daqui com `email` e `telefone`. Este relatório não usa nem
 * imprime nenhum dos dois: eles existem para scripts/leads-crm.js, que precisa
 * do contato para achar o mesmo lead dentro do RD Station. Quem consumir estas
 * funções herda dado pessoal — não jogue a saída crua em log nem em CSV.
 *
 * ── O que os números NÃO dizem ──────────────────────────────────────────
 *
 * O CPL 10+ aqui é um TETO para os criativos de FORMS: o export da Central
 * captura só parte dos leads que o Meta registra (53% no acumulado, e
 * caindo). A coluna `taxa_10mais` é a métrica robusta — não depende do
 * volume capturado, só de a amostra ser representativa. O relatório imprime
 * a cobertura mês a mês justamente para essa leitura ficar explícita.
 *
 * Requer META_ACCESS_TOKEN (ads_read) e acesso de leitura às duas planilhas.
 */

const { readAllTabs, readLPTabs } = require('../lib/sheets');
const { graphGetAll, getConfig, extractLeads, classifyCampaign } = require('../lib/meta');
const { classificarPorte, PORTE_MAIOR, PORTE_MENOR, PORTE_INDEF } = require('../lib/porte');
const { norm } = require('../lib/texto');

/* ── leitura das planilhas ───────────────────────────────────────────── */

/** Aceita ISO, dd/mm/aaaa e m/d/aaaa (export do Sheets em locale en-US). */
function toISODate(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const [, a, b, ano] = m;
  const na = parseInt(a, 10), nb = parseInt(b, 10);

  let dia, mes;
  if (na > 12)                               { dia = na; mes = nb; }
  else if (nb > 12)                          { mes = na; dia = nb; }
  else if (a.length === 2 && b.length === 2) { dia = na; mes = nb; }  // BR
  else                                       { mes = na; dia = nb; }  // US

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function isTestLead(row) {
  const blob = norm(row.join(' '));
  return blob.includes('<test lead') || blob.includes('test@meta.com');
}

function columnIndex(head, names) {
  for (const n of names) {
    for (let i = 0; i < head.length; i++) if (norm(head[i]) === n) return i;
  }
  for (const n of names) {
    for (let i = 0; i < head.length; i++) if (norm(head[i]).startsWith(n)) return i;
  }
  return -1;
}

/**
 * Leads do formulário instantâneo. As linhas são localizadas pelo próprio id
 * ("l:123..."), que é auto-identificável — assim uma aba renomeada ou uma
 * linha de título apagada não derruba o bloco inteiro em silêncio.
 *
 *   0 id · 1 created_time · 2 ad_id · 3 ad_name · 4 adset_id · 5 adset_name
 *   6 campaign_id · 7 campaign_name · 8 form_id · 9 form_name
 *   10 is_organic · 11 platform · 12+ perguntas · email · phone_number
 *
 * As posições de e-mail e telefone variam com as perguntas do formulário, por
 * isso saem do cabeçalho e não de índice fixo.
 */
function extrairForms(tabs) {
  const vistos = new Set();
  const out = [];

  for (const { rows } of tabs) {
    const head = rows.find(r => r && norm(r[0]) === 'id' && norm(r[1] || '').startsWith('created'));
    const iColab = head ? columnIndex(head, ['quantos colaboradores voce tem?', 'quantos colaboradores']) : -1;
    const iEmail = head ? columnIndex(head, ['email']) : -1;
    const iFone  = head ? columnIndex(head, ['phone_number', 'phone']) : -1;

    for (const row of rows) {
      if (!row || !/^l:\d+$/.test(String(row[0] ?? '').trim())) continue;
      if (isTestLead(row)) continue;

      const id = String(row[0]).trim();
      if (vistos.has(id)) continue;   // as duas abas de FORMS são sequenciais
      vistos.add(id);

      const g = i => (i >= 0 && i < row.length ? String(row[i] ?? '').trim() : '');
      const colaboradores = g(iColab);

      out.push({
        fonte: 'FORMS',
        data: toISODate(g(1)),
        adId:     g(2).replace(/^ag:/, ''),
        adNome:   g(3),
        adsetId:  g(4).replace(/^as:/, ''),
        campanha: g(7),
        colaboradores,
        porte: classificarPorte(colaboradores),
        email: g(iEmail),
        telefone: g(iFone),
      });
    }
  }
  return out;
}

/**
 * Leads da landing page (planilha do Respondi).
 *
 * Só conta com e-mail ou telefone: o Respondi grava toda submissão, inclusive
 * abandono de formulário — mesma regra de api/sheet-leads.js.
 */
function extrairLP(tabs) {
  const vistos = new Set();
  const out = [];

  for (const { rows } of tabs) {
    const head = rows.find(r => r && norm(r[0] || '').startsWith('qual seu nome'));
    if (!head) continue;

    const ix = {
      email:   columnIndex(head, ['qual seu e-mail?', 'qual seu e-mail']),
      fone:    columnIndex(head, ['qual seu whatsapp?', 'qual seu whatsapp']),
      colab:   columnIndex(head, ['quantos colaboradores voce tem?', 'quantos colaboradores']),
      data:    columnIndex(head, ['data']),
      id:      columnIndex(head, ['id']),
      campanha:columnIndex(head, ['utm_campaign', 'utm campaign']),
      adsetId: columnIndex(head, ['utm_term', 'utm term']),       // = ID do ad set
      adNome:  columnIndex(head, ['utm_content', 'utm content']), // = nome do anúncio
    };

    for (const row of rows) {
      if (!row || row === head) continue;
      const g = k => (ix[k] >= 0 && ix[k] < row.length ? String(row[ix[k]] ?? '').trim() : '');

      const data = toISODate(g('data'));
      if (!data) continue;
      if (!g('email') && !g('fone')) continue;

      const chave = g('id') || `${norm(g('email'))}|${data}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      const colaboradores = g('colab');
      out.push({
        fonte: 'LP',
        data,
        adId: '',
        adNome: g('adNome'),
        adsetId: g('adsetId'),
        campanha: g('campanha'),
        colaboradores,
        porte: classificarPorte(colaboradores),
        email: g('email'),
        telefone: g('fone'),
      });
    }
  }
  return out;
}

/* ── Meta ────────────────────────────────────────────────────────────── */

/** Insights por anúncio numa janela. */
async function insightsPorAnuncio(since, until) {
  const { account } = getConfig();
  const rows = await graphGetAll(`act_${account}/insights`, {
    fields: 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,actions',
    level: 'ad',
    time_range: JSON.stringify({ since, until }),
    limit: '300',
  }, { maxPages: 40 });

  const mapa = new Map();
  for (const r of rows) {
    mapa.set(r.ad_id, {
      adId: r.ad_id, adNome: r.ad_name || '',
      adsetId: r.adset_id || '', adsetNome: r.adset_name || '',
      campanhaId: r.campaign_id || '', campanha: r.campaign_name || '',
      gasto: parseFloat(r.spend) || 0,
      impressoes: parseInt(r.impressions, 10) || 0,
      leadsMeta: extractLeads(r),
    });
  }
  return mapa;
}

/**
 * Período coberto por uma das planilhas, tirado dos próprios leads.
 *
 * É o que mantém o gasto comparável: o Meta responde por janela, e pedir a
 * vida inteira da campanha para dividir pelos leads de um recorte menor
 * inventa custo (ver o comentário do AD11 no topo).
 */
function janelaDaFonte(leads, fonte) {
  const datas = leads.filter(l => l.fonte === fonte && l.data).map(l => l.data).sort();
  return { since: datas[0], until: datas[datas.length - 1] };
}

/* ── cruzamento ──────────────────────────────────────────────────────── */

/**
 * Junta as duas janelas num universo só, tomando de cada anúncio o gasto da
 * janela correspondente à mecânica dele — FORMS ou LP.
 */
function montarUniverso(mapaForms, mapaLP) {
  const ads = new Map();
  for (const id of new Set([...mapaForms.keys(), ...mapaLP.keys()])) {
    const base = mapaForms.get(id) || mapaLP.get(id);
    const { grupo, formato } = classifyCampaign(base.campanha);
    const fonte = formato === 'FORMS' ? mapaForms.get(id) : mapaLP.get(id);
    ads.set(id, { ...base, ...(fonte || {}), grupo, mecanica: formato });
  }
  return ads;
}

/** Resolve o anúncio de um lead de LP pelo par (adset_id, nome do anúncio). */
function criarResolvedorLP(ads) {
  const porPar = new Map();
  const porAdset = new Map();
  for (const ad of ads.values()) {
    porPar.set(`${ad.adsetId}|${norm(ad.adNome)}`, ad.adId);
    if (!porAdset.has(ad.adsetId)) porAdset.set(ad.adsetId, []);
    porAdset.get(ad.adsetId).push(ad);
  }

  return lead => {
    const { adsetId } = lead;
    const nome = norm(lead.adNome);
    if (!adsetId) return null;

    const exato = porPar.get(`${adsetId}|${nome}`);
    if (exato) return exato;

    if (nome) {
      // utm_content chega truncado às vezes; o prefixo só vale se não houver
      // ambiguidade dentro do ad set.
      const cand = (porAdset.get(adsetId) || []).filter(a =>
        norm(a.adNome).startsWith(nome.slice(0, 28)) || nome.startsWith(norm(a.adNome).slice(0, 28)));
      if (cand.length === 1) return cand[0].adId;
    }
    return null;
  };
}

/**
 * Distribui os leads entre os anúncios.
 *
 * Além do agregado, carimba `adIdResolvido` em cada lead (null quando órfão).
 * É de propósito: quem precisa cruzar o lead com outra base depois — o CRM em
 * scripts/leads-crm.js — precisa saber de qual anúncio ele veio, e refazer a
 * resolução do lado de fora significaria manter duas cópias da mesma regra.
 */
function atribuir(leads, ads) {
  const resolveLP = criarResolvedorLP(ads);
  const porAd = new Map();
  const orfaos = { FORMS: { total: 0, q: 0 }, LP: { total: 0, q: 0 } };

  for (const l of leads) {
    const q = l.porte === PORTE_MAIOR;
    const adId = l.fonte === 'FORMS'
      ? (ads.has(l.adId) ? l.adId : null)
      : resolveLP(l);
    l.adIdResolvido = adId;

    if (!adId) { orfaos[l.fonte].total++; if (q) orfaos[l.fonte].q++; continue; }

    if (!porAd.has(adId)) porAd.set(adId, { total: 0, q: 0, menor: 0, indef: 0 });
    const s = porAd.get(adId);
    s.total++;
    if (q) s.q++;
    else if (l.porte === PORTE_MENOR) s.menor++;
    else s.indef++;
  }
  return { porAd, orfaos };
}

/** Agrupa por uma chave qualquer (criativo, público, campanha). */
function agrupar(ads, porAd, chave, filtro = () => true) {
  const out = new Map();
  for (const ad of ads.values()) {
    if (!filtro(ad)) continue;
    const k = chave(ad);
    if (k == null) continue;
    if (!out.has(k)) out.set(k, { chave: k, gasto: 0, leadsMeta: 0, planilha: 0, q: 0, anuncios: 0 });
    const o = out.get(k);
    o.gasto += ad.gasto;
    o.leadsMeta += ad.leadsMeta;
    o.anuncios++;
    const s = porAd.get(ad.adId);
    if (s) { o.planilha += s.total; o.q += s.q; }
  }
  for (const o of out.values()) {
    o.taxa = o.planilha ? o.q / o.planilha : 0;
    o.cpl10 = o.q ? o.gasto / o.q : null;
  }
  return [...out.values()];
}

/* ── saída ───────────────────────────────────────────────────────────── */

const brl = v => 'R$ ' + (v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const pct = v => (100 * v).toFixed(1).replace('.', ',') + '%';

function tabela(titulo, linhas, larguraChave = 46) {
  console.log('\n' + '─'.repeat(100));
  console.log('  ' + titulo);
  console.log('─'.repeat(100));
  console.log(
    'criativo/público'.padEnd(larguraChave) +
    'gasto'.padStart(12) + 'Meta'.padStart(8) + 'planilha'.padStart(10) +
    '10+'.padStart(6) + 'taxa'.padStart(8) + 'CPL 10+'.padStart(11));
  for (const o of linhas) {
    console.log(
      String(o.chave).slice(0, larguraChave - 2).padEnd(larguraChave) +
      brl(o.gasto).padStart(12) +
      String(o.leadsMeta).padStart(8) +
      String(o.planilha).padStart(10) +
      String(o.q).padStart(6) +
      pct(o.taxa).padStart(8) +
      (o.cpl10 ? brl(o.cpl10) : '—').padStart(11));
  }
}

function paraCsv(linhas) {
  const cab = ['chave', 'gasto', 'leads_meta', 'leads_planilha', 'leads_10mais', 'taxa_10mais', 'cpl_10mais'];
  const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  return [cab.join(',')].concat(linhas.map(o => [
    o.chave, o.gasto.toFixed(2), o.leadsMeta, o.planilha, o.q,
    (100 * o.taxa).toFixed(1), o.cpl10 ? o.cpl10.toFixed(2) : '',
  ].map(esc).join(','))).join('\n');
}

/* ── main ────────────────────────────────────────────────────────────── */

async function main() {
  const prefixoCsv = (process.argv.find(a => a.startsWith('--csv=')) || '').slice(6);

  console.log('Lendo as planilhas…');
  const [tabsForms, tabsLP] = await Promise.all([readAllTabs(), readLPTabs()]);
  const leads = extrairForms(tabsForms).concat(extrairLP(tabsLP));

  // As janelas saem dos próprios dados: cada planilha cobre um período, e o
  // gasto precisa ser medido no mesmo intervalo dos leads que ela registra.
  const jForms = janelaDaFonte(leads, 'FORMS');
  const jLP = janelaDaFonte(leads, 'LP');
  console.log(`  FORMS ${jForms.since} → ${jForms.until}  ·  LP ${jLP.since} → ${jLP.until}`);

  console.log('Buscando insights no Meta…');
  const [mapaForms, mapaLP] = await Promise.all([
    insightsPorAnuncio(jForms.since, jForms.until),
    insightsPorAnuncio(jLP.since, jLP.until),
  ]);

  const ads = montarUniverso(mapaForms, mapaLP);
  const { porAd, orfaos } = atribuir(leads, ads);

  const soSE = ad => ad.grupo === 'SE';
  const totalSE = agrupar(ads, porAd, () => 'total', soSE)[0] || { gasto: 0, q: 0, planilha: 0 };

  console.log('\n' + '='.repeat(100));
  console.log('  LEADS DE 10+ COLABORADORES — funil [SE] Sessão Estratégica');
  console.log('='.repeat(100));
  console.log(`  Leads lidos ............... ${leads.length}`);
  console.log(`  Investimento .............. ${brl(totalSE.gasto)}`);
  console.log(`  Leads na planilha ......... ${totalSE.planilha}`);
  console.log(`  Leads 10+ ................. ${totalSE.q} (${pct(totalSE.taxa)})`);
  console.log(`  CPL 10+ médio ............. ${totalSE.cpl10 ? brl(totalSE.cpl10) : '—'}`);
  console.log(`  Sem UTM aproveitável ...... LP ${orfaos.LP.total} leads (${orfaos.LP.q} são 10+)`);

  const porCriativo = agrupar(ads, porAd, a => a.adNome || '(sem nome)', soSE)
    .sort((x, y) => y.q - x.q);
  const porPublico = agrupar(ads, porAd, a => a.adsetNome || '(sem nome)', soSE)
    .sort((x, y) => y.q - x.q);
  const porCampanha = agrupar(ads, porAd, a => a.campanha, soSE)
    .sort((x, y) => y.gasto - x.gasto);

  tabela('CRIATIVOS — por volume de leads 10+', porCriativo.slice(0, 18));
  tabela('CRIATIVOS — melhor CPL 10+ (mín. 15 leads 10+)',
    porCriativo.filter(o => o.q >= 15).sort((x, y) => x.cpl10 - y.cpl10));
  tabela('PÚBLICOS (ad set)', porPublico.slice(0, 14));
  tabela('CAMPANHAS', porCampanha.slice(0, 16));

  // Cobertura mês a mês: quanto do que o Meta contou chegou na planilha.
  // É o aviso de que os CPL de FORMS são teto, não medição.
  console.log('\n' + '─'.repeat(100));
  console.log('  COBERTURA DA PLANILHA DE FORMS — leads na planilha ÷ leads contados pelo Meta');
  console.log('─'.repeat(100));
  const porMes = new Map();
  for (const l of leads) {
    if (l.fonte !== 'FORMS' || !l.data) continue;
    const m = l.data.slice(0, 7);
    porMes.set(m, (porMes.get(m) || 0) + 1);
  }
  const metaForms = [...ads.values()]
    .filter(a => a.grupo === 'SE' && a.mecanica === 'FORMS')
    .reduce((s, a) => s + a.leadsMeta, 0);
  const planForms = [...porMes.values()].reduce((s, v) => s + v, 0);
  for (const [m, v] of [...porMes.entries()].sort()) {
    console.log(`  ${m}   ${String(v).padStart(5)} leads na planilha`);
  }
  console.log(`  acumulado: ${planForms} na planilha × ${metaForms} contados pelo Meta ` +
              `(${pct(metaForms ? planForms / metaForms : 0)} de cobertura)`);

  if (prefixoCsv) {
    const fs = require('fs');
    fs.writeFileSync(`${prefixoCsv}-criativos.csv`, paraCsv(porCriativo));
    fs.writeFileSync(`${prefixoCsv}-publicos.csv`, paraCsv(porPublico));
    fs.writeFileSync(`${prefixoCsv}-campanhas.csv`, paraCsv(porCampanha));
    console.log(`\n  CSVs gravados em ${prefixoCsv}-*.csv`);
  }
}

if (require.main === module) {
  main().catch(e => { console.error('\nFalhou:', e.message); process.exit(1); });
}

module.exports = {
  toISODate, extrairForms, extrairLP, janelaDaFonte, insightsPorAnuncio,
  montarUniverso, criarResolvedorLP, atribuir, agrupar,
};
