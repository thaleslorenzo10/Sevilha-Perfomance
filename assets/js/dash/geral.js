'use strict';
/* Aba Visão geral. */
(function (D) {
  const PAGINAS_SE = ['/mentoria', '/mentoria-2'];

  /** Linhas cruzadas por campanha (opcionalmente só de um grupo). Usada por várias abas. */
  D.linhasCampanha = (d, grupo = null) => D.cruzar(
    d.leads ? d.leads.por_campanha : [],
    d.meta.campanhas.map(c => ({ nome: c.nome, spend: c.spend, leads: c.leads, grupo: c.grupo })),
    'campanha', { rd: d.rd ? d.rd.por_campanha : [], filtroGrupo: grupo });

  D.renderGeral = function (d) {
    const { meta, leads, stats, rd } = d;
    const capt = ['SE', 'CAFE', 'CP'].reduce((s, g) => s + (meta.grupos[g] ? meta.grupos[g].spend : 0), 0);
    D.setK('g-spend', D.fmtR(meta.conta.spend));
    D.setK('g-spend-capt', D.fmtR(capt));
    D.setK('g-ctr', D.orDash(meta.conta.ctr, D.fmtP));
    D.setK('g-cpm', D.orDash(meta.conta.cpm, D.fmtR));

    const dias = meta.serie.map(s => s.data);
    const porDia = new Map((leads ? leads.por_dia : []).map(x => [x.dia, x]));
    D.graficoLeadsDia('chartLeadsDia', dias, {
      mql: dias.map(x => (porDia.get(x) || { mql: 0 }).mql),
      outros: dias.map(x => { const r = porDia.get(x); return r ? r.leads - r.mql : 0; }),
      spend: meta.serie.map(s => s.spend),
    });

    const rows = D.linhasCampanha(d);
    D.graficoCusto('chartCustoCampanha', rows);
    D.tabela('tblCampanhas', rows, ['nome', 'grupo', 'spend', 'leads', 'mql', 'mql_pct', 'cpl', 'cpmql', 'meta_reporta', 'deals', 'lead_deal']);

    const visitantesSE = stats ? stats.paginas.filter(p => PAGINAS_SE.includes(p.pagina)).reduce((s, p) => s + (p.visitantes || 0), 0) : null;
    for (const g of ['SE', 'CAFE', 'CP']) {
      const pg = leads ? leads.por_grupo[g] : { leads: null, mql: null };
      const deals = rd ? D.linhasCampanha(d, g).reduce((s, r) => s + r.deals, 0) : null;
      D.renderFunil('funil' + g, [
        { rotulo: 'Visitantes', valor: g === 'SE' ? visitantesSE : null },
        { rotulo: 'Leads', valor: pg.leads }, { rotulo: 'MQL (10+)', valor: pg.mql }, { rotulo: 'Deals', valor: deals },
      ]);
    }
    D.renderPaginas(stats, leads);
  };

  D.renderPaginas = function (stats, leads) {
    const tbody = document.getElementById('tblPaginas');
    if (!tbody) return;
    const mqlPor = new Map((leads ? leads.por_pagina : []).map(p => [p.pagina, p]));
    const rows = (stats ? stats.paginas : []).filter(p => p.visitantes || p.leads);
    tbody.innerHTML = rows.length ? rows.map(p => {
      const u = mqlPor.get(p.pagina) || { mql: null };
      return `<tr><td>${D.esc(p.pagina)}</td><td class="num">${D.fmtN(p.visitantes)}</td><td class="num">${D.fmtN(p.leads)}</td>`
        + `<td class="num">${D.orDash(u.mql, D.fmtN)}</td><td class="num">${D.orDash(u.mql === null ? null : D.pct(u.mql, p.leads), D.fmtP)}</td>`
        + `<td class="num">${D.orDash(p.conversao_visitantes, D.fmtP)}</td></tr>`;
    }).join('') : '<tr><td colspan="6" class="vazio">Sem visita medida no período</td></tr>';
  };
})(window.SPD = window.SPD || {});
