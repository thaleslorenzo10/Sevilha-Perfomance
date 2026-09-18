#!/usr/bin/env node
'use strict';

/**
 * Reprocessa o RD CRM das compras da aula que ficaram com crm_status de erro
 * ou 'sem-deal' (ex.: as duas compras de 18/09/2026 que deram 'erro:deal 422').
 *
 *   node scripts/aula-reprocessar-crm.js            # lista o que faria
 *   node scripts/aula-reprocessar-crm.js --aplicar  # move os deals e grava o status
 *
 * Lê .env.local da raiz. Escreve no RD CRM e no Supabase só com --aplicar.
 */

const fs = require('fs'), path = require('path');
fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n').forEach(l => { const m = l.match(/^([A-Z_]+)=["']?([^"'\n]*)["']?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; });

const { avancarDeal } = require('../lib/kiwify');
const { conexao, rest } = require('../lib/supabase');

const aplicar = process.argv.includes('--aplicar');
const TABELA = 'sevilha_compras_aula';

(async () => {
  const c = conexao();
  if (!c) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY ausentes'); process.exit(1); }
  const r = await fetch(rest(TABELA, "status=eq.paid&or=(crm_status.like.erro*,crm_status.eq.sem-deal)&select=order_id,email,crm_status,pago_em&order=pago_em"), { headers: c.headers });
  if (!r.ok) { console.error('Supabase', r.status, await r.text()); process.exit(1); }
  const compras = await r.json();
  console.log(`${compras.length} compra(s) com CRM pendente${aplicar ? '' : ' — dry-run, use --aplicar para executar'}`);
  for (const compra of compras) {
    const mascara = compra.email.replace(/^(.{3}).*@/, '$1…@');
    if (!aplicar) { console.log(`  ${compra.order_id.slice(0, 8)}  ${mascara}  ${compra.crm_status}`); continue; }
    const status = await avancarDeal(compra.email);
    const p = await fetch(rest(TABELA, `order_id=eq.${encodeURIComponent(compra.order_id)}`), {
      method: 'PATCH', headers: { ...c.headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ crm_status: status, updated_at: new Date().toISOString() }),
    });
    console.log(`  ${compra.order_id.slice(0, 8)}  ${mascara}  ${compra.crm_status} → ${status}${p.ok ? '' : ` (Supabase ${p.status})`}`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
