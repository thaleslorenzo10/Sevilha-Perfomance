'use strict';

/**
 * Resumo do período para enviar no WhatsApp.
 *
 * Reaproveita as mesmas funções que alimentam o dashboard (montarMeta e
 * montarLeads) — se o resumo calculasse por conta própria, os dois números
 * divergiriam com o tempo e ninguém saberia qual acreditar.
 */

const { montarMeta }  = require('../api/meta');
const { montarLeads } = require('../api/sheet-leads');

const TZ = 'America/Sao_Paulo';

/** Data de hoje no fuso de Brasília — a função roda em UTC no servidor. */
function hojeBR() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date());
}

function somarDias(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Períodos aceitos em ?p= :
 *   7d   últimos 7 dias (padrão — casa com a cadência segunda/sexta)
 *   30d  últimos 30 dias
 *   mes  do dia 1º até hoje
 */
function periodoDe(p) {
  const hoje = hojeBR();
  if (p === 'mes') return { since: hoje.slice(0, 7) + '-01', until: hoje, rotulo: 'no mês' };
  if (p === '30d') return { since: somarDias(hoje, -29), until: hoje, rotulo: 'nos últimos 30 dias' };
  return { since: somarDias(hoje, -6), until: hoje, rotulo: 'nos últimos 7 dias' };
}

/* ── Formatação ──────────────────────────────────────────────────────── */

const brl  = n => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = n => 'R$ ' + Math.round(Number(n) || 0).toLocaleString('pt-BR');
const int  = n => Math.round(Number(n) || 0).toLocaleString('pt-BR');
const pct  = n => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
const dia  = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Nome curto da campanha: as tags já viram coluna à parte. */
function nomeCurto(nome) {
  return String(nome || '')
    .replace(/\[(CP|SE|FORMS|LEAD|FASE\d+)\]\s*/g, '')
    // Sobra um travessão solto quando as tags do meio saem:
    // "[SE] [FORMS] [LEAD] [HOT] [FASE01] - Melhores Ads" -> "[HOT] Melhores Ads"
    .replace(/\]\s*[-–]\s*/, '] ')
    .replace(/^[\s\-–]+/, '')
    .trim() || nome;
}

/* ── Montagem ────────────────────────────────────────────────────────── */

async function montarResumo(p) {
  const { since, until, rotulo } = periodoDe(p);

  // A planilha pode falhar sem derrubar o resumo: o investimento e a entrega
  // do Meta continuam válidos e valem a mensagem.
  const [meta, leads] = await Promise.all([
    montarMeta(since, until),
    montarLeads(since, until).catch(e => {
      console.warn('[resumo] planilha indisponível:', e.message);
      return null;
    }),
  ]);

  const captacao = meta.grupos.SE.spend + meta.grupos.CP.spend;
  const trafego  = meta.grupos.OUTROS.spend;

  // Só usa a planilha se ela cobre o período; senão o CPL real sairia absurdo.
  const cobre = c => !!(c && c.ultimo && c.ultimo >= since && c.primeiro <= until);
  const temLeads = !!leads && (cobre(leads.cobertura?.FORMS) || cobre(leads.cobertura?.LP));

  const totalReal = temLeads ? leads.total : null;
  const cplReal   = totalReal > 0 ? captacao / totalReal : null;

  const porte  = temLeads ? leads.porte : null;
  const maior  = porte?.MAIOR_10 ?? 0;
  const menor  = porte?.MENOR_10 ?? 0;

  const campanhas = meta.campanhas
    .filter(c => c.grupo !== 'OUTROS' && c.spend > 0)
    .slice(0, 6);

  return {
    periodo: { since, until, rotulo, legenda: `${dia(since)} a ${dia(until)}` },
    investido: { total: meta.conta.spend, captacao, trafego },
    entrega:   { ctr: meta.conta.ctr, cpm: meta.conta.cpm, cliques: meta.conta.clicks, impressoes: meta.conta.impressions },
    leads: temLeads ? {
      total: totalReal,
      cpl: cplReal,
      forms: leads.por_formato.FORMS,
      lp: leads.por_formato.LP,
      porte: {
        maior, menor,
        cpl_maior: maior > 0 ? captacao / maior : null,
        cpl_menor: menor > 0 ? captacao / menor : null,
      },
    } : null,
    formatos: {
      FORMS: { spend: meta.formatos.FORMS.spend, leads: temLeads ? leads.por_formato.FORMS : null },
      LP:    { spend: meta.formatos.LP.spend,    leads: temLeads ? leads.por_formato.LP    : null },
    },
    campanhas,
    gerado_em: new Date().toISOString(),
  };
}

/** Texto da mensagem (legenda da imagem no WhatsApp). */
function montarTexto(r) {
  const L = [];
  L.push(`*Sevilha Performance* — ${r.periodo.legenda}`);
  L.push('');
  L.push(`💰 *Investido:* ${brl(r.investido.total)}`);
  L.push(`   captação ${brl(r.investido.captacao)}${r.investido.trafego > 0 ? ` · tráfego ${brl(r.investido.trafego)}` : ''}`);
  L.push('');

  if (r.leads) {
    L.push(`🎯 *Leads reais:* ${int(r.leads.total)} · CPL ${brl(r.leads.cpl)}`);
    L.push(`   formulário ${int(r.leads.forms)} · landing page ${int(r.leads.lp)}`);
    L.push('');
    L.push(`🏢 *Porte do escritório*`);
    L.push(`   10+ colaboradores: ${int(r.leads.porte.maior)}${r.leads.porte.cpl_maior ? ` · ${brl(r.leads.porte.cpl_maior)}/lead` : ''}`);
    L.push(`   menos de 10: ${int(r.leads.porte.menor)}${r.leads.porte.cpl_menor ? ` · ${brl(r.leads.porte.cpl_menor)}/lead` : ''}`);
  } else {
    L.push(`🎯 *Leads reais:* indisponível — a planilha não cobre este período`);
  }

  L.push('');
  L.push(`📈 CTR ${pct(r.entrega.ctr)} · CPM ${brl(r.entrega.cpm)} · ${int(r.entrega.cliques)} cliques`);

  if (r.campanhas.length) {
    L.push('');
    L.push('📋 *Campanhas*');
    for (const c of r.campanhas) {
      const tag = c.formato === 'FORMS' ? 'FORM' : 'LP';
      L.push(`   • [${tag}] ${nomeCurto(c.nome)} — ${brl0(c.spend)}`);
    }
  }

  return L.join('\n');
}

module.exports = { montarResumo, montarTexto, periodoDe, brl, brl0, int, pct, dia, nomeCurto };
