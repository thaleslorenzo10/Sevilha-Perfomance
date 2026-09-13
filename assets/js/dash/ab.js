'use strict';
/* Aba A/B: o antigo /relatorio — variantes das páginas de captura, do /api/stats. */
(function (D) {
  const ROTULO = { '/': 'Página 1 (principal)', '/pre-inscricao-2': 'Página 2', '/pre-inscricao-3': 'Página 3' };
  D.renderAb = function ({ stats }) {
    const el = document.getElementById('painelAb');
    if (!stats) { el.innerHTML = '<div class="section"><p class="nota-fonte">/api/stats indisponível.</p></div>'; return; }
    const vs = stats.variants || [];
    const melhor = Math.max(...vs.map(v => v.conversion_rate || 0));
    el.innerHTML = `
    <div class="section"><div class="section-title">🧪 Teste A/B — páginas de captura</div>
      <p class="nota-fonte">Totais: ${D.fmtN(stats.totals.visits)} visitas · ${D.fmtN(stats.totals.leads)} leads · conversão ${D.orDash(stats.totals.visits ? stats.totals.conversion_rate : null, D.fmtP)}. Só as três páginas do teste; /mentoria está na aba Sessão Estratégica.</p>
      <div class="kpi-group">${vs.map(v => `
        <div class="kpi-card ${v.conversion_rate === melhor && melhor > 0 ? 'green' : ''}"><div class="kpi-label">${D.esc(ROTULO[v.pagina] || v.pagina)}</div>
          <div class="kpi-value">${D.orDash(v.visits ? v.conversion_rate : null, D.fmtP)}</div>
          <div class="kpi-sub">${D.fmtN(v.visits)} visitas · ${D.fmtN(v.leads)} leads${v.conversion_rate === melhor && melhor > 0 ? ' · melhor' : ''}</div></div>`).join('')}</div>
    </div>`;
  };
})(window.SPD = window.SPD || {});
