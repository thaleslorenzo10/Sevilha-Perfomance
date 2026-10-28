'use strict';
/* Edições com janela própria. Falhas de uma fonte não apagam as demais. */
(function (D) {
  const EDICOES = {
    'aula-2026-10-27': { nome: 'Aula paga — Gestão Operacional', data: '2026-10-27', inicio: '2026-10-14', grupo: 'AULA' },
    'cafe-2026-11-11': { nome: 'Café com Sevilha', data: '2026-11-11', inicio: '2026-10-14', grupo: 'CAFE' },
    'aula-2026-10-06': { nome: 'Aula paga — Gestão Operacional', data: '2026-10-06', inicio: '2026-09-17', grupo: 'AULA' },
  };
  let ativa = '', since = '', until = '', versao = 0;
  const valor = (n, fmt = D.fmtN) => n == null ? 'n/d' : fmt(n);
  const card = (titulo, n, fmt) => `<div class="kpi-card"><div class="kpi-label">${titulo}</div><div class="kpi-value">${valor(n, fmt)}</div></div>`;
  const cabecalho = id => `<div class="section"><h2>${EDICOES[id].nome} · ${D.fmtDia(EDICOES[id].data)}</h2><p class="nota-fonte">Captação de ${D.fmtDia(EDICOES[id].inicio)} a ${D.fmtDia(EDICOES[id].data)}. Acumulado desta edição até hoje ou o fim da captação. Somente dados deste evento.</p></div>`;
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
    const rows = D.linhasFunilOperacao({ fonte: evento.leads, meta });
    const corpo = rows.map(r => `<tr><td>${D.esc(r.nome)}</td><td class="num">${valor(meta ? r.spend : null, D.fmtR)}</td><td class="num">${valor(evento.leads ? r.leads : null)}</td><td class="num">${valor(evento.leads ? r.qualificados : null)}</td><td class="num">${valor(meta ? r.meta_reporta : null)}</td></tr>`).join('');
    return `<div class="section"><div class="section-title">Campanhas desta edição</div><div class="table-wrap"><table><thead><tr><th>Campanha</th><th class="num">Investimento</th><th class="num">Leads reais</th><th class="num">Qualificados</th><th class="num">Meta reporta</th></tr></thead><tbody>${corpo || '<tr><td colspan="5" class="vazio">Sem campanhas disponíveis no período desta edição</td></tr>'}</tbody></table></div></div>`;
  }

  function compras(evento, spend) {
    if (evento.id.startsWith('cafe')) return '<p class="nota-fonte">Vendas e receita: n/d — o Café não possui fonte própria de vendas. Deals gerais do CRM não representam vendas deste evento.</p>';
    const c = evento.compras;
    const a = c?.aula, g = c?.gravacao, t = c?.combinado;
    const razao = (n, d) => n == null || d == null || d <= 0 ? null : n / d;
    const percentual = n => (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    const grupo = (titulo, conteudo, classe = '') => `<div class="kpi-group ${classe}"><div class="kpi-group-label">${titulo}</div>${conteudo}</div>`;
    return '<div class="kpi-groups">'
      + grupo('Aula ao vivo — inscrições', card('Inscrições pagas', a?.pagas ?? c?.pagas) + card('Receita da aula', a?.receita, D.fmtR) + card('Inscrições reembolsadas', a?.reembolsadas ?? c?.reembolsadas) + card('Valor reembolsado da aula', a?.valor_reembolsado, D.fmtR))
      + grupo('Gravação — order bump', card('Gravações pagas', g?.pagas) + card('Receita da gravação', g?.receita, D.fmtR) + card('Gravações reembolsadas', g?.reembolsadas) + card('Valor reembolsado da gravação', g?.valor_reembolsado, D.fmtR) + card('Adesão à gravação', t?.adesao, percentual))
      + grupo('Aula + gravação — resultado combinado', card('Receita total dos produtos', t?.receita, D.fmtR) + card('Total cobrado com acréscimos', t?.cobrado, D.fmtR) + card('Valor líquido Kiwify', t?.liquido, D.fmtR) + card('Receita por inscrição', t?.ticket_medio, D.fmtR) + card('Custo médio por inscrição', razao(spend, a?.pagas), D.fmtR) + card('Receita / mídia', razao(t?.receita, spend), n => n.toFixed(2).replace('.', ',') + 'x'), 'kpi-group-combinado')
      + '</div><p class="nota-fonte">A gravação acrescenta receita e não uma nova inscrição. Receita dos produtos exclui acréscimos de parcelamento; valor líquido é após descontos da Kiwify, antes da mídia e demais custos. Adesão = compradores da gravação também inscritos ÷ compradores da aula no período. Custo médio e receita/mídia usam o investimento Meta da mesma janela e não comprovam atribuição individual. Não representam lucro.</p>'
      + (c?.datas_aproximadas ? '<p class="nota-fonte">Datas de pagamento de parte do histórico foram aproximadas pela criação do pedido no CSV da Kiwify. A data de aprovação exata não estava no arquivo.</p>' : '');
  }

  function avisos(evento, erroMeta) {
    const itens = (evento.erros || []).map(e => typeof e === 'string' ? e : (e.mensagem || e.error || e.fonte || 'Fonte indisponível'));
    if (erroMeta) itens.push('Meta Ads indisponível: investimento, atribuição e CPL n/d.');
    if (evento.leads?.total?.leads == null) itens.push('Leads reais indisponíveis.');
    if (evento.id.startsWith('aula') && !evento.compras) itens.push('Compras Kiwify indisponíveis: compras e receita n/d.');
    return itens.length ? `<div class="banner banner-warn show" role="status">${itens.map(D.esc).join('<br>')}</div>` : '';
  }

  D.markupEvento = function (evento, meta, erroMeta) {
    const periodo = evento.periodo;
    const titulo = cabecalho(evento.id);
    if (!periodo) return titulo + `<div class="section"><p>Sem interseção entre o filtro selecionado e a captação desta edição. Selecione um período entre ${D.fmtDia(EDICOES[evento.id].inicio)} e ${D.fmtDia(EDICOES[evento.id].data)}.</p></div>`;
    const total = evento.leads?.total, spend = meta?.total?.spend;
    const cpl = spend == null || !total ? null : D.razao(spend, total.leads);
    return titulo + `<p class="nota-fonte">Período efetivo: ${D.fmtDia(periodo.since)} a ${D.fmtDia(periodo.until)}.</p>` + avisos(evento, erroMeta)
      + `<div class="kpi-groups"><div class="kpi-group"><div class="kpi-group-label">Resultados desta edição</div>${card('Investimento', spend, D.fmtR)}${card('Leads reais', total?.leads)}${card('Qualificados', total?.qualificados)}${card('CPL real', cpl, D.fmtR)}${card('Leads atribuídos pelo Meta', meta?.total?.leads)}</div></div>`
      + '<p class="nota-fonte">Leads reais: pessoas únicas nesta edição. A atribuição do Meta é uma medida separada; não é somada aos leads reais.</p>'
      + compras(evento, spend) + tabela(evento, meta);
  };

  async function carregar() {
    if (!EDICOES[ativa] || !since || !until) return;
    const id = ativa, atual = ++versao;
    painel(id).innerHTML = cabecalho(id) + '<p role="status">Carregando dados desta edição…</p>';
    try {
      const resultado = await D.carregarFunilOperacao(id, since, until);
      if (atual !== versao) return;
      const f = resultado.fonte;
      const evento = { id, periodo: resultado.periodo, leads: f, compras: f?.compras || null,
        erros: (f?.fontes || []).filter(v => !v.disponivel).map(v => `${v.nome}: fonte indisponível`) };
      const meta = resultado.meta, erroMeta = !meta;
      painel(id).innerHTML = D.markupEvento(evento, meta, erroMeta) + D.secoesOperacao(resultado);
    } catch (e) {
      if (atual !== versao) return;
      painel(id).innerHTML = cabecalho(id) + `<div class="banner banner-error show" role="alert">Dados desta edição indisponíveis (n/d): ${D.esc(e.message)}. Use Atualizar para tentar novamente.</div>`;
    }
  }

  D.abrirEvento = function (nome) {
    ativa = nome; ++versao;
    document.body.classList.toggle('evento-ativo', !!EDICOES[nome]);
    carregar();
  };
  D.periodoEventos = function (s, u) {
    since = s; until = u; ++versao;
    carregar();
  };
})(window.SPD = window.SPD || {});
