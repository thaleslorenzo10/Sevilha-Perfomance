'use strict';

/**
 * Teste do envio de LeadQualificado para o formulário nativo do Meta
 * (node scripts/test-forms-qualificados.js).
 *
 * Roda offline: a leitura da planilha, o registro de envios e o `fetch` são
 * todos substituídos. As asserções olham o payload que teria ido ao CAPI.
 */

const crypto = require('crypto');

process.env.META_CAPI_TOKEN = 'token-de-teste';
process.env.CRON_SECRET     = 'segredo-cron';

/* ── Dublês, antes de carregar o handler ─────────────────────────────── */

const sheets = require('../lib/sheets');
const registro = require('../lib/eventos-enviados');

let abasCentral = [];
let jaRegistrados = new Set();
let marcados = [];

sheets.readAllTabs = async () => abasCentral;
registro.jaEnviados    = async ids => new Set(ids.filter(id => jaRegistrados.has(id)));
registro.marcarEnviados = async regs => { marcados.push(...regs); };

const handler = require('../api/forms-qualificados');

let chamadas = [];
global.fetch = async (url, opts) => {
  chamadas.push({ url: String(url), body: JSON.parse(opts.body) });
  return { ok: true, status: 200, json: async () => ({ events_received: 1 }) };
};

/* ── Fixtures ────────────────────────────────────────────────────────── */

const DIA = 86400000;
const iso = msAtras => new Date(Date.now() - msAtras).toISOString();

/** Registro de 23 colunas no formato do export do Meta. */
function linhaMeta({ id, quando, colaboradores, email = '', telefone = '', campanha = '[SE] [FORMS] [LEAD] [HOT]', anuncio = 'AD21' }) {
  const r = new Array(23).fill('');
  r[0] = id;            r[1] = quando;
  r[3] = anuncio;       r[5] = 'Warm';
  r[7] = campanha;      r[9] = '[SE] [FORMS] 6';
  r[10] = 'false';      r[11] = 'ig';
  r[12] = colaboradores; r[13] = 'dono/sócio'; r[14] = 'Escritório X';
  r[15] = 'Fulano de Tal'; r[16] = email; r[17] = telefone;
  r[22] = 'CREATED';
  return r;
}

const QUALIFICADO = linhaMeta({
  id: 'l:937639515796206', quando: iso(1 * DIA), colaboradores: 'De 30 a 49',
  email: 'Cristina@Exemplo.COM', telefone: 'p:+5551999998888',
});

function cenario(linhas, { jaEnviados = [] } = {}) {
  abasCentral   = [{ gid: '1331027312', titulo: 'Leads Forms 2', rows: [linhas[0] && [], ...linhas].filter(Boolean) }];
  jaRegistrados = new Set(jaEnviados);
  marcados      = [];
  chamadas      = [];
}

function fakeRes() {
  const r = { statusCode: null, corpo: null };
  r.setHeader = () => r;
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}

async function rodar({ headers = { authorization: 'Bearer segredo-cron' }, url = '/api/forms-qualificados' } = {}) {
  const res = fakeRes();
  await handler({ method: 'GET', headers, url }, res);
  return { res, eventos: chamadas.map(c => c.body.data[0]) };
}

const sha = v => crypto.createHash('sha256').update(v).digest('hex');

/* ── Asserções ───────────────────────────────────────────────────────── */

let falhas = 0;
function ok(cond, msg, extra) {
  if (cond) { console.log(`  ✓ ${msg}`); return; }
  falhas++;
  console.error(`  ✗ ${msg}${extra !== undefined ? ` — obtido: ${JSON.stringify(extra)}` : ''}`);
}

async function testes() {
  console.log('— lead qualificado recente —');
  {
    cenario([QUALIFICADO]);
    const { res, eventos } = await rodar();
    const ev = eventos[0];
    ok(eventos.length === 1, 'dispara um evento', eventos.length);
    ok(ev?.event_name === 'LeadQualificado', 'nome do evento', ev?.event_name);
    ok(ev?.user_data?.lead_id === '937639515796206',
       'lead_id vai sem o prefixo l:, em claro (é id do Meta, não dado pessoal)', ev?.user_data?.lead_id);
    ok(ev?.user_data?.em?.[0] === sha('cristina@exemplo.com'), 'e-mail hasheado', ev?.user_data?.em);
    ok(ev?.user_data?.ph?.[0] === sha('5551999998888'),
       'telefone hasheado, sem o prefixo p: do export', ev?.user_data?.ph);
    ok(ev?.action_source === 'system_generated', 'action_source system_generated', ev?.action_source);
    ok(ev?.event_id === 'forms:937639515796206', 'event_id determinístico a partir do lead', ev?.event_id);
    ok(ev?.custom_data?.utm_campaign === '[SE] [FORMS] [LEAD] [HOT]',
       'campanha real do export (não o macro {{campaign.name}})', ev?.custom_data?.utm_campaign);
    ok(res.corpo?.enviados === 1, 'resposta informa quantos foram enviados', res.corpo);
  }

  console.log('\n— nada de PII em claro —');
  {
    cenario([QUALIFICADO]);
    await rodar();
    const cru = JSON.stringify(chamadas[0].body);
    ok(!cru.toLowerCase().includes('cristina@exemplo'), 'e-mail nunca em claro');
    ok(!cru.includes('999998888'), 'telefone nunca em claro');
    ok(!cru.includes('Fulano'), 'nome nunca em claro');
  }

  console.log('\n— quem não é enviado —');
  {
    cenario([linhaMeta({ id: 'l:1', quando: iso(1 * DIA), colaboradores: 'De 0 a 4', email: 'a@b.com' })]);
    const { eventos } = await rodar();
    ok(eventos.length === 0, 'menos de 10 colaboradores não dispara', eventos.length);
  }
  {
    cenario([linhaMeta({ id: 'l:2', quando: iso(1 * DIA), colaboradores: '', email: 'a@b.com' })]);
    const { eventos } = await rodar();
    ok(eventos.length === 0, 'sem resposta de colaboradores não dispara', eventos.length);
  }
  {
    cenario([linhaMeta({
      id: 'l:3', quando: iso(1 * DIA),
      colaboradores: '<test lead: dummy data for Quantos colaboradores>', email: 'test@meta.com',
    })]);
    const { eventos } = await rodar();
    ok(eventos.length === 0, 'lead de teste do Meta não dispara', eventos.length);
  }
  {
    cenario([linhaMeta({ id: 'l:4', quando: iso(10 * DIA), colaboradores: 'Mais de 50', email: 'a@b.com' })]);
    const { res, eventos } = await rodar();
    ok(eventos.length === 0,
       'lead com mais de 7 dias não dispara — o CAPI rejeita evento antigo', eventos.length);
    ok(res.corpo?.fora_da_janela === 1, 'os antigos são contados na resposta, não somem calados', res.corpo);
  }

  console.log('\n— trava de reenvio —');
  {
    cenario([QUALIFICADO], { jaEnviados: ['forms:937639515796206'] });
    const { res, eventos } = await rodar();
    ok(eventos.length === 0, 'lead já registrado não é reenviado', eventos.length);
    ok(res.corpo?.ja_enviados === 1, 'resposta informa quantos já tinham ido', res.corpo);
  }
  {
    cenario([QUALIFICADO]);
    await rodar();
    ok(marcados.length === 1 && marcados[0].event_id === 'forms:937639515796206',
       'o que foi enviado fica registrado para não repetir amanhã', marcados);
  }

  console.log('\n— autenticação —');
  {
    cenario([QUALIFICADO]);
    const semSegredo = await rodar({ headers: {} });
    ok(semSegredo.res.statusCode === 401 && semSegredo.eventos.length === 0,
       'sem segredo → 401 e nenhum evento', semSegredo.res.statusCode);

    cenario([QUALIFICADO]);
    const naQuery = await rodar({ headers: {}, url: '/api/forms-qualificados?token=segredo-cron' });
    ok(naQuery.eventos.length === 1, 'segredo aceito na query para disparo manual', naQuery.eventos.length);
  }

  console.log('\n— vários leads de uma vez —');
  {
    cenario([
      QUALIFICADO,
      linhaMeta({ id: 'l:5', quando: iso(2 * DIA), colaboradores: 'De 10 a 19', email: 'c@d.com' }),
      linhaMeta({ id: 'l:6', quando: iso(2 * DIA), colaboradores: 'De 5 a 9',  email: 'e@f.com' }),
    ]);
    const { res, eventos } = await rodar();
    ok(eventos.length === 2, 'envia os dois qualificados e ignora o resto', eventos.length);
    ok(res.corpo?.analisados === 3, 'resposta conta todos os leads analisados', res.corpo);
    ok(new Set(eventos.map(e => e.event_id)).size === 2, 'cada lead tem event_id próprio',
       eventos.map(e => e.event_id));
  }
}

/* ── Validação com o export real (opcional) ──────────────────────────── */

/**
 * A extração acha e-mail, telefone e a pergunta de colaboradores pelo formato
 * do valor, não por índice de coluna — heurística que só se prova contra o
 * export de verdade. Aponte TEST_FORMS_ROWS para um JSON com as linhas da aba
 * de FORMS (array de arrays) para rodar esta parte.
 */
async function exportReal() {
  const fs   = require('fs');
  const path = process.env.TEST_FORMS_ROWS;
  if (!path || !fs.existsSync(path)) {
    console.log('\n— export real não informado (TEST_FORMS_ROWS) — validação pulada —');
    return;
  }
  console.log('\n— export real do formulário nativo —');

  const { extrairLeads } = handler;
  const { ehQualificado } = require('../lib/porte');
  const leads = extrairLeads(JSON.parse(fs.readFileSync(path, 'utf8')));

  const pct = n => Math.round((100 * n) / leads.length);
  ok(leads.length > 0, `extraiu ${leads.length} leads`, leads.length);
  ok(pct(leads.filter(l => l.colaboradores).length) >= 95,
     'acha a resposta de colaboradores em ≥95% dos leads', pct(leads.filter(l => l.colaboradores).length));
  ok(pct(leads.filter(l => l.email).length) >= 95,
     'acha o e-mail em ≥95% dos leads', pct(leads.filter(l => l.email).length));
  ok(leads.every(l => /^\d{10,20}$/.test(l.leadId)),
     'todo lead_id é numérico, sem o prefixo l:');
  ok(leads.every(l => !l.telefone.startsWith('p:')),
     'nenhum telefone carrega o prefixo p: do export');
  ok(new Set(leads.map(l => l.leadId)).size === leads.length,
     'nenhum lead extraído em duplicidade');
  ok(!leads.some(l => /test lead|test@meta\.com/i.test(JSON.stringify(l))),
     'nenhum lead de teste do Meta passou');

  const q = leads.filter(l => ehQualificado(l.colaboradores)).length;
  console.log(`    (${q} qualificados, ${pct(q)}% — bate com a leitura do dashboard)`);
}

testes()
  .then(exportReal)
  .catch(err => { falhas++; console.error('  ✗ exceção:', err.stack); })
  .then(() => {
    console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo verde');
    process.exit(falhas ? 1 : 0);
  });
