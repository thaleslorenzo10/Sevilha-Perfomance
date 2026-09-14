'use strict';
/* Aba Origem: cruzamento por campanha, público, anúncio e posicionamento, com filtro de grupo e CSV. */
(function (D) {
  const MARKUP = `
  <div class="section">
    <div class="section-title">🔎 Origem dos leads — cruzamento UTM × gasto
      <div class="section-tools"><label for="filtroGrupo" class="nota-fonte" style="margin:0">Grupo</label>
        <select id="filtroGrupo" class="select-grupo"><option value="">Todos</option><option value="SE">Sessão Estratégica</option><option value="CAFE">Café com Sevilha</option><option value="CP">Clube</option></select></div>
    </div>
    <p class="nota-fonte">Lead real de qualquer fonte cruzado pelo nome: utm_campaign × campanha, utm_medium × conjunto, utm_content × anúncio, utm_source × posicionamento. "Sem etiqueta" = lead sem UTM; "Etiqueta quebrada" = macro gravada literal.</p>
    <div class="chart-wrap" style="height:280px"><canvas id="chartMetaVsReal"></canvas></div>
  </div>
  ${[['Campanhas', 'tblOrigCamp'], ['Públicos (conjuntos)', 'tblOrigConj'], ['Anúncios', 'tblOrigAnun'], ['Fonte / posicionamento', 'tblOrigFonte']]
    .map(([t, id]) => `<div class="section"><div class="section-title">${t} <div class="section-tools"><button class="btn-csv" type="button" data-csv="${id}">Exportar CSV</button></div></div><div class="table-wrap"><table id="${id}"></table></div></div>`).join('')}`;

  D.renderOrigem = function (d) {
    D._ultimoDado = d;
    const el = document.getElementById('painelOrigem');
    if (!el.dataset.pronto) {
      el.innerHTML = MARKUP; el.dataset.pronto = '1';
      document.getElementById('filtroGrupo').addEventListener('change', () => D.renderOrigem(D._ultimoDado));
    }
    const grupo = document.getElementById('filtroGrupo').value || null;
    const { meta, leads } = d;
    const L = k => (leads ? leads[k] : []);
    const grupoPorCampanha = D.mapaGrupoPorCampanha(d);
    const camp = D.linhasCampanha(d, grupo);
    D.graficoMetaVsReal('chartMetaVsReal', camp);
    D.tabela('tblOrigCamp', camp, [...D.COLUNAS_CRUZAMENTO, 'deals', 'lead_deal']);
    D.tabela('tblOrigConj', D.cruzar(L('por_conjunto'), meta.conjuntos || [], 'conjunto', { filtroGrupo: grupo, grupoPorCampanha }), ['nome', 'campanha', ...D.COLUNAS_CRUZAMENTO.slice(1)]);
    D.tabela('tblOrigAnun', D.cruzar(L('por_anuncio'), meta.anuncios || [], 'anuncio', { filtroGrupo: grupo, grupoPorCampanha }), ['nome', 'campanha', ...D.COLUNAS_CRUZAMENTO.slice(1)]);
    // Posicionamento não tem grupo no lado do gasto (breakdown por conta): sem filtro.
    D.tabela('tblOrigFonte', D.cruzar(L('por_fonte'), meta.posicionamentos || [], 'fonte'), D.COLUNAS_CRUZAMENTO);
  };
})(window.SPD = window.SPD || {});
