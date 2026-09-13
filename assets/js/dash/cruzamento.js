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
  D.cruzar = function (leadsRows, metaRows, campoLead, { rd = [], filtroGrupo = null } = {}) {
    const mapa = new Map();
    const linha = nome => { const k = D.nomeChave(nome); if (!mapa.has(k)) mapa.set(k, nova(nome)); return mapa.get(k); };
    for (const m of metaRows || []) {
      const l = linha(m.nome);
      l.spend += m.spend || 0; l.meta_reporta += m.leads || 0;
      l.grupo = l.grupo || m.grupo || null; l.campanha = l.campanha || m.campanha || null;
    }
    for (const r of leadsRows || []) {
      const l = linha(r[campoLead]);
      l.leads += r.leads || 0; l.mql += r.mql || 0;
      l.grupo = l.grupo || r.grupo || null; l.campanha = l.campanha || r.campanha || null;
    }
    for (const d of rd || []) { const k = D.nomeChave(d.campanha); if (mapa.has(k)) mapa.get(k).deals += d.deals || 0; }
    let rows = [...mapa.values()].map(derivar);
    if (filtroGrupo) rows = rows.filter(r => r.grupo === filtroGrupo);
    return rows.sort((a, b) => b.spend - a.spend || b.leads - a.leads);
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
