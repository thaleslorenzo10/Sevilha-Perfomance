'use strict';
/* Abas [SE], [CAFÉ] e [CP]: mesma composição, filtrada pelo grupo. */
(function (D) {
  const NOME = { SE: 'Sessão Estratégica', CAFE: 'Café com Sevilha', CP: 'Clube da Performance' };
  const FUNIL_RD = { SE: 'SE', CP: 'CP' }; // chave em rd.funis; o Café não tem funil próprio no CRM

  const markup = g => `
  <div class="banner banner-warn" id="aviso${g}"></div>
  <div class="kpi-groups"><div class="kpi-group">
    <div class="kpi-group-label">${NOME[g]} — período</div>
    <div class="kpi-card blue"><div class="kpi-label">Investido</div><div class="kpi-value" id="${g}-spend"></div></div>
    <div class="kpi-card green"><div class="kpi-label">Leads</div><div class="kpi-value" id="${g}-leads"></div><div class="kpi-sub" id="${g}-leads-sub"></div></div>
    <div class="kpi-card purple"><div class="kpi-label">MQL (10+)</div><div class="kpi-value" id="${g}-mql"></div><div class="kpi-sub" id="${g}-mql-sub"></div></div>
    <div class="kpi-card green"><div class="kpi-label">CPL</div><div class="kpi-value" id="${g}-cpl"></div></div>
    <div class="kpi-card purple"><div class="kpi-label">CPMQL</div><div class="kpi-value" id="${g}-cpmql"></div></div>
    <div class="kpi-card teal"><div class="kpi-label">Deals</div><div class="kpi-value" id="${g}-deals"></div><div class="kpi-sub" id="${g}-deals-sub"></div></div>
  </div></div>
  <div class="section"><div class="section-title">💸 Custo por MQL e por lead, por campanha</div><div class="chart-wrap" style="height:260px"><canvas id="chartCusto${g}"></canvas></div></div>
  <div class="section"><div class="section-title">🎯 Campanhas <div class="section-tools"><button class="btn-csv" type="button" data-csv="tblCamp${g}">Exportar CSV</button></div></div><div class="table-wrap"><table id="tblCamp${g}"></table></div></div>
  <div class="section"><div class="section-title">👥 Públicos (conjuntos de anúncios) <div class="section-tools"><button class="btn-csv" type="button" data-csv="tblConj${g}">Exportar CSV</button></div></div><div class="table-wrap"><table id="tblConj${g}"></table></div></div>
  <div class="section"><div class="section-title">🖼️ Anúncios <div class="section-tools"><button class="btn-csv" type="button" data-csv="tblAnun${g}">Exportar CSV</button></div></div><div class="table-wrap"><table id="tblAnun${g}"></table></div></div>
  <div class="section" id="secRd${g}"><div class="section-title">🗂️ RD CRM — etapas do funil</div><div class="table-wrap"><table><thead><tr><th>Etapa</th><th class="num">Deals</th></tr></thead><tbody id="tblEtapas${g}"></tbody></table></div><p class="nota-fonte" id="notaRd${g}"></p></div>`;

  function aviso(g, d) {
    const { meta, leads } = d;
    if (g === 'CP' && meta.grupos.CP.spend === 0) return '⏸️ Campanhas [CP] sem investimento no período (pausadas). O funil do CRM continua recebendo deals de outras origens.';
    if (g === 'CAFE') {
      const cafe = leads && leads.por_pagina.filter(p => String(p.pagina).startsWith('rd:'));
      if (!leads || !cafe.length) return '☕ Leads reais do Café dependem do webhook do RD Marketing (Integrações → Webhooks → Conversão). Sem ele, só o número que o Meta reporta aparece.';
      return `☕ Leads reais do Café chegam pelo webhook do RD Marketing (${cafe.map(p => D.esc(p.pagina.slice(3))).join(', ')}). Leads anteriores à ativação do webhook não entram.`;
    }
    return '';
  }

  function renderKpis(g, d, t) {
    const { meta, leads, rd } = d;
    const pg = leads ? leads.por_grupo[g] : null;
    D.setK(`${g}-spend`, D.fmtR(meta.grupos[g] ? meta.grupos[g].spend : 0));
    D.setK(`${g}-leads`, pg ? D.fmtN(pg.leads) : '—');
    document.getElementById(`${g}-leads-sub`).textContent = `Meta reporta ${D.fmtN(t.meta_reporta)}`;
    D.setK(`${g}-mql`, pg ? D.fmtN(pg.mql) : '—');
    document.getElementById(`${g}-mql-sub`).textContent = pg ? `${D.orDash(D.pct(pg.mql, pg.leads), D.fmtP)} dos leads` : '';
    D.setK(`${g}-cpl`, D.orDash(t.cpl, D.fmtR));
    D.setK(`${g}-cpmql`, D.orDash(t.cpmql, D.fmtR));
    D.setK(`${g}-deals`, rd ? D.fmtN(t.deals) : '—');
    document.getElementById(`${g}-deals-sub`).textContent = rd ? `Lead → deal ${D.orDash(t.lead_deal, D.fmtP)}` : 'RD indisponível';
  }

  function renderTabelas(g, d, rows) {
    const { meta, leads } = d;
    D.graficoCusto('chartCusto' + g, rows);
    D.tabela('tblCamp' + g, rows, [...D.COLUNAS_CRUZAMENTO, 'deals', 'lead_deal']);
    D.tabela('tblConj' + g, D.cruzar(leads ? leads.por_conjunto : [], meta.conjuntos || [], 'conjunto', { filtroGrupo: g }), D.COLUNAS_CRUZAMENTO);
    D.tabela('tblAnun' + g, D.cruzar(leads ? leads.por_anuncio : [], meta.anuncios || [], 'anuncio', { filtroGrupo: g }), D.COLUNAS_CRUZAMENTO);
  }

  function renderRd(g, rd) {
    const sec = document.getElementById('secRd' + g);
    const funil = rd && FUNIL_RD[g] ? rd.funis[FUNIL_RD[g]] : null;
    sec.hidden = !funil;
    if (!funil) return;
    document.getElementById('tblEtapas' + g).innerHTML = funil.etapas.map(e => `<tr><td>${D.esc(e.nome)}</td><td class="num">${D.fmtN(e.deals)}</td></tr>`).join('') || '<tr><td colspan="2" class="vazio">Sem deals</td></tr>';
    document.getElementById('notaRd' + g).textContent = `${D.fmtN(funil.total)} deals no funil "${funil.nome}" no período · ${D.fmtN(funil.ganhos)} ganhos · ${D.fmtN(funil.perdidos)} perdidos` + (rd.acumulado ? ' · ATENÇÃO: RD respondeu o acumulado, não o período' : '');
  }

  D.renderGrupo = function (g, d) {
    const el = document.getElementById('painel' + g);
    if (!el.dataset.pronto) { el.innerHTML = markup(g); el.dataset.pronto = '1'; }
    D.banner('aviso' + g, aviso(g, d));

    const rows = D.linhasCampanha(d, g);
    const t = D.totalizar(rows);
    renderKpis(g, d, t);
    renderTabelas(g, d, rows);
    renderRd(g, d.rd);
  };
})(window.SPD = window.SPD || {});
