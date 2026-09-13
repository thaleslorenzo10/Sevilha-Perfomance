#!/usr/bin/env node
'use strict';

/**
 * Confere se os números do painel batem entre si e entre as fontes.
 *
 *   node scripts/conferir-dados.js --since 2026-09-01 --until 2026-09-13
 *   node scripts/conferir-dados.js --base http://localhost:3000   (vercel dev)
 *
 * Imprime, por dia e por campanha, o que o Meta reporta (onsite e pixel), o
 * lead real, o MQL e a divergência; depois checa invariantes que, quebradas,
 * significam bug e não "dado ruim". Sai com código 1 nesse caso.
 */

const { norm } = require('../lib/texto');
const args = process.argv.slice(2);
const arg = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : padrao; };
const BASE  = arg('base', 'https://sevilha-perfomance.vercel.app');
const hoje  = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const UNTIL = arg('until', hoje);
const SINCE = arg('since', new Date(new Date(`${UNTIL}T00:00:00Z`) - 13 * 864e5).toISOString().slice(0, 10));

const chave = s => norm(s).replace(/\s+/g, ' ');
const num = (v, casas = 0) => (v === null || v === undefined) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const pad = (v, n) => String(v).padStart(n);
const linha = cols => console.log(cols.map(([v, n]) => pad(v, n)).join('  '));

async function get(p) {
  const r = await fetch(`${BASE}${p}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p} → HTTP ${r.status} ${j.error || ''}`);
  return j;
}

const falhas = [];
const invariante = (cond, msg) => { console.log(`${cond ? '  ok  ' : ' FALHA'} ${msg}`); if (!cond) falhas.push(msg); };

(async () => {
  const qs = `since=${SINCE}&until=${UNTIL}`;
  console.log(`\nConferência ${SINCE} → ${UNTIL} em ${BASE}\n`);
  const [meta, leads, stats, rd] = await Promise.all([
    get(`/api/meta?${qs}`), get(`/api/leads-unificados?${qs}`), get(`/api/stats?${qs}`),
    get(`/api/rd-stats?from=${SINCE}&to=${UNTIL}`),
  ]);

  console.log('— por dia —');
  linha([['dia', 10], ['gasto', 10], ['meta', 6], ['onsite', 6], ['pixel', 6], ['real', 6], ['mql', 5], ['diverg.', 8]]);
  const realPorDia = new Map(leads.por_dia.map(d => [d.dia, d]));
  let onsite = 0, pixel = 0;
  for (const d of meta.serie) {
    const r = realPorDia.get(d.data) || { leads: 0, mql: 0 };
    linha([[d.data, 10], [num(d.spend, 2), 10], [num(d.leads), 6], ['', 6], ['', 6], [num(r.leads), 6], [num(r.mql), 5], [num(d.leads - r.leads), 8]]);
  }
  for (const c of meta.campanhas) { onsite += c.leads_onsite; pixel += c.leads_pixel; }
  console.log(`\nconta: gasto ${num(meta.conta.spend, 2)} · Meta reporta ${num(meta.conta.leads)} (onsite ${num(onsite)}, pixel ${num(pixel)}) · real ${num(leads.total.leads)} · MQL ${num(leads.total.mql)}\n`);

  console.log('— por campanha —');
  linha([['campanha', 52], ['gasto', 10], ['meta', 6], ['real', 6], ['mql', 5], ['cpl', 8], ['cpmql', 8], ['deals', 6]]);
  const realPorCamp = new Map(leads.por_campanha.map(c => [chave(c.campanha), c]));
  const dealsPorCamp = new Map((rd.por_campanha || []).map(c => [chave(c.campanha), c.deals]));
  const vistas = new Set();
  for (const c of meta.campanhas) {
    const k = chave(c.nome); vistas.add(k);
    const r = realPorCamp.get(k) || { leads: 0, mql: 0 };
    linha([[c.nome.slice(0, 52), 52], [num(c.spend, 2), 10], [num(c.leads), 6], [num(r.leads), 6], [num(r.mql), 5],
      [r.leads ? num(c.spend / r.leads, 2) : '—', 8], [r.mql ? num(c.spend / r.mql, 2) : '—', 8], [num(dealsPorCamp.get(k) || 0), 6]]);
  }
  for (const c of leads.por_campanha) {
    const k = chave(c.campanha);
    if (vistas.has(k)) continue;
    vistas.add(k);
    linha([[`(sem gasto no Meta) ${c.campanha}`.slice(0, 52), 52], ['—', 10], ['—', 6], [num(c.leads), 6], [num(c.mql), 5], ['—', 8], ['—', 8], [num(dealsPorCamp.get(k) || 0), 6]]);
  }
  for (const c of rd.por_campanha || []) {
    const k = chave(c.campanha);
    if (vistas.has(k)) continue;
    linha([[`(só no RD) ${c.campanha}`.slice(0, 52), 52], ['—', 10], ['—', 6], ['—', 6], ['—', 5], ['—', 8], ['—', 8], [num(c.deals), 6]]);
  }

  console.log('\n— fontes —');
  for (const f of leads.fontes) console.log(`  ${f.nome.padEnd(9)} ${f.modo || '-'}  período=${f.total_no_periodo}  último=${f.ultimo_lead || '—'}  sem lead há ${f.dias_sem_lead ?? '—'} dias${f.erro ? `  ERRO: ${f.erro}` : ''}`);

  console.log('\n— invariantes —');
  const soma = (xs, k) => xs.reduce((s, x) => s + (x[k] || 0), 0);
  invariante(soma(leads.por_dia, 'leads') === leads.total.leads, 'soma de por_dia = total (leads)');
  invariante(soma(leads.por_dia, 'mql') === leads.total.mql, 'soma de por_dia = total (mql)');
  invariante(soma(Object.values(leads.por_grupo), 'leads') === leads.total.leads, 'soma de por_grupo = total');
  invariante(soma(leads.por_campanha, 'leads') === leads.total.leads, 'soma de por_campanha = total');
  invariante(Math.abs(soma(meta.campanhas, 'spend') - meta.conta.spend) <= 0.01 * meta.campanhas.length + 0.05, 'soma das campanhas do Meta ≈ conta (tolerância de 1 centavo por campanha)');
  invariante(leads.por_dia.every(d => d.dia >= SINCE && d.dia <= UNTIL), 'nenhum dia fora do período');
  invariante(meta.serie.length === leads.por_dia.length, 'Meta e leads têm o mesmo número de dias');
  invariante(leads.fontes.every(f => !f.erro), 'nenhuma fonte com erro');
  invariante(rd.acumulado === false, 'RD respondeu o período, não o acumulado');
  invariante(Array.isArray(stats.paginas), 'stats devolveu páginas');

  console.log(falhas.length ? `\n${falhas.length} invariante(s) quebrada(s)` : '\ntudo consistente');
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
