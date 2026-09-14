'use strict';
/* Junção lead real × gasto do Meta × deals do RD por nome normalizado. Puro, sem DOM. */
(function (D) {
  const nova = nome => ({ nome, grupo: null, campanha: null, spend: 0, leads: 0, mql: 0, meta_reporta: 0, deals: 0 });
  const derivar = l => ({
    ...l,
    mql_pct: D.pct(l.mql, l.leads),
    cpl: D.razao(l.spend, l.leads),
    cpmql: D.razao(l.spend, l.mql),
    lead_deal: D.pct(l.deals, l.leads),
  });

  /**
   * leadsRows: itens de por_campanha/por_conjunto/por_anuncio/por_fonte (campo em `campoLead`).
   * metaRows: itens de meta.campanhas/conjuntos/anuncios/posicionamentos (campo `nome`).
   * rd: itens de rd.por_campanha (só faz sentido quando a dimensão é campanha).
   */
  const absorverMeta = (linha, m) => {
    const l = linha(m.nome);
    l.spend += m.spend || 0; l.meta_reporta += m.leads || 0;
    l.grupo = l.grupo || m.grupo || null; l.campanha = l.campanha || m.campanha || null;
  };
  const absorverLead = (linha, r, campoLead) => {
    const l = linha(r[campoLead]);
    l.leads += r.leads || 0; l.mql += r.mql || 0;
    l.grupo = l.grupo || r.grupo || null; l.campanha = l.campanha || r.campanha || null;
  };
  const opcoesDe = o => ({ rd: (o && o.rd) || [], filtroGrupo: (o && o.filtroGrupo) || null, grupoPorCampanha: (o && o.grupoPorCampanha) || null });

  // Preenche o grupo pela campanha quando a linha (conjunto/anúncio) não trouxe
  // grupo próprio — acontece quando o meta não tem uma linha com aquele nome
  // (ex.: público sem gasto no período) mas o lead real sabe de qual campanha veio.
  const comGrupoDaCampanha = (rows, grupoPorCampanha) => rows.map(r => (r.grupo == null && r.campanha)
    ? { ...r, grupo: grupoPorCampanha.get(D.nomeChave(r.campanha)) ?? null }
    : r);

  D.cruzar = function (leadsRows, metaRows, campoLead, opcoes) {
    const { rd, filtroGrupo, grupoPorCampanha } = opcoesDe(opcoes);
    const mapa = new Map();
    const linha = nome => { const k = D.nomeChave(nome); if (!mapa.has(k)) mapa.set(k, nova(nome)); return mapa.get(k); };
    for (const m of metaRows || []) absorverMeta(linha, m);
    for (const r of leadsRows || []) absorverLead(linha, r, campoLead);
    for (const d of rd || []) { const k = D.nomeChave(d.campanha); if (mapa.has(k)) mapa.get(k).deals += d.deals || 0; }
    let rows = [...mapa.values()].map(derivar);
    if (grupoPorCampanha) rows = comGrupoDaCampanha(rows, grupoPorCampanha);
    if (filtroGrupo) rows = rows.filter(r => r.grupo === filtroGrupo);
    return rows.sort((a, b) => b.spend - a.spend || b.leads - a.leads);
  };

  /** Mapa nomeChave(campanha) → grupo, para D.cruzar preencher o grupo de conjuntos/anúncios sem linha própria no Meta. */
  D.mapaGrupoPorCampanha = function (d) {
    const mapa = new Map();
    for (const c of (d.meta && d.meta.campanhas) || []) mapa.set(D.nomeChave(c.nome), c.grupo);
    if (d.leads) for (const c of d.leads.por_campanha || []) mapa.set(D.nomeChave(c.campanha), c.grupo);
    return mapa;
  };

  D.totalizar = rows => derivar(rows.reduce((t, r) => {
    t.spend += r.spend; t.leads += r.leads; t.mql += r.mql; t.meta_reporta += r.meta_reporta; t.deals += r.deals; return t;
  }, nova('Total')));

  /** Números da faixa executiva. Deals: só os que têm campanha (o funil do CRM tem deals de outras origens). */
  D.resumo = function ({ meta, leads, rd }) {
    const spend = meta ? meta.conta.spend : null;
    const L = leads ? leads.total.leads : null;
    const M = leads ? leads.total.mql : null;
    const deals = rd ? (rd.por_campanha || []).filter(c => c.campanha !== 'Sem campanha').reduce((s, c) => s + c.deals, 0) : null;
    return {
      spend, leads: L, mql: M,
      mql_pct: L === null ? null : D.pct(M, L),
      cpl: spend === null || L === null ? null : D.razao(spend, L),
      cpmql: spend === null || M === null ? null : D.razao(spend, M),
      deals,
    };
  };
})(window.SPD = window.SPD || {});
