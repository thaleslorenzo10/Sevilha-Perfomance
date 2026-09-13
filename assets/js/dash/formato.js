'use strict';
/* Formatação e utilidades puras do painel. Sem DOM: roda também em Node (scripts/test-dash-cruzamento.js). */
(function (D) {
  D.fmtR = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  D.fmtN = v => Math.round(Number(v) || 0).toLocaleString('pt-BR');
  D.fmtP = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  // Divisão por zero e dado ausente são "—", nunca "0%": zero e não-sei são respostas diferentes.
  D.orDash = (v, fn) => (v === null || v === undefined || Number.isNaN(v)) ? '—' : fn(v);
  D.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  D.razao = (num, den) => (num > 0 && den > 0 ? num / den : null);
  D.pct = (num, den) => (den > 0 ? (num / den) * 100 : null);
  D.fmtDia = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
  D.diaCurto = s => { const [, m, d] = String(s).split('-'); return `${d}/${m}`; };
  /** Nome comparável entre fontes: minúsculo, sem acento, espaços colapsados. */
  D.nomeChave = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  /** Variação percentual contra o período anterior; null sem base. */
  D.delta = (atual, anterior) => (anterior > 0 && atual !== null && atual !== undefined ? ((atual - anterior) / anterior) * 100 : null);
})(window.SPD = window.SPD || {});
