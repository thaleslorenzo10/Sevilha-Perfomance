'use strict';

/**
 * Teste offline da contagem de leads em lib/meta.js
 * (node scripts/test-meta-leads.js). Nenhuma chamada de rede.
 *
 * O que motivou este teste
 * ------------------------
 * A coluna "Leads" do Meta (`actions:lead`) soma duas coisas: o formulário
 * instantâneo preenchido (`onsite_conversion.lead_grouped`) e o evento `Lead`
 * do pixel do site (`offsite_conversion.fb_pixel_lead`). Nas campanhas
 * [SE] [FORMS] o segundo não corresponde a formulário nenhum — é público que
 * viu o anúncio e converteu por outro caminho —, e a soma inflava o número em
 * 1,9× no acumulado de 21/12/2025 a 11/08/2026:
 *
 *     campanha                       lead    onsite   planilha
 *     Teste de Ads · HOT              907       569        563
 *     Melhores Ads · HOT              925       426        420
 *     Melhores Ads · COLD             504       227        222
 *     Teste de Públicos · COLD        251       241        241
 *     Fábrica de Criativos · COLD     308       101         97
 *     ─────────────────────────────────────────────────────────
 *     total                         2.944     1.586      1.564
 *
 * O `onsite` bate com a planilha (98,6%); o `lead` mostrava o custo por lead
 * pela metade — R$ 16,50 em vez de R$ 30,63. Numa campanha de formulário
 * instantâneo, lead é formulário preenchido.
 */

const {
  extractLeads, extractOnsiteLeads, extractPixelLeads, classifyCampaign,
} = require('../lib/meta');

let falhas = 0;
function ok(cond, titulo, detalhe) {
  console.log(`${cond ? '  ok  ' : ' FALHA'} ${titulo}${detalhe !== undefined ? ` — ${detalhe}` : ''}`);
  if (!cond) falhas++;
}
function eq(obtido, esperado, titulo) {
  ok(obtido === esperado, titulo, obtido === esperado ? undefined : `esperado ${esperado}, veio ${obtido}`);
}

/** Linha de insights com os action_types que o Meta devolve. */
function linha({ campanha, lead, onsite, pixel }) {
  const actions = [];
  if (lead   !== undefined) actions.push({ action_type: 'lead', value: String(lead) });
  if (onsite !== undefined) actions.push({ action_type: 'onsite_conversion.lead_grouped', value: String(onsite) });
  if (pixel  !== undefined) actions.push({ action_type: 'offsite_conversion.fb_pixel_lead', value: String(pixel) });
  return { campaign_name: campanha, actions };
}

/* ── campanhas de formulário instantâneo ──────────────────────────────── */

console.log('\n— [FORMS]: lead é formulário preenchido —');

// Números reais de "Melhores Ads · HOT" no período completo.
const forms = linha({
  campanha: '[SE] [FORMS] [LEAD] [HOT] [FASE01] - Melhores Ads',
  lead: 925, onsite: 426, pixel: 499,
});
eq(extractLeads(forms), 426, 'ignora o lead de pixel somado por cima');
eq(extractOnsiteLeads(forms), 426, 'onsite continua exposto para o dashboard');
eq(extractPixelLeads(forms), 499, 'e o pixel também, como diagnóstico');

// Campanha de FORMS sem nenhum formulário preenchido no período: o `lead`
// que sobra é só pixel, e contar isso como lead de formulário é o bug.
eq(extractLeads(linha({ campanha: '[SE] [FORMS] [LEAD] [COLD] - Banners', lead: 40, pixel: 40 })),
   0, 'sem formulário preenchido, o resultado é zero');

/* ── campanhas de landing page ────────────────────────────────────────── */

console.log('\n— [SE] sem [FORMS]: segue a métrica agregada —');

const lp = linha({ campanha: '[SE] [LEAD] [HOT] [FASE01]', lead: 52, pixel: 52 });
eq(extractLeads(lp), 52, 'landing page não muda de comportamento');

eq(extractLeads(linha({ campanha: '[CP] [CAPTAÇÃO] [COLD] [V1]', lead: 228, pixel: 228 })),
   228, 'Clube da Performance também não');

eq(extractLeads(linha({ campanha: '[DISTRIBUIÇÃO] [C1] [COLD]' })),
   0, 'campanha sem lead nenhum devolve zero');

/* ── fallback e bordas ────────────────────────────────────────────────── */

console.log('\n— bordas —');

// Sem a métrica agregada, o comportamento antigo (soma das partes) vale só
// fora de FORMS; dentro de FORMS a soma é justamente o que se quer evitar.
eq(extractLeads(linha({ campanha: '[SE] [LEAD] [COLD]', onsite: 3, pixel: 7 })),
   10, 'fora de FORMS, sem `lead`, soma as duas partes');
eq(extractLeads(linha({ campanha: '[SE] [FORMS] [LEAD] [COLD]', onsite: 3, pixel: 7 })),
   3, 'dentro de FORMS, sem `lead`, usa só o formulário');

// Linha sem campaign_name (nível de conta, ou chamada antiga): não dá para
// classificar, então mantém o agregado em vez de zerar em silêncio.
eq(extractLeads({ actions: [{ action_type: 'lead', value: '10' }] }),
   10, 'linha sem campaign_name mantém o agregado');

eq(extractLeads({}), 0, 'linha sem actions devolve zero');

// A classificação é por tag no nome, em qualquer caixa.
ok(classifyCampaign('[se] [forms] [lead] [hot]').formato === 'FORMS',
   'a tag [FORMS] é reconhecida em minúscula');

console.log(falhas ? `\n${falhas} falha(s)\n` : '\nTudo certo\n');
process.exit(falhas ? 1 : 0);
