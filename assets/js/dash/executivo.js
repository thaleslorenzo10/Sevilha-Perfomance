'use strict';
/* Faixa executiva (com delta contra o período anterior) e alertas. */
(function (D) {
  D.setK = (id, texto) => { const el = document.getElementById(id); if (el) { el.classList.remove('skeleton', 'kpi-skel'); el.textContent = texto; } };

  // `invertido`: cair é bom (custo). `neutro`: gasto não é bom nem ruim por si.
  const CARTOES = [
    { id: 'ex-spend',   chave: 'spend',   fmt: D.fmtR, neutro: true },
    { id: 'ex-leads',   chave: 'leads',   fmt: D.fmtN },
    { id: 'ex-mql',     chave: 'mql',     fmt: D.fmtN },
    { id: 'ex-mql-pct', chave: 'mql_pct', fmt: D.fmtP },
    { id: 'ex-cpl',     chave: 'cpl',     fmt: D.fmtR, invertido: true },
    { id: 'ex-cpmql',   chave: 'cpmql',   fmt: D.fmtR, invertido: true },
    { id: 'ex-deals',   chave: 'deals',   fmt: D.fmtN },
  ];

  D.renderExecutivo = function (dados, anterior) {
    const atual = D.resumo(dados);
    const ant = anterior ? D.resumo(anterior) : {};
    for (const c of CARTOES) {
      D.setK(c.id, D.orDash(atual[c.chave], c.fmt));
      const sub = document.getElementById(c.id + '-sub');
      if (!sub) continue;
      const dl = D.delta(atual[c.chave], ant[c.chave]);
      if (dl === null) { sub.className = 'kpi-sub'; sub.textContent = 'sem base no período anterior'; continue; }
      const bom = c.invertido ? dl <= 0 : dl >= 0;
      sub.className = 'kpi-sub ' + (c.neutro ? 'delta-neutro' : bom ? 'delta-bom' : 'delta-ruim');
      sub.textContent = `${dl >= 0 ? '▲' : '▼'} ${D.fmtP(Math.abs(dl))} vs. anterior (${D.orDash(ant[c.chave], c.fmt)})`;
    }
  };

  // O Respondi parou de propósito em 27/08/2026 (a página nova substituiu a LP antiga): não é alerta.
  const avisosDasFontes = fontes => {
    const avisos = [];
    for (const f of fontes || []) {
      if (f.erro) avisos.push(`Fonte <strong>${D.esc(f.nome)}</strong> falhou: ${D.esc(f.erro)}`);
      else if (f.nome !== 'RESPONDI' && f.dias_sem_lead !== null && f.dias_sem_lead > 3) {
        avisos.push(`Fonte <strong>${D.esc(f.nome)}</strong> sem lead há ${f.dias_sem_lead} dias (último em ${D.fmtDia(f.ultimo_lead)}).`);
      }
    }
    return avisos;
  };

  const avisoCafe = (meta, leads) => (meta && meta.grupos.CAFE && meta.grupos.CAFE.spend > 0 && leads && leads.por_grupo.CAFE.leads === 0)
    ? 'Café com Sevilha tem gasto no Meta e nenhum lead real: o webhook do RD Marketing não está ativo ou não recebeu conversão no período.'
    : null;

  D.renderAlertas = function ({ meta, leads }) {
    const avisos = [];
    if (!leads) avisos.push('Leads unificados indisponíveis: leads, MQL, CPL e cruzamentos ficam sem número.');
    avisos.push(...avisosDasFontes(leads && leads.fontes));
    const quebradas = leads ? (leads.por_campanha.find(c => c.campanha === 'Etiqueta quebrada') || { leads: 0 }).leads : 0;
    if (quebradas) avisos.push(`${quebradas} lead(s) com <strong>etiqueta quebrada</strong>: macro de UTM gravada literal — conferir a URL do anúncio.`);
    const cafe = avisoCafe(meta, leads);
    if (cafe) avisos.push(cafe);
    D.banner('alertas', avisos.length ? '<ul>' + avisos.map(a => `<li>${a}</li>`).join('') + '</ul>' : '');
  };
})(window.SPD = window.SPD || {});
