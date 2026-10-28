'use strict';
/* Estado, período, abas, tema e o ciclo carregar → render → auto-refresh. */
(function (D) {
  const estado = { since: '', until: '', preset: 'this_month', dados: null, anterior: null, anteriorChave: null, timer: null };
  let carregamento = 0;
  // Os recortes são dias civis de Brasília, independentemente do navegador.
  const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const deslocar = (dia, n) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  function intervalo(preset) {
    const fim = hoje(), inicio = fim.slice(0, 7) + '-01';
    switch (preset) {
      case 'today': return [fim, fim];
      case 'last_7d': return [deslocar(fim, -6), fim];
      case 'last_14d': return [deslocar(fim, -13), fim];
      case 'last_90d': return [deslocar(fim, -89), fim];
      case 'this_month': return [inicio, fim];
      case 'last_month': { const anterior = deslocar(inicio, -1); return [anterior.slice(0, 7) + '-01', anterior]; }
      default: return [deslocar(fim, -29), fim];
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
    D.abrirEvento(nome);
    D.abrirOperacao(nome);
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

  // Período anterior não muda com o refresh automático de 60s: só rebusca
  // quando o período em tela mudou (ou ainda não tinha base nenhuma).
  async function buscarAnterior(since, until) {
    const ant = D.periodoAnterior(since, until);
    const chaveAnt = `${ant.since}|${ant.until}`;
    const precisaAnterior = estado.anterior === null || chaveAnt !== estado.anteriorChave;
    const anterior = precisaAnterior ? await D.carregarResumo(ant.since, ant.until) : estado.anterior;
    return { anterior, chaveAnt };
  }

  function marcarAtualizado(dados) {
    status('', dados.leads ? 'Dados atualizados' : 'Meta ok · leads unificados indisponíveis');
    document.getElementById('lastUpdate').textContent = '🕐 ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  async function carregar() {
    D.periodoOperacao(estado.since, estado.until);
    D.periodoEventos(estado.since, estado.until);
    const versao = ++carregamento, btn = document.getElementById('btnRefresh');
    btn.disabled = true; status('loading', 'Carregando…'); D.banner('errorBanner', '');
    try {
      const [dados, { anterior, chaveAnt }] = await Promise.all([
        D.carregarTudo(estado.since, estado.until),
        buscarAnterior(estado.since, estado.until),
      ]);
      if (versao !== carregamento) return;
      estado.dados = dados; estado.anterior = anterior; estado.anteriorChave = chaveAnt;
      render();
      marcarAtualizado(dados);
    } catch (e) {
      if (versao !== carregamento) return;
      console.error(e);
      status('error', 'Visão geral: Meta indisponível');
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
    document.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) D.abrirAba(b.dataset.tab); });
    window.addEventListener('hashchange', () => { const tab = location.hash.slice(1); if (document.getElementById('tab-' + tab)) D.abrirAba(tab); });
    document.addEventListener('click', e => { const b = e.target.closest('[data-csv]'); if (b) D.baixarCsv(b.dataset.csv, `${b.dataset.csv}-${estado.since}-${estado.until}.csv`); });
    const aba = location.hash.replace('#', '');
    if (aba && document.getElementById('tab-' + aba)) D.abrirAba(aba);
    const [s, u] = intervalo('this_month'); aplicarPeriodo('this_month', s, u);
  });
})(window.SPD = window.SPD || {});
