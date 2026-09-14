'use strict';
/* Tabela ordenável a partir de linhas cruzadas (D.cruzar) e exportação CSV. */
(function (D) {
  // Faixas de CPMQL: abaixo de R$ 150 está no patamar histórico do FORMS; acima de R$ 250 pede ação.
  D.faixaCusto = v => (v == null ? '' : v <= 150 ? 'custo-bom' : v <= 250 ? 'custo-ok' : 'custo-ruim');
  const NOMES_GRUPO = { SE: 'Sessão Estratégica', CAFE: 'Café com Sevilha', CP: 'Clube', OUTROS: 'Outros' };
  D.badgeGrupo = g => (g ? `<span class="badge badge-${g.toLowerCase()}">${NOMES_GRUPO[g] || g}</span>` : '');

  const COLS = {
    nome:         { titulo: 'Nome',         fmt: r => `<span title="${D.esc(r.nome)}">${D.esc(r.nome)}</span>` },
    grupo:        { titulo: 'Grupo',        fmt: r => D.badgeGrupo(r.grupo) },
    campanha:     { titulo: 'Campanha',     fmt: r => D.esc(r.campanha || '') },
    spend:        { titulo: 'Gasto',        fmt: r => D.fmtR(r.spend), num: true },
    leads:        { titulo: 'Leads',        fmt: r => D.fmtN(r.leads), num: true },
    mql:          { titulo: 'MQL (10+)',    fmt: r => D.fmtN(r.mql), num: true },
    mql_pct:      { titulo: '% MQL',        fmt: r => D.orDash(r.mql_pct, D.fmtP), num: true },
    cpl:          { titulo: 'CPL',          fmt: r => D.orDash(r.cpl, D.fmtR), num: true },
    cpmql:        { titulo: 'CPMQL',        fmt: r => (r.cpmql === null ? '—' : `<span class="${D.faixaCusto(r.cpmql)}">${D.fmtR(r.cpmql)}</span>`), num: true },
    meta_reporta: { titulo: 'Meta reporta', fmt: r => D.fmtN(r.meta_reporta), num: true },
    deals:        { titulo: 'Deals',        fmt: r => D.fmtN(r.deals), num: true },
    lead_deal:    { titulo: 'Lead → Deal',  fmt: r => D.orDash(r.lead_deal, D.fmtP), num: true },
  };
  D.COLUNAS_CRUZAMENTO = ['nome', 'spend', 'leads', 'mql', 'mql_pct', 'cpl', 'cpmql', 'meta_reporta'];

  function ordenar(rows, col, desc) {
    return [...rows].sort((a, b) => {
      const x = a[col], y = b[col];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x > y ? 1 : -1) * (desc ? -1 : 1);
    });
  }

  /** Gera thead/tbody/tfoot dentro de <table id>. Clique no cabeçalho reordena; estado fica no elemento. */
  D.tabela = function (tableId, rows, colunas, { total = true, vazio = 'Sem dados no período' } = {}) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const ord = table._ord || (table._ord = { col: colunas.includes('spend') ? 'spend' : colunas[1], desc: true });
    table._rows = rows; table._cols = colunas;
    const tr = r => `<tr>${colunas.map(c => `<td class="${COLS[c].num ? 'num' : ''}">${COLS[c].fmt(r)}</td>`).join('')}</tr>`;
    const th = colunas.map(c => `<th class="${COLS[c].num ? 'num' : ''} ${ord.col === c ? (ord.desc ? 'ord-desc' : 'ord-asc') : ''}" data-col="${c}">${COLS[c].titulo}</th>`).join('');
    const ordenadas = ordenar(rows, ord.col, ord.desc);
    const corpo = ordenadas.length ? ordenadas.map(tr).join('') : `<tr><td colspan="${colunas.length}" class="vazio">${D.esc(vazio)}</td></tr>`;
    const rodape = total && ordenadas.length ? `<tfoot>${tr(D.totalizar(rows))}</tfoot>` : '';
    table.innerHTML = `<thead><tr>${th}</tr></thead><tbody>${corpo}</tbody>${rodape}`;
    table.querySelectorAll('th[data-col]').forEach(h => h.addEventListener('click', () => {
      const col = h.dataset.col;
      if (ord.col === col) ord.desc = !ord.desc; else { ord.col = col; ord.desc = true; }
      D.tabela(tableId, table._rows, table._cols, { total, vazio });
    }));
  };

  /** CSV com ; e BOM: o Excel em português abre direto, com decimal em vírgula. */
  D.csvDe = function (rows, colunas) {
    const cel = v => (v === null || v === undefined ? '' : typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v));
    // Injeção de fórmula: célula que começa com =, +, - ou @ é fórmula para o
    // Excel/Sheets ao abrir o CSV. Um apóstrofo na frente neutraliza sem mudar
    // o valor visível.
    const segura = s => (/^[=+\-@]/.test(s) ? `'${s}` : s);
    const linhas = rows.map(r => colunas.map(c => `"${segura(cel(r[c])).replace(/"/g, '""')}"`).join(';'));
    return '﻿' + [colunas.map(c => COLS[c].titulo).join(';'), ...linhas].join('\r\n');
  };
  D.baixarCsv = function (tableId, nomeArquivo) {
    const t = document.getElementById(tableId);
    if (!t || !t._rows) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([D.csvDe(t._rows, t._cols)], { type: 'text/csv;charset=utf-8' }));
    a.download = nomeArquivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
})(window.SPD = window.SPD || {});
