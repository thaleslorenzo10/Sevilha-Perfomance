'use strict';

/**
 * Sevilha Performance — do anúncio até o negócio no RD Station CRM.
 *
 *   node scripts/leads-crm.js                 # relatório no terminal
 *   node scripts/leads-crm.js --csv=crm       # grava crm-criativos.csv etc.
 *   node scripts/leads-crm.js --funil=CP      # o outro funil (padrão: SE)
 *
 * scripts/leads-10mais.js para no lead: diz quanto custa um lead de 10+
 * colaboradores por anúncio. Este vai um passo adiante e responde o que
 * realmente decide verba — quanto custa uma REUNIÃO e quanto custa um CLIENTE,
 * por anúncio e por público.
 *
 * ── Por que isso muda as decisões ───────────────────────────────────────
 *
 * O custo por lead qualificado é um proxy: assume que todo lead de 10+
 * colaboradores vale o mesmo. Não vale. Dois criativos com o mesmo CPL 10+
 * podem ter taxas de agendamento bem diferentes, e o que parece empate no topo
 * vira 2x de diferença no fim. Só o CRM sabe disso.
 *
 * É também o que transforma o TCPL num número de negócio em vez de um número
 * histórico. Hoje ele sai de "20% melhor que o mês passado"; com o CRM sai de
 * "o que a empresa pode pagar por um cliente".
 *
 * ── Como o vínculo é feito ──────────────────────────────────────────────
 *
 * O RD guarda contato (e-mail e telefone), não utm nem ad_id. A planilha
 * guarda os dois lados. Então a ponte é o contato:
 *
 *     anúncio ──(ad_id / utm)── lead na planilha ──(e-mail)── deal no RD
 *
 * E-mail é a chave principal; telefone é a reserva, para quem preencheu só o
 * WhatsApp. O telefone compara os 8 últimos dígitos — o mesmo número aparece
 * como "5531998219852" na planilha e "(31) 99821-9852" no RD, e qualquer
 * comparação mais rígida perde o par.
 *
 * ── O número que decide se vale confiar ─────────────────────────────────
 *
 * A taxa de casamento. Se só 40% dos leads da planilha existem no CRM, o
 * relatório está medindo 40% da realidade e todo custo por reunião sai
 * inflado — o gasto entra inteiro e o denominador entra pela metade. Por isso
 * ela é a primeira coisa impressa, antes de qualquer ranking, e o script diz
 * na cara quando ela é baixa demais para sustentar decisão.
 *
 * A comparação também é recortada na janela das planilhas: deal criado antes
 * do primeiro lead registrado não tem como casar, e contá-lo no denominador
 * faria a cobertura parecer pior do que é.
 *
 * ── O que é preciso para rodar ──────────────────────────────────────────
 *
 *   RD_CRM_TOKEN         obrigatório (token da API do RD Station CRM)
 *   META_ACCESS_TOKEN    opcional — sem ele o relatório sai com as taxas de
 *                        avanço no funil, mas sem as colunas de custo
 *   acesso às planilhas   (Service Account ou CSV público, ver lib/sheets.js)
 *
 * Aceita um .env na raiz do projeto.
 *
 * ── Dado pessoal ────────────────────────────────────────────────────────
 *
 * Este script lê e-mail e telefone dos leads porque é a única chave que liga
 * planilha e CRM. Nada disso é impresso nem gravado: o que sai são contagens
 * por criativo, público e campanha. Mantenha assim.
 */

const fs = require('fs');
const path = require('path');

/* ── .env opcional ────────────────────────────────────────────────────── */

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const linha of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const { readAllTabs, readLPTabs } = require('../lib/sheets');
const { norm } = require('../lib/texto');
const { PORTE_MAIOR } = require('../lib/porte');
const {
  extrairForms, extrairLP, janelaDaFonte,
  insightsPorAnuncio, montarUniverso, atribuir,
} = require('./leads-10mais');

const CRM = 'https://crm.rdstation.com/api/v1';

/** Funis acompanhados — mesmos ids de api/rd-stats.js. */
const FUNIS = {
  SE: { id: '68d152fa949ae20022df32cb', nome: 'Sessão Estratégica' },
  CP: { id: '69d52f54c0b8000015d2e7b9', nome: 'Clube da Performance' },
};

/* ── chaves de contato ────────────────────────────────────────────────── */

/** E-mail normalizado, ou vazio se não for e-mail. */
const chaveEmail = v => {
  const e = norm(v);
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : '';
};

/**
 * Últimos 8 dígitos. Some com DDI, DDD, o nono dígito e toda a pontuação —
 * que é exatamente onde os dois sistemas divergem. Oito dígitos ainda são
 * específicos o bastante para o volume desta base (milhares, não milhões).
 */
const chaveFone = v => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-8) : '';
};

/* ── RD Station ───────────────────────────────────────────────────────── */

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new Error(`RD ${res.status}: ${corpo.slice(0, 160)}`);
  }
  return res.json();
}

/**
 * Todos os deals do funil. A API entrega no máximo 200 por página e não avisa
 * quando acabou — o corte é a página vir incompleta.
 */
async function buscarDeals(token, pipelineId, maxPaginas = 40) {
  const deals = [];
  for (let page = 1; page <= maxPaginas; page++) {
    const json = await getJSON(
      `${CRM}/deals?token=${token}&deal_pipeline_id=${pipelineId}&limit=200&page=${page}`);
    const lote = json.deals || json.data || [];
    deals.push(...lote);
    process.stdout.write(`\r  ${deals.length} deals lidos…`);
    if (lote.length < 200) break;
    if (page === maxPaginas) {
      console.warn(`\n  ⚠  parei em ${maxPaginas} páginas — pode haver deal não lido`);
    }
  }
  process.stdout.write('\r' + ' '.repeat(28) + '\r');
  return deals;
}

/**
 * Achata o deal no que interessa. A v1 do RD varia o envelope conforme o
 * endpoint e a conta, então cada campo aceita as formas conhecidas em vez de
 * confiar numa só — igual ao que api/rd-stats.js já faz com as etapas.
 */
function achatarDeal(d) {
  const contatos = d.contacts || d.contact || [];
  const lista = Array.isArray(contatos) ? contatos : [contatos];

  const emails = [];
  const fones = [];
  for (const c of lista) {
    if (!c) continue;
    for (const e of (c.emails || [])) if (e?.email) emails.push(e.email);
    if (c.email) emails.push(c.email);
    for (const p of (c.phones || [])) if (p?.phone) fones.push(p.phone);
    if (c.phone) fones.push(c.phone);
  }

  // "Ganho" no RD vem como win=true; algumas contas marcam só pela etapa.
  const ganho = d.win === true || d.deal_stage?.nickname === 'won';
  const perdido = d.win === false;

  return {
    id: d._id || d.id,
    nome: d.name || '',
    criado: String(d.created_at || d.created_date || '').slice(0, 10),
    etapa: d.deal_stage?.name || d.deal_stage?.nome || '(sem etapa)',
    etapaId: d.deal_stage?._id || d.deal_stage?.id || '',
    valor: parseFloat(d.amount_total ?? d.amount_montly ?? d.total ?? 0) || 0,
    ganho, perdido,
    emails: [...new Set(emails.map(chaveEmail).filter(Boolean))],
    fones: [...new Set(fones.map(chaveFone).filter(Boolean))],
  };
}

/** Ordem das etapas, para saber o que é "mais fundo no funil". */
async function buscarEtapas(token, pipelineId) {
  try {
    const json = await getJSON(`${CRM}/deal_stages?token=${token}&deal_pipeline_id=${pipelineId}`);
    const lista = Array.isArray(json) ? json : json.deal_stages || json.data || [];
    return lista
      .slice()
      .sort((a, b) => (a.order ?? a.position ?? 0) - (b.order ?? b.position ?? 0))
      .map(s => s.name || s.nome)
      .filter(Boolean);
  } catch (e) {
    console.warn(`  ⚠  não deu para ler a ordem das etapas (${e.message}); seguindo sem ela`);
    return null;
  }
}

/* ── cruzamento ───────────────────────────────────────────────────────── */

/**
 * Casa cada lead da planilha com um deal do CRM, carimbando `deal` no lead.
 *
 * E-mail primeiro; telefone só quando o e-mail não resolve, para não deixar um
 * par de telefone furado sobrepor um casamento de e-mail que estava certo.
 *
 * Um deal pode receber mais de um lead — a mesma pessoa que preencheu duas
 * vezes gera dois leads e um negócio só. Contar o deal duas vezes inflaria a
 * taxa de agendamento do criativo que veio depois, então `dealsCasados` guarda
 * os negócios distintos alcançados e é ele que entra nas divisões.
 */
function casar(leads, deals) {
  const porEmail = new Map();
  const porFone = new Map();
  for (const d of deals) {
    for (const e of d.emails) if (!porEmail.has(e)) porEmail.set(e, d);
    for (const f of d.fones) if (!porFone.has(f)) porFone.set(f, d);
  }

  let porE = 0, porF = 0, sem = 0;
  const casados = new Set();
  for (const l of leads) {
    const e = chaveEmail(l.email);
    const f = chaveFone(l.telefone);
    let d = e ? porEmail.get(e) : null;
    if (d) porE++;
    else {
      d = f ? porFone.get(f) : null;
      if (d) porF++; else sem++;
    }
    l.deal = d || null;
    if (d) casados.add(d.id);
  }
  return { porEmail: porE, porFone: porF, semDeal: sem, dealsCasados: casados };
}

/* ── saída ────────────────────────────────────────────────────────────── */

const brl = v => 'R$ ' + (v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const pct = v => (100 * v).toFixed(1).replace('.', ',') + '%';

const COLS = [
  ['gasto',    11, o => (o.gasto ? brl(o.gasto) : '—')],
  ['10+',       6, o => String(o.q)],
  ['deals',     7, o => String(o.deals)],
  ['ganhos',    8, o => String(o.ganhos)],
  ['R$/10+',   10, o => (o.gasto && o.q ? brl(o.gasto / o.q) : '—')],
  ['10+→deal',  10, o => (o.q ? pct(o.q10Deals / o.q) : '—')],
  ['R$/deal',  10, o => (o.gasto && o.deals ? brl(o.gasto / o.deals) : '—')],
  ['R$/ganho', 11, o => (o.gasto && o.ganhos ? brl(o.gasto / o.ganhos) : '—')],
];

function tabela(titulo, linhas, w = 40) {
  const largura = w + COLS.reduce((s, c) => s + c[1], 0) + 2;
  console.log('\n' + '─'.repeat(largura));
  console.log('  ' + titulo);
  console.log('─'.repeat(largura));
  console.log('  ' + 'criativo/público'.padEnd(w) +
    COLS.map(c => c[0].padStart(c[1])).join(''));
  if (!linhas.length) console.log('  (nada a mostrar)');
  for (const o of linhas) {
    console.log('  ' + String(o.chave).slice(0, w - 2).padEnd(w) +
      COLS.map(c => c[2](o).padStart(c[1])).join(''));
  }
}

/* ── main ─────────────────────────────────────────────────────────────── */

async function main() {
  const arg = n => (process.argv.find(a => a.startsWith(`--${n}=`)) || '').split('=')[1] || '';
  const funilKey = (arg('funil') || 'SE').toUpperCase();
  const funil = FUNIS[funilKey];
  if (!funil) throw new Error(`funil desconhecido: ${funilKey} (use SE ou CP)`);

  const token = process.env.RD_CRM_TOKEN;
  if (!token) {
    throw new Error('RD_CRM_TOKEN não configurado — ponha no .env da raiz ou exporte na sessão');
  }

  console.log(`Funil: ${funil.nome}\nLendo as planilhas…`);
  const [tabsForms, tabsLP] = await Promise.all([readAllTabs(), readLPTabs()]);
  const leads = extrairForms(tabsForms).concat(extrairLP(tabsLP));
  const jForms = janelaDaFonte(leads, 'FORMS');
  const jLP = janelaDaFonte(leads, 'LP');
  const primeiroLead = [jForms.since, jLP.since].filter(Boolean).sort()[0] || '';
  console.log(`  ${leads.length} leads  ·  FORMS ${jForms.since} → ${jForms.until}` +
              `  ·  LP ${jLP.since} → ${jLP.until}`);

  /* Meta é opcional: sem ele o relatório perde as colunas de custo, não o
     resto. Melhor rodar pela metade do que exigir dois tokens de uma vez. */
  let ads = new Map();
  const comMeta = Boolean(process.env.META_ACCESS_TOKEN);
  if (comMeta) {
    console.log('Buscando insights no Meta…');
    const [mapaForms, mapaLP] = await Promise.all([
      insightsPorAnuncio(jForms.since, jForms.until),
      insightsPorAnuncio(jLP.since, jLP.until),
    ]);
    ads = montarUniverso(mapaForms, mapaLP);
    const { orfaos } = atribuir(leads, ads);
    console.log(`  ${ads.size} anúncios  ·  sem UTM aproveitável: ` +
                `LP ${orfaos.LP.total}, FORMS ${orfaos.FORMS.total}`);
  } else {
    console.warn('  ⚠  sem META_ACCESS_TOKEN: o relatório sai sem gasto, sem CPL e sem');
    console.warn('     custo por reunião. As taxas de avanço no funil continuam valendo.');
  }

  console.log('Buscando deals no RD…');
  const brutos = await buscarDeals(token, funil.id);
  const deals = brutos.map(achatarDeal);
  const etapas = await buscarEtapas(token, funil.id);
  console.log(`  ${deals.length} deals`);

  const m = casar(leads, deals);
  const porDealId = new Map(deals.map(d => [d.id, d]));
  const casados = leads.filter(l => l.deal).length;
  const taxa = leads.length ? casados / leads.length : 0;

  /* ── casamento ────────────────────────────────────────────────────── */

  console.log('\n' + '='.repeat(104));
  console.log('  CASAMENTO PLANILHA × CRM');
  console.log('='.repeat(104));
  console.log(`  leads com deal ........ ${casados} de ${leads.length}  (${pct(taxa)})`);
  console.log(`    por e-mail .......... ${m.porEmail}`);
  console.log(`    por telefone ........ ${m.porFone}`);
  console.log(`  leads sem deal ........ ${m.semDeal}`);

  // Do lado do CRM só entram no denominador os deals criados depois do
  // primeiro lead registrado na planilha — os anteriores não têm como casar.
  const naJanela = deals.filter(d => !primeiroLead || !d.criado || d.criado >= primeiroLead);
  const foraDaJanela = deals.length - naJanela.length;
  const dealsComLead = naJanela.filter(d => m.dealsCasados.has(d.id)).length;
  console.log(`  deals com lead ........ ${dealsComLead} de ${naJanela.length} criados de ` +
              `${primeiroLead || '(início)'} em diante  (${pct(naJanela.length ? dealsComLead / naJanela.length : 0)})`);
  if (foraDaJanela) {
    console.log(`    (${foraDaJanela} deals anteriores à planilha ficaram de fora da conta)`);
  }
  const semContato = deals.filter(d => !d.emails.length && !d.fones.length).length;
  if (semContato) console.log(`  deals sem contato ..... ${semContato} (não têm como casar)`);

  if (taxa < 0.5) {
    console.log('\n  ⚠  MENOS DE METADE DOS LEADS TEM DEAL NESTE FUNIL.');
    console.log('     Todo custo por reunião abaixo sai inflado na mesma proporção, porque');
    console.log('     o gasto entra inteiro e o denominador entra parcial. Antes de mexer em');
    console.log('     verba por estes números, descubra o motivo: pode ser o funil errado');
    console.log(`     (--funil=${funilKey === 'SE' ? 'CP' : 'SE'}), o período, ou lead que não está entrando no CRM.`);
  }

  if (etapas) {
    console.log('\n  etapas do funil, na ordem do RD (deals do funil inteiro × deals vindos de anúncio):');
    const total = {}, deAnuncio = {};
    for (const d of deals) total[d.etapa] = (total[d.etapa] || 0) + 1;
    for (const d of deals) if (m.dealsCasados.has(d.id)) deAnuncio[d.etapa] = (deAnuncio[d.etapa] || 0) + 1;
    etapas.forEach((e, i) => console.log(
      `    ${String(i + 1).padStart(2)}. ${e.slice(0, 34).padEnd(36)}` +
      `${String(total[e] || 0).padStart(5)}${String(deAnuncio[e] || 0).padStart(9)}`));
  }

  /* ── agregação ────────────────────────────────────────────────────── */

  /**
   * Agrega por uma dimensão do anúncio.
   *
   * Com o Meta disponível a chave sai do próprio anúncio (nome real, ad set
   * real) e o gasto entra — e os leads que não foram atribuídos a nenhum
   * anúncio ficam de fora, senão apareceriam num balde sem gasto e o custo por
   * reunião daquela linha sairia zerado. Sem o Meta a chave sai da planilha e
   * as colunas de custo ficam vazias, o que é honesto: não há gasto para dividir.
   *
   * Lead conta por submissão; negócio conta por negócio. Quem preencheu duas
   * vezes vira dois leads e um deal só — somar "um deal por lead casado" daria
   * ao criativo da segunda submissão o crédito de uma reunião que não houve, e
   * a taxa 10+ → reunião poderia passar de 100%. Por isso os deals entram em
   * conjunto e a contagem sai do tamanho dele.
   */
  const agrupar = (doAd, daPlanilha) => {
    const out = new Map();
    const balde = k => {
      if (!out.has(k)) {
        out.set(k, { chave: k, gasto: 0, leads: 0, q: 0, ids: new Set(), ids10: new Set() });
      }
      return out.get(k);
    };

    if (comMeta) {
      for (const ad of ads.values()) {
        if (ad.grupo !== funilKey) continue;
        const k = doAd(ad);
        if (k) balde(k).gasto += ad.gasto;
      }
    }

    for (const l of leads) {
      const ad = comMeta ? ads.get(l.adIdResolvido) : null;
      if (comMeta && (!ad || ad.grupo !== funilKey)) continue;
      const k = ad ? doAd(ad) : daPlanilha(l);
      if (!k) continue;

      const o = balde(k);
      o.leads++;
      const q = l.porte === PORTE_MAIOR;
      if (q) o.q++;
      if (!l.deal) continue;
      o.ids.add(l.deal.id);
      if (q) o.ids10.add(l.deal.id);
    }

    for (const o of out.values()) {
      o.deals = o.ids.size;
      o.q10Deals = o.ids10.size;
      const ganhos = [...o.ids].map(id => porDealId.get(id)).filter(d => d?.ganho);
      o.ganhos = ganhos.length;
      o.valor = ganhos.reduce((s, d) => s + d.valor, 0);
    }
    return [...out.values()];
  };

  const porCriativo = agrupar(a => a.adNome || '(sem nome)', l => l.adNome || '(sem utm_content)');
  const porPublico  = agrupar(a => a.adsetNome || '(sem nome)', l => l.adsetId || '(sem utm_term)');
  const porCampanha = agrupar(a => a.campanha, l => l.campanha || '(sem utm_campaign)');

  const porDeals = (x, y) => y.deals - x.deals || y.q - x.q;
  tabela('POR CRIATIVO — o que virou reunião', porCriativo.sort(porDeals).slice(0, 20));
  tabela('POR PÚBLICO (ad set)', porPublico.sort(porDeals).slice(0, 14));
  tabela('POR CAMPANHA', porCampanha.sort(porDeals).slice(0, 12));

  if (comMeta) {
    const comVolume = porCriativo.filter(o => o.deals >= 5 && o.gasto > 0);
    tabela('CRIATIVOS — melhor custo por reunião (mín. 5 reuniões)',
      comVolume.sort((x, y) => x.gasto / x.deals - y.gasto / y.deals));
  }

  /* ── TCPL de negócio ──────────────────────────────────────────────── */

  const q10 = leads.filter(l => l.porte === PORTE_MAIOR);
  const q10ComDeal = new Set(q10.filter(l => l.deal).map(l => l.deal.id)).size;
  const ganhosIds = new Set(leads.filter(l => l.deal?.ganho).map(l => l.deal.id));
  const receita = [...ganhosIds].reduce((s, id) => s + (porDealId.get(id)?.valor || 0), 0);

  console.log('\n' + '='.repeat(104));
  console.log('  O QUE ISSO DIZ SOBRE O TCPL');
  console.log('='.repeat(104));
  console.log(`  leads 10+ ......................... ${q10.length}`);
  console.log(`  reuniões que vieram deles ......... ${q10ComDeal}  (${pct(q10ComDeal / (q10.length || 1))} dos leads 10+)`);
  console.log(`  negócios ganhos vindos de anúncio . ${ganhosIds.size}`);

  if (receita > 0 && ganhosIds.size > 0) {
    const ticket = receita / ganhosIds.size;
    const taxaGanho = ganhosIds.size / (q10.length || 1);
    console.log(`  receita registrada ................ ${brl(receita)}  (ticket médio ${brl(ticket)})`);
    console.log('\n  Teto do que um lead 10+ pode custar = ticket médio × taxa de lead 10+ → ganho');
    console.log(`                                      = ${brl(ticket)} × ${pct(taxaGanho)} = ${brl(ticket * taxaGanho)}`);
    console.log('  Isso é o ponto de empate, não a meta: aplique a sua margem em cima e o');
    console.log('  alvo fica abaixo desse número. É ele que substitui o TCPL derivado do');
    console.log('  histórico, porque sai do negócio e não do mês passado.');
  } else {
    console.log('\n  Nenhum negócio ganho com valor preenchido — sem isso não dá para derivar');
    console.log('  o TCPL a partir do negócio. Preencher o valor no RD ao marcar "ganho" é');
    console.log('  o que destrava essa conta, e é a mudança de processo com maior retorno');
    console.log('  aqui: sem ela, o alvo de custo continua saindo de comparação histórica.');
  }

  /* ── CSV ──────────────────────────────────────────────────────────── */

  const prefixo = arg('csv');
  if (prefixo) {
    const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const cab = ['chave', 'gasto', 'leads', 'leads_10mais', 'deals', 'deals_de_10mais',
                 'ganhos', 'receita', 'custo_por_deal', 'custo_por_ganho'];
    for (const [nome, linhas] of [['criativos', porCriativo], ['publicos', porPublico],
                                  ['campanhas', porCampanha]]) {
      const csv = [cab.join(',')].concat(linhas.map(o => [
        o.chave, o.gasto.toFixed(2), o.leads, o.q, o.deals, o.q10Deals, o.ganhos,
        o.valor.toFixed(2),
        o.gasto && o.deals ? (o.gasto / o.deals).toFixed(2) : '',
        o.gasto && o.ganhos ? (o.gasto / o.ganhos).toFixed(2) : '',
      ].map(esc).join(','))).join('\n');
      fs.writeFileSync(`${prefixo}-${nome}.csv`, csv);
    }
    console.log(`\n  CSVs gravados em ${prefixo}-*.csv`);
  }
}

if (require.main === module) {
  main().catch(e => { console.error('\nFalhou:', e.message); process.exit(1); });
}

module.exports = { chaveEmail, chaveFone, achatarDeal, casar, main };
