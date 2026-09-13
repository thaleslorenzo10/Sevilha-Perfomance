'use strict';
/* Chamadas aos endpoints e cálculo do período anterior. */
(function (D) {
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `${url} → HTTP ${r.status}`);
    return j;
  }
  const opcional = (p, rotulo) => p.catch(e => { console.warn(`${rotulo}:`, e.message); return null; });

  /** O Meta é obrigatório; as outras fontes degradam para null e o painel avisa. */
  D.carregarTudo = async function (since, until) {
    const qs = `since=${since}&until=${until}`;
    const [meta, leads, rd, stats] = await Promise.all([
      getJSON(`/api/meta?${qs}`),
      opcional(getJSON(`/api/leads-unificados?${qs}`), 'leads unificados'),
      opcional(getJSON(`/api/rd-stats?from=${since}&to=${until}`), 'rd'),
      opcional(getJSON(`/api/stats?${qs}`), 'stats'),
    ]);
    return { meta, leads, rd, stats };
  };

  /** Período anterior: tudo opcional — sem base de comparação o card só diz "sem base". */
  D.carregarResumo = async function (since, until) {
    const qs = `since=${since}&until=${until}`;
    const [meta, leads, rd] = await Promise.all([
      opcional(getJSON(`/api/meta?${qs}`), 'meta anterior'),
      opcional(getJSON(`/api/leads-unificados?${qs}`), 'leads anterior'),
      opcional(getJSON(`/api/rd-stats?from=${since}&to=${until}`), 'rd anterior'),
    ]);
    return { meta, leads, rd };
  };

  D.periodoAnterior = function (since, until) {
    const ms = 864e5;
    const a = new Date(`${since}T00:00:00Z`), b = new Date(`${until}T00:00:00Z`);
    const n = Math.round((b - a) / ms) + 1;
    const iso = d => d.toISOString().slice(0, 10);
    return { since: iso(new Date(a - n * ms)), until: iso(new Date(a - ms)) };
  };
})(window.SPD = window.SPD || {});
