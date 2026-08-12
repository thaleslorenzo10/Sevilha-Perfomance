'use strict';

/**
 * Teste offline do cruzamento planilha × RD Station CRM
 * (node scripts/test-leads-crm.js). Nenhuma chamada de rede.
 *
 * O que motivou este teste
 * ------------------------
 * O vínculo entre anúncio e negócio depende de uma corrente de três elos:
 *
 *     anúncio ──(ad_id / utm)── lead na planilha ──(e-mail)── deal no RD
 *
 * O elo do meio é o frágil. Se o extrator da planilha deixar de trazer e-mail
 * e telefone, `casar` não acha par nenhum e o relatório sai com 0% de
 * casamento — sem erro, sem exceção, só um relatório vazio que parece dizer
 * "o CRM não tem esses leads". Foi exatamente esse o defeito na primeira
 * versão. Por isso o primeiro bloco aqui não testa o cruzamento: testa que os
 * extratores continuam entregando o contato.
 *
 * O resto cobre o que a API do RD faz de imprevisível — envelope de contato em
 * quatro formatos, telefone escrito de jeitos diferentes dos dois lados — e a
 * regra de contagem que decide se a taxa de agendamento sai correta.
 *
 * O que este teste NÃO cobre: a chamada real ao RD. Sem token não dá para
 * exercitar `buscarDeals` nem confirmar o formato que a conta devolve de fato.
 */

const assert = require('assert');

let falhas = 0;
function ok(cond, titulo, detalhe) {
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${titulo}${detalhe !== undefined ? ` — ${detalhe}` : ''}`);
  if (!cond) falhas++;
}

/* ── planilhas de mentira ─────────────────────────────────────────────── */

const CAB_FORMS = ['id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name',
  'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic', 'platform',
  'Quantos colaboradores você tem?', 'Qual a sua posição no escritório Contábil?',
  'qual_o_nome_do_escritório_de_contabilidade?', 'full_name', 'email', 'phone_number'];

const tabsForms = [{ rows: [CAB_FORMS,
  ['l:1', '2026-03-04T10:00:00-03:00', 'ag:123', '008 – Contabilidade Lucrativa',
   'as:456', 'LAL 1% LEAD', 'c:789', '[SE] [FORMS] Escala', 'f1', 'Form', 'false',
   'instagram', 'Mais de 20', 'Dono / Sócio', 'Escritório X', 'Fulano',
   ' FULANO@Example.com ', '55 (31) 99821-9852'],
  ['l:2', '2026-03-05T10:00:00-03:00', 'ag:123', '008 – Contabilidade Lucrativa',
   'as:456', 'LAL 1% LEAD', 'c:789', '[SE] [FORMS] Escala', 'f1', 'Form', 'false',
   'facebook', '5 a 9', 'Gerente', 'Escritório Z', 'Sicrano', '', '31988887777'],
] }];

const CAB_LP = ['Qual seu nome?', 'Qual seu e-mail?', 'Qual seu Whatsapp?',
  'Qual o nome do Escritório de Contabilidade?', 'Qual a sua posição no escritório Contábil?',
  'Quantos colaboradores você tem?', 'Pontuação', 'Data', 'ID',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

const tabsLP = [{ rows: [CAB_LP,
  ['Beltrano', 'beltrano@x.com.br', '(31) 97777-1234', 'Escritório Y', 'Gerente',
   '15 a 30', '80', '03/04/2026', 'r-1', 'ig', 'pago', '[SE] LP', '456', 'AD01 VIDEO'],
] }];

// lib/sheets é substituído ANTES do require dos scripts, senão eles pegariam o
// módulo de verdade e a bateria só rodaria com acesso às planilhas.
const caminhoSheets = require.resolve('../lib/sheets');
require.cache[caminhoSheets] = {
  id: caminhoSheets, filename: caminhoSheets, loaded: true,
  exports: { readAllTabs: async () => tabsForms, readLPTabs: async () => tabsLP },
};

const { extrairForms, extrairLP } = require('./leads-10mais');
const { chaveEmail, chaveFone, achatarDeal, casar, main } = require('./leads-crm');

/* ── 1. o contato precisa sair da planilha ────────────────────────────── */

console.log('\n— contato vindo dos extratores —');

const forms = extrairForms(tabsForms);
const lp = extrairLP(tabsLP);

ok(forms.length === 2, 'os dois leads de FORMS foram lidos', `${forms.length}`);
ok(forms[0].email === 'FULANO@Example.com',
   'extrairForms traz o e-mail sem normalizar (só aparado)', JSON.stringify(forms[0].email));
ok(forms[0].telefone === '55 (31) 99821-9852',
   'extrairForms traz o telefone', JSON.stringify(forms[0].telefone));
ok(forms[1].email === '' && forms[1].telefone === '31988887777',
   'lead que só deixou WhatsApp chega com e-mail vazio e telefone preenchido');
ok(lp.length === 1 && lp[0].email === 'beltrano@x.com.br' && lp[0].telefone === '(31) 97777-1234',
   'extrairLP traz e-mail e telefone', `${lp[0]?.email} / ${lp[0]?.telefone}`);
ok(forms[0].adId === '123' && forms[0].adsetId === '456',
   'e os ids do anúncio continuam limpos, sem os prefixos ag:/as:');

/* ── 2. chaves de contato ─────────────────────────────────────────────── */

console.log('\n— chave de e-mail —');
ok(chaveEmail(' Fulano@Example.COM ') === 'fulano@example.com', 'normaliza caixa e espaço');
ok(chaveEmail('JOÃO@empresa.com.br') === 'joao@empresa.com.br', 'tira acento do lado local');
ok(chaveEmail('sem-arroba') === '', 'texto que não é e-mail vira vazio');
ok(chaveEmail('a@b') === '', 'e-mail sem domínio completo é descartado');
ok(chaveEmail('') === '' && chaveEmail(null) === '' && chaveEmail(undefined) === '',
   'vazio, null e undefined não viram chave');
ok(chaveEmail('a@b.c d@e.f') === '', 'duas palavras não formam uma chave');

console.log('\n— chave de telefone —');
ok(chaveFone('55 (31) 99821-9852') === chaveFone('(31) 99821-9852'),
   'com e sem DDI casam', chaveFone('55 (31) 99821-9852'));
ok(chaveFone('5531998219852') === chaveFone('31 9 9821-9852'),
   'com e sem separador casam');
ok(chaveFone('31998219852') === '98219852',
   'sobram os 8 últimos dígitos', chaveFone('31998219852'));
ok(chaveFone('(31) 99821-9852') !== chaveFone('(31) 99821-9853'),
   'números que diferem nos 8 finais NÃO casam');
ok(chaveFone('1234567') === '', 'menos de 8 dígitos não vira chave (curto demais)');
ok(chaveFone('') === '' && chaveFone(null) === '', 'vazio e null não viram chave');
ok(chaveFone('não informado') === '', 'texto sem dígito não vira chave');

// O limite conhecido da chave de 8 dígitos, escrito como teste para não virar
// surpresa: dois números de DDDs diferentes com os mesmos 8 finais colidem. É
// um risco aceito porque (a) o telefone só entra quando o e-mail não resolveu e
// (b) a base tem milhares de contatos, não milhões. Se um dia a taxa de
// casamento por telefone subir muito, é aqui que se olha primeiro.
ok(chaveFone('(11) 39821-9852') === chaveFone('(31) 99821-9852'),
   'LIMITE CONHECIDO: DDDs diferentes com os mesmos 8 finais colidem');

/* ── 3. achatar o deal nos formatos que o RD devolve ──────────────────── */

console.log('\n— envelopes de contato do RD —');

const formatos = {
  'contacts[].emails[]': { _id: 'd1', contacts: [{ emails: [{ email: 'A@X.com' }], phones: [{ phone: '(31) 99821-9852' }] }] },
  'contacts[].email':    { _id: 'd2', contacts: [{ email: 'A@X.com', phone: '(31) 99821-9852' }] },
  'contact singular':    { _id: 'd3', contact: { emails: [{ email: 'A@X.com' }], phones: [{ phone: '(31) 99821-9852' }] } },
  'contact objeto solto': { _id: 'd4', contact: { email: 'A@X.com', phone: '(31) 99821-9852' } },
};
for (const [nome, cru] of Object.entries(formatos)) {
  const d = achatarDeal(cru);
  ok(d.emails[0] === 'a@x.com' && d.fones[0] === '98219852', `lê ${nome}`,
     `${d.emails.join()} / ${d.fones.join()}`);
}

const semNada = achatarDeal({ id: 'd5' });
ok(semNada.emails.length === 0 && semNada.fones.length === 0 && semNada.id === 'd5',
   'deal sem contato nenhum não quebra');
ok(achatarDeal({ _id: 'd6', contacts: [null, { email: 'b@x.com' }] }).emails[0] === 'b@x.com',
   'contato nulo no meio da lista não derruba os outros');
ok(achatarDeal({ _id: 'd7', contacts: [{ emails: [{ email: 'c@x.com' }], email: 'c@x.com' }] })
     .emails.length === 1, 'o mesmo e-mail nas duas formas não duplica');

console.log('\n— ganho, perda e valor —');
ok(achatarDeal({ _id: 'g1', win: true }).ganho === true, 'win=true é ganho');
ok(achatarDeal({ _id: 'g2', deal_stage: { nickname: 'won' } }).ganho === true,
   'etapa com nickname "won" também é ganho');
ok(achatarDeal({ _id: 'g3', win: false }).ganho === false, 'win=false não é ganho');
ok(achatarDeal({ _id: 'g4', win: null }).ganho === false && achatarDeal({ _id: 'g4', win: null }).perdido === false,
   'deal em aberto não é nem ganho nem perdido');
ok(achatarDeal({ _id: 'v1', amount_total: '1200.50' }).valor === 1200.5, 'lê amount_total');
ok(achatarDeal({ _id: 'v2', amount_montly: 300 }).valor === 300, 'cai para amount_montly');
ok(achatarDeal({ _id: 'v3' }).valor === 0, 'sem valor é zero, não NaN');
ok(achatarDeal({ _id: 'c1', created_at: '2026-03-04T12:00:00.000Z' }).criado === '2026-03-04',
   'a data de criação vira AAAA-MM-DD');
ok(achatarDeal({ _id: 'c2' }).criado === '', 'deal sem data de criação não vira "undefine"');
ok(achatarDeal({ _id: 'e1' }).etapa === '(sem etapa)', 'deal sem etapa recebe rótulo explícito');

/* ── 4. o cruzamento ──────────────────────────────────────────────────── */

console.log('\n— casar leads com deals —');

const deals = [
  achatarDeal({ _id: 'D-email', contacts: [{ emails: [{ email: 'fulano@example.com' }] }] }),
  achatarDeal({ _id: 'D-fone', contacts: [{ phones: [{ phone: '(31) 98888-7777' }] }] }),
  achatarDeal({ _id: 'D-ambos', win: true, amount_total: 5000,
                contacts: [{ emails: [{ email: 'beltrano@x.com.br' }], phones: [{ phone: '31977771234' }] }] }),
  achatarDeal({ _id: 'D-orfao', contacts: [{ emails: [{ email: 'ninguem@x.com' }] }] }),
];

const leads = [
  { email: ' FULANO@Example.com ', telefone: '55 (31) 99821-9852' },  // casa por e-mail
  { email: '', telefone: '31988887777' },                             // casa por telefone
  { email: 'beltrano@x.com.br', telefone: '(31) 97777-1234' },        // casa por e-mail
  { email: 'desconhecido@x.com', telefone: '' },                      // não casa
];
const r = casar(leads, deals);

ok(leads[0].deal?.id === 'D-email', 'lead com e-mail casa pelo e-mail', leads[0].deal?.id);
ok(leads[1].deal?.id === 'D-fone', 'lead sem e-mail cai para o telefone', leads[1].deal?.id);
ok(leads[3].deal === null, 'lead sem par no CRM fica sem deal');
ok(r.porEmail === 2 && r.porFone === 1 && r.semDeal === 1,
   'a contagem por caminho fecha', JSON.stringify({ e: r.porEmail, f: r.porFone, s: r.semDeal }));
ok(r.dealsCasados.size === 3, 'três deals distintos foram alcançados', `${r.dealsCasados.size}`);
ok(!r.dealsCasados.has('D-orfao'), 'o deal que ninguém alcançou fica de fora');

console.log('\n— e-mail tem prioridade sobre telefone —');
// O mesmo telefone aponta para um deal, o e-mail para outro. Telefone de 8
// dígitos colide mais fácil (números sequenciais de uma mesma empresa, linha
// trocada de dono), então o e-mail é quem decide.
const conflito = [
  achatarDeal({ _id: 'D-certo', contacts: [{ emails: [{ email: 'zeca@x.com' }] }] }),
  achatarDeal({ _id: 'D-errado', contacts: [{ phones: [{ phone: '3133334444' }] }] }),
];
const leadConflito = [{ email: 'zeca@x.com', telefone: '3133334444' }];
casar(leadConflito, conflito);
ok(leadConflito[0].deal.id === 'D-certo', 'o par de e-mail vence o par de telefone',
   leadConflito[0].deal.id);

console.log('\n— duas submissões da mesma pessoa —');
// Quem preencheu o formulário duas vezes gera dois leads e UM negócio. Se cada
// lead contasse um deal, a taxa "lead 10+ → reunião" passaria de 100% e o
// criativo da segunda submissão levaria crédito por uma reunião que não houve.
const umDeal = [achatarDeal({ _id: 'D-unico', contacts: [{ emails: [{ email: 'rep@x.com' }] }] })];
const repetidos = [{ email: 'rep@x.com', telefone: '' }, { email: 'REP@x.com', telefone: '' }];
const rr = casar(repetidos, umDeal);
ok(repetidos[0].deal === repetidos[1].deal, 'as duas submissões apontam para o mesmo deal');
ok(rr.dealsCasados.size === 1, 'e ele conta como UM negócio', `${rr.dealsCasados.size}`);
ok(rr.porEmail === 2, 'mesmo tendo casado duas vezes');

console.log('\n— casar não inventa par —');
const nadaCasa = [{ email: '', telefone: '' }, { email: 'x', telefone: 'sem número' }];
const rn = casar(nadaCasa, deals);
ok(nadaCasa.every(l => l.deal === null), 'lead sem contato utilizável não casa com nada');
ok(rn.semDeal === 2 && rn.dealsCasados.size === 0, 'e nenhum deal é marcado como alcançado');

/* ── 5. ponta a ponta, com o que saiu dos extratores ──────────────────── */

console.log('\n— planilha → CRM, usando os extratores de verdade —');
const reais = forms.concat(lp);
const dealsReais = [
  achatarDeal({ _id: 'R1', contacts: [{ emails: [{ email: 'fulano@example.com' }] }] }),
  achatarDeal({ _id: 'R2', contacts: [{ phones: [{ phone: '(31) 98888-7777' }] }] }),
  achatarDeal({ _id: 'R3', contacts: [{ emails: [{ email: 'beltrano@x.com.br' }] }] }),
];
const rf = casar(reais, dealsReais);
ok(reais.filter(l => l.deal).length === 3,
   'os três leads da planilha acham o deal deles', `${reais.filter(l => l.deal).length}/3`);
ok(rf.porEmail === 2 && rf.porFone === 1,
   'um deles pelo telefone, porque não deixou e-mail no formulário');
assert.ok(reais.every(l => l.porte), 'todo lead sai classificado por porte');

/* ── 6. o relatório inteiro, de ponta a ponta ─────────────────────────── */

/**
 * As unidades acima não pegam o erro mais provável na prática: o relatório
 * montar errado e estourar só na hora em que alguém roda com o token na mão —
 * variável fora de escopo, campo que virou Set, divisão por lista vazia. Aqui
 * `main` roda de verdade contra um RD de mentira, e o teste lê a saída.
 *
 * Sem META_ACCESS_TOKEN de propósito: é o caminho que o Thales vai usar na
 * primeira execução, antes de ter os dois tokens juntos na máquina.
 */
async function relatorioPontaAPonta() {
  console.log('\n— relatório completo contra um RD de mentira —');

  const DEALS = [
    { _id: 'RD1', name: 'Fulano', created_at: '2026-03-05T10:00:00Z', win: true,
      amount_total: '4000', deal_stage: { _id: 's3', name: 'Fechado' },
      contacts: [{ emails: [{ email: 'fulano@example.com' }] }] },
    { _id: 'RD2', name: 'Sicrano', created_at: '2026-03-06T10:00:00Z',
      deal_stage: { _id: 's1', name: 'Contato' },
      contacts: [{ phones: [{ phone: '(31) 98888-7777' }] }] },
    { _id: 'RD3', name: 'Antigo', created_at: '2025-01-01T10:00:00Z',
      deal_stage: { _id: 's1', name: 'Contato' },
      contacts: [{ emails: [{ email: 'ninguem@x.com' }] }] },
  ];

  const pedidos = [];
  const fetchOriginal = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    pedidos.push(u);
    const corpo = u.includes('/deal_stages')
      ? [{ _id: 's1', name: 'Contato', order: 1 },
         { _id: 's2', name: 'Reunião', order: 2 },
         { _id: 's3', name: 'Fechado', order: 3 }]
      : { deals: DEALS };
    return { ok: true, status: 200, json: async () => corpo, text: async () => '' };
  };

  const saida = [];
  const logOriginal = console.log;
  const warnOriginal = console.warn;
  console.log = (...a) => saida.push(a.join(' '));
  console.warn = (...a) => saida.push(a.join(' '));

  const tokenSalvo = process.env.RD_CRM_TOKEN;
  const metaSalvo = process.env.META_ACCESS_TOKEN;
  process.env.RD_CRM_TOKEN = 'token-de-mentira';
  delete process.env.META_ACCESS_TOKEN;

  let erro = null;
  try {
    await main();
  } catch (e) {
    erro = e;
  } finally {
    console.log = logOriginal;
    console.warn = warnOriginal;
    global.fetch = fetchOriginal;
    if (tokenSalvo === undefined) delete process.env.RD_CRM_TOKEN;
    else process.env.RD_CRM_TOKEN = tokenSalvo;
    if (metaSalvo !== undefined) process.env.META_ACCESS_TOKEN = metaSalvo;
  }

  const txt = saida.join('\n');
  ok(!erro, 'o relatório roda inteiro sem estourar', erro ? erro.stack.split('\n')[0] : '');
  if (erro) return;

  ok(pedidos.some(u => u.includes('deal_pipeline_id=68d152fa949ae20022df32cb')),
     'pediu o funil da Sessão Estratégica (padrão)');
  ok(/leads com deal \.+ 2 de 3/.test(txt),
     'dois dos três leads acharam deal', (txt.match(/leads com deal.*/) || [''])[0]);
  ok(/por telefone \.+ 1/.test(txt), 'um deles pelo telefone');
  ok(txt.includes('MENOS DE METADE') === false, 'com 66% não dispara o aviso de cobertura baixa');
  ok(/deals com lead \.+ 2 de 2/.test(txt),
     'o deal anterior à planilha sai do denominador do lado do CRM',
     (txt.match(/deals com lead.*/) || [''])[0]);
  ok(txt.includes('1 deals anteriores à planilha'), 'e é dito quantos ficaram de fora');
  ok(txt.includes('sem META_ACCESS_TOKEN'), 'avisa que está rodando sem os números de custo');
  ok(/008 – Contabilidade Lucrativa/.test(txt), 'o criativo de FORMS aparece na tabela');
  ok(/AD01 VIDEO/.test(txt), 'e o de LP também, pela utm_content');
  ok(txt.includes('R$ 4.000'), 'a receita do negócio ganho entra na conta',
     (txt.match(/receita registrada.*/) || [''])[0]);
  ok(/Reunião/.test(txt), 'as etapas do funil são listadas na ordem do RD');

  // Sem gasto, nenhuma coluna de custo pode inventar número.
  ok(!/R\$ 0(?!\d)/.test(txt.split('O QUE ISSO DIZ')[0] || ''),
     'sem Meta, as colunas de custo ficam com "—" em vez de R$ 0');
}

/**
 * O mesmo relatório com o Meta ligado — o caminho que produz as colunas de
 * custo, e o único em que gasto e lead precisam pousar no mesmo anúncio.
 * É aqui que mora o erro caro: se a atribuição escorregar, o número que sai é
 * um custo por reunião plausível e errado, e ninguém percebe olhando a tabela.
 */
async function relatorioComMeta() {
  console.log('\n— o mesmo relatório, agora com o Meta ligado —');

  const ANUNCIOS = [
    { ad_id: '123', ad_name: '008 – Contabilidade Lucrativa', adset_id: '456',
      adset_name: 'LAL 1% LEAD', campaign_id: '789', campaign_name: '[SE] [FORMS] Escala',
      spend: '600', impressions: '10000',
      actions: [{ action_type: 'onsite_conversion.lead_grouped', value: '2' }] },
    { ad_id: '999', ad_name: 'AD01 VIDEO', adset_id: '456',
      adset_name: 'LAL 1% LEAD', campaign_id: '790', campaign_name: '[SE] LP Tráfego',
      spend: '400', impressions: '8000', actions: [{ action_type: 'lead', value: '1' }] },
    // O funil errado. Se este gasto vazar para a tabela, todo custo por reunião
    // da Sessão Estratégica sai inflado — por isso ele está aqui.
    { ad_id: '111', ad_name: 'CRIATIVO DO CLUBE', adset_id: '222',
      adset_name: 'PÚBLICO DO CLUBE', campaign_id: '791', campaign_name: '[CP] Clube',
      spend: '5000', impressions: '9000', actions: [] },
  ];

  const DEALS = [
    { _id: 'RD1', created_at: '2026-03-05T10:00:00Z', win: true, amount_total: '4000',
      deal_stage: { _id: 's3', name: 'Fechado' },
      contacts: [{ emails: [{ email: 'fulano@example.com' }] }] },
    { _id: 'RD2', created_at: '2026-03-06T10:00:00Z', deal_stage: { _id: 's1', name: 'Contato' },
      contacts: [{ phones: [{ phone: '(31) 98888-7777' }] }] },
  ];

  const fetchOriginal = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    const corpo = u.includes('graph.facebook.com') ? { data: ANUNCIOS }
      : u.includes('/deal_stages') ? [{ _id: 's1', name: 'Contato', order: 1 },
                                      { _id: 's3', name: 'Fechado', order: 2 }]
      : { deals: DEALS };
    return { ok: true, status: 200, json: async () => corpo, text: async () => '' };
  };

  const saida = [];
  const logOriginal = console.log;
  const warnOriginal = console.warn;
  console.log = (...a) => saida.push(a.join(' '));
  console.warn = (...a) => saida.push(a.join(' '));

  process.env.RD_CRM_TOKEN = 'token-de-mentira';
  process.env.META_ACCESS_TOKEN = 'meta-de-mentira';

  let erro = null;
  try {
    await main();
  } catch (e) {
    erro = e;
  } finally {
    console.log = logOriginal;
    console.warn = warnOriginal;
    global.fetch = fetchOriginal;
    delete process.env.RD_CRM_TOKEN;
    delete process.env.META_ACCESS_TOKEN;
  }

  const txt = saida.join('\n');
  ok(!erro, 'roda inteiro com o Meta ligado', erro ? erro.stack.split('\n')[0] : '');
  if (erro) return;

  const linha = nome => (txt.split('\n').find(l => l.includes(nome)) || '');

  ok(!txt.includes('sem META_ACCESS_TOKEN'), 'não avisa mais que está sem custo');
  ok(linha('008 – Contabilidade').includes('R$ 600'),
     'o gasto do criativo de FORMS entra', linha('008 – Contabilidade').trim());
  ok(linha('AD01 VIDEO').includes('R$ 400'),
     'e o do criativo de LP também, resolvido pela utm', linha('AD01 VIDEO').trim());
  ok(!txt.includes('CRIATIVO DO CLUBE') && !txt.includes('R$ 5.000'),
     'o gasto do funil [CP] não vaza para o relatório da [SE]');

  // 2 leads no criativo de FORMS, 1 deles 10+, 2 reuniões (RD1 e RD2), 1 ganho.
  // R$ 600 ÷ 1 lead 10+ = R$ 600 · ÷ 2 reuniões = R$ 300 · ÷ 1 ganho = R$ 600.
  const forms008 = linha('008 – Contabilidade');
  ok(/R\$ 600.*\s1\s+2\s+1\s/.test(forms008) || forms008.includes('R$ 300'),
     'as divisões batem: R$ 300 por reunião no criativo de FORMS', forms008.trim());
  ok(linha('AD01 VIDEO').includes('—'),
     'criativo sem reunião mostra "—", não R$ 0 nem divisão por zero',
     linha('AD01 VIDEO').trim());
  ok(/100,0%/.test(forms008), 'a taxa 10+ → reunião aparece', forms008.trim());
}

relatorioPontaAPonta()
  .then(relatorioComMeta)
  .catch(e => { falhas++; console.error(e); })
  .then(() => {
    console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo certo\n');
    process.exit(falhas ? 1 : 0);
  });
