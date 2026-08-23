#!/usr/bin/env node
'use strict';

/**
 * Diz onde um deal foi parar no RD Station CRM — e quais funis existem.
 *
 * Existe porque "o deal não aparece" tem duas causas possíveis e o log da API
 * não separa as duas: ou o deal não foi criado, ou foi criado num funil/etapa
 * que não é o que está aberto na tela. A API responde as duas.
 *
 *   RD_CRM_TOKEN=xxx node scripts/verificar-deal-crm.js               # funis + últimos deals
 *   RD_CRM_TOKEN=xxx node scripts/verificar-deal-crm.js <id-do-deal>  # um deal específico
 *
 * O token sai do painel do RD (Configurações → Integrações → API) ou da
 * variável RD_CRM_TOKEN na Vercel. Ele não é gravado em lugar nenhum aqui.
 */

const BASE = 'https://crm.rdstation.com/api/v1';
const TOKEN = process.env.RD_CRM_TOKEN;

if (!TOKEN) {
  console.error('Defina RD_CRM_TOKEN. Ex.: RD_CRM_TOKEN=xxx node scripts/verificar-deal-crm.js');
  process.exit(1);
}

async function api(caminho) {
  const sep = caminho.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${caminho}${sep}token=${TOKEN}`);
  if (!res.ok) throw new Error(`${caminho} → HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function descreverDeal(d) {
  const etapa = d.deal_stage?.name || d.deal_stage_id || '?';
  const funil = d.deal_stage?.deal_pipeline?.name || d.deal_pipeline?.name || '?';
  const dono  = d.user?.name || d.user?.nickname || d.user_id || '?';
  const email = (d.contacts || []).flatMap(c => (c.emails || []).map(e => e.email)).join(', ') || '—';
  return [
    `  nome:         ${d.name}`,
    `  id:           ${d._id || d.id}`,
    `  funil:        ${funil}`,
    `  etapa:        ${etapa}`,
    `  responsável:  ${dono}`,
    `  contato:      ${email}`,
    `  criado em:    ${d.created_at || '?'}`,
  ].join('\n');
}

(async () => {
  const alvo = process.argv[2];

  if (alvo) {
    console.log(`\nDeal ${alvo}:\n`);
    console.log(descreverDeal(await api(`/deals/${alvo}`)));
    return;
  }

  // 1. Quais funis existem — a pergunta que sempre volta.
  const funis = await api('/deal_pipelines');
  const lista = funis.deal_pipelines || funis || [];
  console.log('\nFunis no RD CRM:\n');
  for (const f of lista) {
    console.log(`  ${f.name}  (${f._id || f.id})`);
    const etapas = await api(`/deal_stages?deal_pipeline_id=${f._id || f.id}`);
    for (const e of (etapas.deal_stages || [])) {
      console.log(`      ↳ ${e.name}  (${e._id || e.id})`);
    }
  }

  // 2. Os deals mais recentes, para achar o que sumiu.
  const recentes = await api('/deals?limit=10&page=1');
  console.log('\n10 deals mais recentes:\n');
  for (const d of (recentes.deals || [])) {
    console.log(descreverDeal(d));
    console.log('');
  }

  console.log('Deal com "[SE]" no nome é lead da Sessão Estratégica (/mentoria).');
})().catch(e => {
  console.error('\nFalhou:', e.message);
  process.exit(1);
});
