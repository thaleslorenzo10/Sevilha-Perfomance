'use strict';
/* global Chart */
/* Chart.js 4 (CDN) e funil em HTML. Cores só de tokens do lm-ds.css. */
(function (D) {
  const charts = {};
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  D.cores = () => ({
    s1: cssVar('--chart-series-1'), s2: cssVar('--chart-series-2'), s3: cssVar('--chart-series-3'), s4: cssVar('--chart-series-4'),
    grid: cssVar('--chart-grid'), ink: cssVar('--text-muted'), texto: cssVar('--text-display'), card: cssVar('--surface-card'),
  });
  function destruir(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
  D.redimensionarGraficos = () => Object.values(charts).forEach(c => { try { c.resize(); } catch { /* canvas oculto */ } });
  function indisponivel(el) {
    const w = el.closest('.chart-wrap');
    if (w && !w.dataset.falhou) { w.dataset.falhou = '1'; w.innerHTML = '<p class="chart-falha">Biblioteca de gráficos indisponível. As tabelas seguem válidas.</p>'; }
  }
  function base(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (typeof Chart === 'undefined') { indisponivel(el); return null; }
    destruir(id);
    return el;
  }
  const legenda = c => ({ labels: { color: c.ink, font: { size: 12, weight: '600' }, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded' } });
  const tooltip = c => ({ backgroundColor: c.card, titleColor: c.texto, bodyColor: c.texto, borderColor: c.grid, borderWidth: 1, padding: 10, cornerRadius: 8, usePointStyle: true });
  const eixoX = c => ({ grid: { color: c.grid, drawTicks: false }, border: { display: false }, ticks: { color: c.ink, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 16 } });
  const eixoY = (c, extra = {}) => ({ beginAtZero: true, grid: { color: c.grid, drawTicks: false }, border: { display: false }, ticks: { color: c.ink, font: { size: 11 } }, ...extra });
  const corta = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

  /** Leads por dia: MQL empilhado sobre o restante; gasto em linha no eixo direito. */
  D.graficoLeadsDia = function (id, dias, { mql, outros, spend }) {
    const el = base(id); if (!el) return;
    const c = D.cores();
    charts[id] = new Chart(el.getContext('2d'), {
      data: { labels: dias.map(D.diaCurto), datasets: [
        { type: 'bar', label: 'MQL (10+)', data: mql, backgroundColor: c.s1, stack: 'leads', borderRadius: 3 },
        { type: 'bar', label: 'Demais leads', data: outros, backgroundColor: c.s3, stack: 'leads', borderRadius: 3 },
        { type: 'line', label: 'Investido', data: spend, yAxisID: 'y1', borderColor: c.s2, backgroundColor: 'transparent', borderWidth: 2, tension: .3, pointRadius: 0 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: legenda(c), tooltip: { ...tooltip(c), callbacks: { label: t => ` ${t.dataset.label}: ${t.dataset.yAxisID === 'y1' ? D.fmtR(t.parsed.y) : D.fmtN(t.parsed.y)}` } } },
        scales: { x: eixoX(c), y: eixoY(c, { stacked: true }),
          y1: { position: 'right', beginAtZero: true, grid: { display: false }, border: { display: false }, ticks: { color: c.ink, font: { size: 11 }, callback: v => 'R$ ' + v.toLocaleString('pt-BR') } } } },
    });
  };

  /** Barras horizontais: CPMQL (grossa) e CPL (fina) por linha, só linhas com lead. */
  D.graficoCusto = function (id, rows) {
    const el = base(id); if (!el) return;
    const c = D.cores();
    const top = rows.filter(r => r.leads > 0).slice(0, 12);
    el.parentElement.style.height = Math.max(180, top.length * 34 + 60) + 'px';
    charts[id] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: { labels: top.map(r => corta(r.nome, 40)), datasets: [
        { label: 'CPMQL', data: top.map(r => r.cpmql), backgroundColor: c.s1, barPercentage: .7 },
        { label: 'CPL', data: top.map(r => r.cpl), backgroundColor: c.s3, barPercentage: .35 },
      ] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: legenda(c), tooltip: { ...tooltip(c), callbacks: { label: t => ` ${t.dataset.label}: ${D.orDash(t.parsed.x, D.fmtR)}` } } },
        scales: { x: eixoY(c, { ticks: { color: c.ink, callback: v => 'R$ ' + v } }), y: { grid: { display: false }, ticks: { color: c.ink, font: { size: 11 } } } } },
    });
  };

  /** Barras agrupadas: o que o Meta reporta × leads reais × MQL, por campanha. */
  D.graficoMetaVsReal = function (id, rows) {
    const el = base(id); if (!el) return;
    const c = D.cores();
    const top = rows.filter(r => r.meta_reporta > 0 || r.leads > 0).slice(0, 10);
    charts[id] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: { labels: top.map(r => corta(r.nome, 28)), datasets: [
        { label: 'Meta reporta', data: top.map(r => r.meta_reporta), backgroundColor: c.s2 },
        { label: 'Leads reais', data: top.map(r => r.leads), backgroundColor: c.s1 },
        { label: 'MQL (10+)', data: top.map(r => r.mql), backgroundColor: c.s4 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: legenda(c), tooltip: tooltip(c) },
        scales: { x: { grid: { display: false }, ticks: { color: c.ink, font: { size: 10 }, maxRotation: 0 } }, y: eixoY(c) } },
    });
  };

  /** Funil em HTML: cada passo mostra o valor e a taxa sobre o passo anterior. */
  D.renderFunil = function (id, passos) {
    const el = document.getElementById(id); if (!el) return;
    const max = Math.max(...passos.map(p => p.valor || 0), 1);
    el.innerHTML = passos.map((p, i) => {
      const ant = i > 0 ? passos[i - 1].valor : null;
      const taxa = ant ? D.pct(p.valor || 0, ant) : null;
      return `<div class="fn-step"><div class="fn-label">${D.esc(p.rotulo)}</div>`
        + `<div class="fn-bar-wrap"><div class="fn-bar-fill" style="width:${Math.max(((p.valor || 0) / max) * 100, 2)}%"></div></div>`
        + `<div class="fn-count">${p.valor === null || p.valor === undefined ? '—' : D.fmtN(p.valor)}${taxa !== null ? `<small>${D.fmtP(taxa)}</small>` : ''}</div></div>`;
    }).join('');
  };
})(window.SPD = window.SPD || {});
