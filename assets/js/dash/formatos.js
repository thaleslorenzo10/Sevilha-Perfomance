'use strict';
/* Aba Formatos: formulário instantâneo (FORMS) × landing page (LP), dentro da captação. */
(function (D) {
  const MARKUP = `
  <div class="section">
    <div class="section-title">⚔️ FORMS × LP — leads reais e custo</div>
    <p class="nota-fonte">Campanhas [SE], [CAFÉ] e [CP]. FORMS = formulário dentro do Meta; LP = landing page (site, Respondi ou RD).</p>
    <div class="table-wrap"><table id="tblFormatos"></table></div>
  </div>
  <div class="two-col">
    <div class="section"><div class="section-title">👔 Cargo declarado</div><div class="table-wrap"><table><thead><tr><th>Cargo</th><th class="num">Leads</th><th class="num">%</th></tr></thead><tbody id="tblCargo"></tbody></table></div></div>
    <div class="section"><div class="section-title">🏢 Colaboradores declarados</div><div class="table-wrap"><table><thead><tr><th>Faixa</th><th class="num">Leads</th><th class="num">%</th></tr></thead><tbody id="tblColab"></tbody></table></div></div>
  </div>`;

  function distribuicao(tbodyId, mapa, total) {
    const tbody = document.getElementById(tbodyId);
    const itens = Object.entries(mapa || {}).sort((a, b) => b[1] - a[1]);
    const semResposta = total - itens.reduce((s, [, v]) => s + v, 0);
    if (semResposta > 0) itens.push(['Sem resposta', semResposta]);
    tbody.innerHTML = itens.length ? itens.map(([k, v]) => `<tr><td>${D.esc(k)}</td><td class="num">${D.fmtN(v)}</td><td class="num">${D.orDash(D.pct(v, total), D.fmtP)}</td></tr>`).join('')
      : '<tr><td colspan="3" class="vazio">Sem dados</td></tr>';
  }

  D.renderFormatos = function (d) {
    const el = document.getElementById('painelFormatos');
    if (!el.dataset.pronto) { el.innerHTML = MARKUP; el.dataset.pronto = '1'; }
    const { meta, leads } = d;
    // Por formato: gasto e "Meta reporta" vêm das campanhas de captação; leads e MQL, dos leads unificados.
    const metaRows = ['FORMS', 'LP'].map(f => ({
      nome: f,
      spend: meta.campanhas.filter(c => c.grupo !== 'OUTROS' && c.formato === f).reduce((s, c) => s + c.spend, 0),
      leads: meta.campanhas.filter(c => c.grupo !== 'OUTROS' && c.formato === f).reduce((s, c) => s + c.leads, 0),
    }));
    const leadRows = leads ? ['FORMS', 'LP'].map(f => ({ formato: f, leads: leads.por_formato[f].leads, mql: leads.por_formato[f].mql })) : [];
    D.tabela('tblFormatos', D.cruzar(leadRows, metaRows, 'formato'), D.COLUNAS_CRUZAMENTO);
    const total = leads ? leads.total.leads : 0;
    distribuicao('tblCargo', leads && leads.qualificacao.cargo, total);
    distribuicao('tblColab', leads && leads.qualificacao.colaboradores, total);
  };
})(window.SPD = window.SPD || {});
