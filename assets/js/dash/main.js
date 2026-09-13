'use strict';
/* Estado, período, abas, tema e o ciclo carregar → render → auto-refresh. */
(function (D) {
  const estado = { since: '', until: '', preset: 'last_30d', dados: null, anterior: null, timer: null };
  const p2 = n => String(n).padStart(2, '0');
  // Datas sempre em horário local: toISOString() é UTC e, depois das 21h, "hoje" já seria amanhã.
  const isoLocal = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const hoje = () => isoLocal(new Date());
  const diasAtras = n => { const d = new Date(); d.setDate(d.getDate() - n); return isoLocal(d); };

  function intervalo(preset) {
    switch (preset) {
      case 'today': return [hoje(), hoje()];
      case 'last_7d': return [diasAtras(6), hoje()];
      case 'last_14d': return [diasAtras(13), hoje()];
      case 'last_90d': return [diasAtras(89), hoje()];
      case 'this_month': { const d = new Date(); d.setDate(1); return [isoLocal(d), hoje()]; }
      case 'last_month': { const ini = new Date(); ini.setDate(1); ini.setMonth(ini.getMonth() - 1); const fim = new Date(); fim.setDate(0); return [isoLocal(ini), isoLocal(fim)]; }
      default: return [diasAtras(29), hoje()];
    }
  }
  const ROTULO = { today: 'Hoje', last_7d: 'Últimos 7 dias', last_14d: 'Últimos 14 dias', last_30d: 'Últimos 30 dias', last_90d: 'Últimos 90 dias', this_month: 'Este mês', last_month: 'Mês anterior' };

  function aplicarPeriodo(preset, since, until) {
    estado.preset = preset; estado.since = since; estado.until = until;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
    document.getElementById('customDates').classList.toggle('show', preset === 'custom');
    document.getElementById('periodBadge').textContent = '📅 ' + (ROTULO[preset] || `${D.fmtDia(since)} → ${D.fmtDia(until)}`);
    carregar();
  }

  D.banner = (id, html) => { const el = document.getElementById(id); if (!el) return; el.innerHTML = html || ''; el.classList.toggle('show', !!html); };
  D.abrirAba = function (nome) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      const on = b.dataset.tab === nome; b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.querySelectorAll('.tab-panel').forEach(pn => pn.classList.toggle('active', pn.id === 'tab-' + nome));
    if (location.hash !== '#' + nome) history.replaceState(null, '', '#' + nome);
    D.redimensionarGraficos();
  };

  function status(classe, texto) { document.getElementById('statusDot').className = 'status-dot ' + classe; document.getElementById('statusText').textContent = texto; }
  const seExiste = (fn, ...args) => { if (typeof fn === 'function') fn(...args); };

  // Fora do listener de clique para não passar do teto de callbacks aninhados.
  function clicarPreset(b) {
    const p = b.dataset.preset;
    if (p === 'custom') { document.querySelectorAll('.preset-btn').forEach(x => x.classList.toggle('active', x === b)); document.getElementById('customDates').classList.add('show'); return; }
    const [s, u] = intervalo(p); aplicarPeriodo(p, s, u);
  }

  function render() {
    const d = estado.dados;
    D.renderExecutivo(d, estado.anterior);
    D.renderAlertas(d);
    D.renderGeral(d);
    seExiste(D.renderFormatos, d);
    for (const g of ['SE', 'CAFE', 'CP']) seExiste(D.renderGrupo, g, d);
    seExiste(D.renderOrigem, d);
    seExiste(D.renderAb, d);
  }

  async function carregar() {
    const btn = document.getElementById('btnRefresh');
    btn.disabled = true; status('loading', 'Carregando…'); D.banner('errorBanner', '');
    try {
      const ant = D.periodoAnterior(estado.since, estado.until);
      const [dados, anterior] = await Promise.all([D.carregarTudo(estado.since, estado.until), D.carregarResumo(ant.since, ant.until)]);
      estado.dados = dados; estado.anterior = anterior;
      render();
      status('', dados.leads ? 'Dados atualizados' : 'Meta ok · leads unificados indisponíveis');
      document.getElementById('lastUpdate').textContent = '🕐 ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error(e);
      status('error', 'Erro ao carregar');
      D.banner('errorBanner', `⚠️ <strong>Erro ao carregar o Meta Ads:</strong> ${D.esc(e.message)}`);
    }
    btn.disabled = false;
    clearTimeout(estado.timer);
    estado.timer = setTimeout(carregar, 60000);
  }

  // Tema: persistido por navegador; ao trocar, redesenha para os gráficos lerem as cores novas.
  function aplicarTema(escuro) {
    document.documentElement.setAttribute('data-theme', escuro ? 'dark' : '');
    document.getElementById('btnTheme').textContent = escuro ? '☀️' : '🌙';
    try { localStorage.setItem('sp-theme', escuro ? 'dark' : ''); } catch { /* armazenamento bloqueado */ }
    if (estado.dados) render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    let escuro = false;
    try { escuro = localStorage.getItem('sp-theme') === 'dark'; } catch { /* idem */ }
    if (escuro) aplicarTema(true);
    document.getElementById('btnTheme').addEventListener('click', () => aplicarTema(document.documentElement.getAttribute('data-theme') !== 'dark'));
    document.getElementById('btnRefresh').addEventListener('click', carregar);
    document.querySelectorAll('.preset-btn').forEach(b => b.addEventListener('click', () => clicarPreset(b)));
    document.getElementById('btnApply').addEventListener('click', () => {
      const s = document.getElementById('dateSince').value, u = document.getElementById('dateUntil').value;
      if (!s || !u || s > u) { alert('Informe um intervalo válido (início ≤ fim).'); return; }
      aplicarPeriodo('custom', s, u);
    });
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => D.abrirAba(b.dataset.tab)));
    document.addEventListener('click', e => { const b = e.target.closest('[data-csv]'); if (b) D.baixarCsv(b.dataset.csv, `${b.dataset.csv}-${estado.since}-${estado.until}.csv`); });
    const aba = location.hash.replace('#', '');
    if (aba && document.getElementById('tab-' + aba)) D.abrirAba(aba);
    const [s, u] = intervalo('last_30d'); aplicarPeriodo('last_30d', s, u);
  });
})(window.SPD = window.SPD || {});
