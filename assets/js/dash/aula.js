'use strict';
/* global Chart */
/* Aba [AULA]: o que só a aula paga tem — compras, receita, ROAS e a métrica do
   cliente (sessões estratégicas por 100 compradores). Renderiza dentro de
   #painelAULA depois do markup padrão do grupo (grupo.js). */
(function (D) {
  const PAGINA = '/aula-gestao-operacional';
  const markup = `
  <div class="kpi-groups" id="aulaKpis"><div class="kpi-group">
    <div class="kpi-group-label">Aula paga — compras no período</div>
    <div class="kpi-card green"><div class="kpi-label">Compras</div><div class="kpi-value" id="AULA-compras"></div><div class="kpi-sub" id="AULA-compras-sub"></div></div>
    <div class="kpi-card blue"><div class="kpi-label">Receita</div><div class="kpi-value" id="AULA-receita"></div></div>
    <div class="kpi-card purple"><div class="kpi-label">Custo por compra</div><div class="kpi-value" id="AULA-cpc"></div></div>
    <div class="kpi-card teal"><div class="kpi-label">ROAS</div><div class="kpi-value" id="AULA-roas"></div></div>
    <div class="kpi-card green"><div class="kpi-label">Sessões por 100 compradores</div><div class="kpi-value" id="AULA-sessoes"></div><div class="kpi-sub" id="AULA-sessoes-sub"></div></div>
    <div class="kpi-card purple"><div class="kpi-label">Custo por sessão</div><div class="kpi-value" id="AULA-cps"></div><div class="kpi-sub" id="AULA-cps-sub"></div></div>
  </div></div>
  <div class="section"><div class="section-title">🎟️ Funil da aula</div><div id="funilAULA"></div></div>
  <div class="section"><div class="section-title">📈 Compras por dia</div><div class="chart-wrap" style="height:240px"><canvas id="chartAulaDia"></canvas></div></div>
  <div class="section"><div class="section-title">🎯 Compras por campanha</div><div class="table-wrap"><table id="tblComprasAULA"></table></div></div>`;

  let chart;
  function graficoAulaDia(dias, compras) {
    const el = document.getElementById('chartAulaDia');
    if (!el) return;
    if (typeof Chart === 'undefined') {
      const w = el.closest('.chart-wrap');
      if (w && !w.dataset.falhou) { w.dataset.falhou = '1'; w.innerHTML = '<p class="chart-falha">Biblioteca de gráficos indisponível. As tabelas seguem válidas.</p>'; }
      return;
    }
    if (chart) { chart.destroy(); chart = null; }
    const c = D.cores();
    chart = new Chart(el.getContext('2d'), {
      type: 'line',
      data: { labels: dias.map(D.diaCurto), datasets: [
        { label: 'Compras', data: compras, borderColor: c.s1, backgroundColor: 'transparent', borderWidth: 2, tension: .3 },
      ] },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: c.ink } } },
        scales: {
          x: { grid: { color: c.grid }, ticks: { color: c.ink } },
          y: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.ink } },
        } },
    });
  }

  function tabelaCompras(rows) {
    const table = document.getElementById('tblComprasAULA');
    if (!table) return;
    const th = '<tr><th>Campanha</th><th class="num">Compras</th><th class="num">Receita</th><th class="num">Custo/compra</th><th class="num">ROAS</th></tr>';
    const tr = r => `<tr><td>${D.esc(r.campanha)}</td><td class="num">${D.fmtN(r.compras)}</td><td class="num">${D.fmtR(r.receita)}</td>`
      + `<td class="num">${D.orDash(r.custo_compra, D.fmtR)}</td><td class="num">${r.roas === null ? '—' : r.roas.toFixed(2) + 'x'}</td></tr>`;
    const corpo = rows.length ? rows.map(tr).join('') : '<tr><td colspan="5" class="vazio">Sem compras no período</td></tr>';
    table.innerHTML = `<thead>${th}</thead><tbody>${corpo}</tbody>`;
  }

  function kpis(d, c, spend, pg) {
    const sessoesSE = d.rd && d.rd.funis && d.rd.funis.SE ? d.rd.funis.SE.total : null;
    D.setK('AULA-compras', D.fmtN(c.total));
    document.getElementById('AULA-compras-sub').textContent = pg ? `Lead → compra ${D.orDash(D.pct(c.total, pg.leads), D.fmtP)}` : '';
    D.setK('AULA-receita', D.fmtR(c.receita_centavos / 100));
    D.setK('AULA-cpc', c.total ? D.fmtR(spend / c.total) : '—');
    D.setK('AULA-roas', spend > 0 ? (c.receita_centavos / 100 / spend).toFixed(2) + 'x' : '—');
    // compradores_com_sessao ainda não é medido de verdade (ver task-6): 0 compras vira "aguardando", não "0".
    D.setK('AULA-sessoes', c.total ? D.fmtN(Math.round(100 * c.compradores_com_sessao / c.total)) : 'aguardando');
    document.getElementById('AULA-sessoes-sub').textContent = `${D.fmtN(c.compradores_com_sessao)} compradores com sessão`;
    D.setK('AULA-cps', c.compradores_com_sessao ? D.fmtR(spend / c.compradores_com_sessao) : '—');
    document.getElementById('AULA-cps-sub').textContent = sessoesSE !== null && d.meta.grupos.SE && sessoesSE > 0
      ? `via SE direto: ${D.fmtR(d.meta.grupos.SE.spend / sessoesSE)}` : 'via SE direto: sem base';
  }

  function linhasCompras(d, c) {
    return c.por_campanha.map(r => {
      const m = (d.meta.campanhas || []).find(x => x.nome === r.campanha);
      const gasto = m ? m.spend : 0;
      return {
        campanha: r.campanha, compras: r.compras, receita: r.receita_centavos / 100,
        custo_compra: r.compras ? gasto / r.compras : null,
        roas: gasto ? (r.receita_centavos / 100) / gasto : null,
      };
    });
  }

  D.renderAula = function (d) {
    const el = document.getElementById('painelAULA');
    if (!el) return;
    let box = document.getElementById('aulaExtra');
    if (!box) { box = document.createElement('div'); box.id = 'aulaExtra'; box.innerHTML = markup; el.appendChild(box); }
    const c = (d.leads && d.leads.compras) || { total: 0, receita_centavos: 0, por_dia: [], por_campanha: [], compradores_com_sessao: 0 };
    const spend = d.meta.grupos.AULA ? d.meta.grupos.AULA.spend : 0;
    const pg = d.leads ? d.leads.por_grupo.AULA : null;
    const pagina = d.stats && Array.isArray(d.stats.paginas) ? d.stats.paginas.find(p => p.pagina === PAGINA) : null;
    kpis(d, c, spend, pg);
    D.renderFunil('funilAULA', [
      { rotulo: 'Visitantes', valor: pagina ? pagina.visitantes : null },
      { rotulo: 'Leads', valor: pg ? pg.leads : null },
      { rotulo: 'Compras', valor: c.total },
      { rotulo: 'Sessão agendada', valor: c.compradores_com_sessao },
    ]);
    graficoAulaDia(c.por_dia.map(x => x.dia), c.por_dia.map(x => x.compras));
    tabelaCompras(linhasCompras(d, c));
  };
})(window.SPD = window.SPD || {});
