'use strict';
/* Edições com janela própria. Falhas de uma fonte não apagam as demais. */
(function (D) {
  const EDICOES = {
    'aula-2026-10-27': { nome: 'Aula paga — Gestão Operacional', data: '2026-10-27', grupo: 'AULA' },
    'cafe-2026-11-11': { nome: 'Café com Sevilha', data: '2026-11-11', grupo: 'CAFE' },
  };
  let ativa = '', since = '', until = '', versao = 0, pedido = null;
  const valor = (n, fmt = D.fmtN) => n == null ? 'n/d' : fmt(n);
  const card = (titulo, n, fmt) => `<div class="kpi-card"><div class="kpi-label">${titulo}</div><div class="kpi-value">${valor(n, fmt)}</div></div>`;
  const cabecalho = id => `<div class="section"><h2>${EDICOES[id].nome} · ${D.fmtDia(EDICOES[id].data)}</h2><p class="nota-fonte">Separação por período de captação desde 14/10/2026. Somente dados desta edição e deste evento.</p></div>`;
  const painel = id => document.getElementById('painel-' + id);

  D.filtrarMetaEvento = function (meta, grupo) {
    if (!meta) return null;
    return {
      total: meta.grupos?.[grupo] || null,
      campanhas: (meta.campanhas || []).filter(r => r.grupo === grupo),
      conjuntos: (meta.conjuntos || []).filter(r => r.grupo === grupo),
      anuncios: (meta.anuncios || []).filter(r => r.grupo === grupo),
      serie: (meta.serie || []).map(r => ({ data: r.data, ...r[grupo] })),
    };
  };

  function tabela(evento, meta) {
    const rows = D.cruzar(evento.leads?.por_campanha || [], meta?.campanhas || [], 'campanha');
    const corpo = rows.map(r => `<tr><td>${D.esc(r.nome)}</td><td class="num">${valor(meta ? r.spend : null, D.fmtR)}</td><td class="num">${valor(evento.leads ? r.leads : null)}</td><td class="num">${valor(evento.leads ? r.mql : null)}</td><td class="num">${valor(meta ? r.meta_reporta : null)}</td></tr>`).join('');
    return `<div class="section"><div class="section-title">Campanhas desta edição</div><div class="table-wrap"><table><thead><tr><th>Campanha</th><th class="num">Investimento</th><th class="num">Leads reais</th><th class="num">MQL</th><th class="num">Meta reporta</th></tr></thead><tbody>${corpo || '<tr><td colspan="5" class="vazio">Sem campanhas disponíveis no período desta edição</td></tr>'}</tbody></table></div></div>`;
  }

  function compras(evento) {
    if (evento.id.startsWith('cafe')) return '<p class="nota-fonte">Vendas e receita: n/d — o Café não possui fonte própria de vendas. Deals gerais do CRM não representam vendas deste evento.</p>';
    const c = evento.compras;
    return `<div class="kpi-groups"><div class="kpi-group"><div class="kpi-group-label">Compras da aula — Kiwify</div>${card('Compras aprovadas', c?.pagas)}${card('Receita aprovada', c?.receita, D.fmtR)}${card('Compras reembolsadas', c?.reembolsadas)}${card('Valor reembolsado', c?.valor_reembolsado, D.fmtR)}</div></div><p class="nota-fonte">Receita aprovada e reembolsos são apresentados separadamente; não representam lucro.</p>`;
  }

  function avisos(evento, erroMeta) {
    const itens = (evento.erros || []).map(e => typeof e === 'string' ? e : (e.mensagem || e.error || e.fonte || 'Fonte indisponível'));
    if (erroMeta) itens.push('Meta Ads indisponível: investimento, atribuição e CPL n/d.');
    if (!evento.leads) itens.push('Leads reais indisponíveis: leads e MQL n/d.');
    if (evento.id.startsWith('aula') && !evento.compras) itens.push('Compras Kiwify indisponíveis: compras e receita n/d.');
    return itens.length ? `<div class="banner banner-warn show" role="status">${itens.map(D.esc).join('<br>')}</div>` : '';
  }

  D.markupEvento = function (evento, meta, erroMeta) {
    const periodo = evento.periodo;
    const titulo = cabecalho(evento.id);
    if (!periodo) return titulo + '<div class="section"><p>Sem interseção entre o filtro selecionado e a captação desta edição. Selecione um período entre 14/10/2026 e a data do evento.</p></div>';
    const total = evento.leads?.total, spend = meta?.total?.spend;
    const cpl = spend == null || !total ? null : D.razao(spend, total.leads);
    return titulo + `<p class="nota-fonte">Período efetivo: ${D.fmtDia(periodo.since)} a ${D.fmtDia(periodo.until)}.</p>` + avisos(evento, erroMeta)
      + `<div class="kpi-groups"><div class="kpi-group"><div class="kpi-group-label">Resultados desta edição</div>${card('Investimento', spend, D.fmtR)}${card('Leads reais', total?.leads)}${card('MQL (10+)', total?.mql)}${card('CPL real', cpl, D.fmtR)}${card('Leads atribuídos pelo Meta', meta?.total?.leads)}</div></div>`
      + '<p class="nota-fonte">Leads reais: pessoas únicas nesta edição. A atribuição do Meta é uma medida separada; não é somada aos leads reais.</p>'
      + compras(evento) + tabela(evento, meta);
  };

  async function carregar() {
    if (!EDICOES[ativa] || !since || !until) return;
    const id = ativa, atual = ++versao;
    painel(id).innerHTML = cabecalho(id) + '<p role="status">Carregando dados desta edição…</p>';
    try {
      if (!pedido) pedido = D.buscarEventos(since, until);
      const resposta = await pedido;
      if (atual !== versao) return;
      const evento = resposta.eventos.find(e => e.id === id);
      if (!evento) throw new Error('Edição ausente na resposta de dados.');
      let meta = null, erroMeta = false;
      if (evento.periodo) {
        try { meta = D.filtrarMetaEvento(await D.buscarMeta(evento.periodo.since, evento.periodo.until), EDICOES[id].grupo); }
        catch { erroMeta = true; }
      }
      if (atual !== versao) return;
      painel(id).innerHTML = D.markupEvento(evento, meta, erroMeta);
    } catch (e) {
      if (atual !== versao) return;
      pedido = null;
      painel(id).innerHTML = cabecalho(id) + `<div class="banner banner-error show" role="alert">Dados desta edição indisponíveis (n/d): ${D.esc(e.message)}. Use Atualizar para tentar novamente.</div>`;
    }
  }

  D.abrirEvento = function (nome) {
    ativa = nome; ++versao;
    document.body.classList.toggle('evento-ativo', !!EDICOES[nome]);
    carregar();
  };
  D.periodoEventos = function (s, u) {
    since = s; until = u; pedido = null; ++versao;
    carregar();
  };
})(window.SPD = window.SPD || {});
