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
 *   mes  do dia 1º até hoje (padrão — é o que vai para o grupo do WhatsApp)
 *   7d   últimos 7 dias
 *   30d  últimos 30 dias
 *
 * O padrão acompanha o que o n8n envia: quem abrir a URL sem parâmetro vê o
 * mesmo período que chegou no grupo, e não um recorte diferente.
 */
function periodoDe(p) {
  const hoje = hojeBR();
  if (p === '7d')  return { since: somarDias(hoje, -6),  until: hoje, rotulo: 'nos últimos 7 dias' };
  if (p === '30d') return { since: somarDias(hoje, -29), until: hoje, rotulo: 'nos últimos 30 dias' };
  return { since: hoje.slice(0, 7) + '-01', until: hoje, rotulo: 'no mês' };
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

  /**
   * Porte cruzado com formato. O custo por lead é o investimento DAQUELE
   * formato dividido pelos leads daquele porte — mesma regra do dashboard.
   * As duas faixas dividem o mesmo investimento, então os custos de 10+ e
   * de menos de 10 não se somam.
   */
  const spendPorFormato = { FORMS: meta.formatos.FORMS.spend, LP: meta.formatos.LP.spend };
  const cruzar = chave => {
    const ppf = temLeads ? leads.porte_por_formato : null;
    const nF = ppf?.FORMS?.[chave] ?? 0;
    const nL = ppf?.LP?.[chave] ?? 0;
    return {
      forms: { leads: nF, cpl: nF > 0 ? spendPorFormato.FORMS / nF : null },
      lp:    { leads: nL, cpl: nL > 0 ? spendPorFormato.LP / nL : null },
      total: { leads: nF + nL, cpl: (nF + nL) > 0 ? captacao / (nF + nL) : null },
    };
  };

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
      // Matriz porte × formato, com custo por lead de cada combinação.
      matriz: { maior: cruzar('MAIOR_10'), menor: cruzar('MENOR_10') },
      sem_resposta: leads.porte?.INDEFINIDO ?? 0,
    } : null,
    formatos: {
      FORMS: {
        spend: meta.formatos.FORMS.spend, leads: temLeads ? leads.por_formato.FORMS : null,
        ctr: meta.formatos.FORMS.ctr, cpm: meta.formatos.FORMS.cpm,
        cpl: temLeads && leads.por_formato.FORMS > 0 ? meta.formatos.FORMS.spend / leads.por_formato.FORMS : null,
      },
      LP: {
        spend: meta.formatos.LP.spend, leads: temLeads ? leads.por_formato.LP : null,
        ctr: meta.formatos.LP.ctr, cpm: meta.formatos.LP.cpm,
        cpl: temLeads && leads.por_formato.LP > 0 ? meta.formatos.LP.spend / leads.por_formato.LP : null,
      },
    },
    campanhas,
    anuncios: await melhoresAnuncios(since, until),
    gerado_em: new Date().toISOString(),
  };
}

/**
 * Melhores anúncios do período, com o link do post no Instagram.
 *
 * Ordena por leads (não por investimento): o que interessa é qual criativo
 * produziu, não qual consumiu mais verba. Anúncio sem lead fica de fora.
 * O link é opcional — nem todo anúncio tem post publicado no Instagram.
 */
async function melhoresAnuncios(since, until, quantos = 5) {
  const { fetchAdInsights, fetchAdInstagramLinks, extractLeads, classifyCampaign } = require('./meta');

  try {
    const rows = await fetchAdInsights(since, until);

    const anuncios = rows
      .map(r => {
        const spend = parseFloat(r.spend || 0);
        const qtd = extractLeads(r);
        return {
          id: r.ad_id,
          nome: r.ad_name,
          campanha: r.campaign_name,
          formato: classifyCampaign(r.campaign_name).formato,
          spend: Math.round(spend * 100) / 100,
          leads: qtd,
          cpl: qtd > 0 ? Math.round((spend / qtd) * 100) / 100 : null,
          ctr: parseFloat(r.ctr || 0) || null,
          link: null,
        };
      })
      .filter(a => a.leads > 0)
      .sort((a, b) => b.leads - a.leads)
      .slice(0, quantos);

    const links = await fetchAdInstagramLinks(anuncios.map(a => a.id));
    for (const a of anuncios) a.link = links.get(a.id) || null;

    return anuncios;
  } catch (e) {
    console.warn('[resumo] anúncios indisponíveis:', e.message);
    return [];
  }
}

/** Texto da mensagem (legenda da imagem no WhatsApp). */
function montarTexto(r) {
  const L = [];
  const cel = c => c.leads > 0 ? `${int(c.leads)} · ${brl(c.cpl)}/lead` : '—';

  L.push(`*Sevilha Performance*`);
  L.push(`Sessão Estratégica · ${r.periodo.legenda}`);
  L.push('');

  L.push(`💰 *Investimento*`);
  L.push(`   Total: ${brl(r.investido.total)}`);
  L.push(`   Captação: ${brl(r.investido.captacao)}`);
  if (r.investido.trafego > 0) L.push(`   Tráfego: ${brl(r.investido.trafego)}`);
  L.push('');

  if (r.leads) {
    L.push(`🎯 *Leads reais* (planilha)`);
    L.push(`   Total: ${int(r.leads.total)} · CPL ${brl(r.leads.cpl)}`);
    L.push(`   Formulário nativo: ${int(r.leads.forms)}${r.formatos.FORMS.cpl ? ` · ${brl(r.formatos.FORMS.cpl)}/lead` : ''}`);
    L.push(`   Landing page: ${int(r.leads.lp)}${r.formatos.LP.cpl ? ` · ${brl(r.formatos.LP.cpl)}/lead` : ''}`);
    L.push('');

    L.push(`🏢 *Porte × formato*`);
    L.push(`   _10 ou mais colaboradores_`);
    L.push(`      Formulário: ${cel(r.leads.matriz.maior.forms)}`);
    L.push(`      Landing page: ${cel(r.leads.matriz.maior.lp)}`);
    L.push(`      Total: ${cel(r.leads.matriz.maior.total)}`);
    L.push(`   _Menos de 10 colaboradores_`);
    L.push(`      Formulário: ${cel(r.leads.matriz.menor.forms)}`);
    L.push(`      Landing page: ${cel(r.leads.matriz.menor.lp)}`);
    L.push(`      Total: ${cel(r.leads.matriz.menor.total)}`);
    if (r.leads.sem_resposta > 0) {
      L.push(`   _${int(r.leads.sem_resposta)} leads sem resposta ficam fora do corte._`);
    }
  } else {
    L.push(`🎯 *Leads reais:* indisponível — a planilha não cobre este período`);
  }

  L.push('');
  L.push(`📈 *Entrega*`);
  L.push(`   CTR ${pct(r.entrega.ctr)} · CPM ${brl(r.entrega.cpm)}`);
  L.push(`   ${int(r.entrega.cliques)} cliques · ${int(r.entrega.impressoes)} impressões`);

  if (r.anuncios?.length) {
    L.push('');
    L.push('🏆 *Melhores anúncios* (por leads)');
    for (const a of r.anuncios) {
      const tag = a.formato === 'FORMS' ? 'FORM' : 'LP';
      L.push(`   • [${tag}] ${nomeCurto(a.nome)}`);
      L.push(`     ${int(a.leads)} leads · ${brl(a.cpl)}/lead · ${brl0(a.spend)}`);
      if (a.link) L.push(`     ${a.link}`);
    }
  }

  return L.join('\n');
}

module.exports = { montarResumo, montarTexto, periodoDe, brl, brl0, int, pct, dia, nomeCurto };
