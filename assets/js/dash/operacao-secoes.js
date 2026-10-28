'use strict';
/* Inventário compartilhado Ambiental, sempre limitado aos IDs do próprio funil. */
(function (D) {
  const valor = (n, fmt = D.fmtN) => n == null ? 'Indisponível' : fmt(n);
  const soma = (ls, k) => ls.reduce((s, l) => s + (Number(l[k]) || 0), 0);
  const secao = (res, id, nome, body) => `<section class="section" id="${res.id}-${id}"><div class="section-title">${nome}</div>${body}</section>`;
  const ausente = texto => `<p class="nota-fonte">Indisponível · ${D.esc(texto)}</p>`;
  const linha = (nome, n, fmt = D.fmtN) => `<tr><td>${D.esc(nome)}</td><td class="num">${valor(n, fmt)}</td></tr>`;
  const tabela = (head, body) => `<div class="table-wrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  const razao = (n, d, fator = 1) => n == null || d == null || d <= 0 ? null : fator * n / d;
  function diario(res) {
    const fonte = res.fonte;
    if (!fonte || fonte.total?.leads == null) return [];
    const gastos = res.meta?.diario;
    return (fonte.por_dia || []).map(d => ({ ...d, investimento: gastos ? soma(gastos.filter(g => g.data === d.dia), 'spend') : null }));
  }
  function grafico(dias, campo, acumulado, rotulo, fmt = D.fmtN) {
    if (!dias.length || dias.some(d => d[campo] == null)) return ausente('série completa deste funil não disponível');
    let total = 0;
    const valores = dias.map(d => { total = acumulado ? total + d[campo] : d[campo]; return total; });
    const max = Math.max(...valores, 1), w = 680, h = 160;
    const coord = valores.map((v, i) => [20 + i * (w - 40) / Math.max(1, valores.length - 1), h - 20 - v / max * (h - 40)]);
    return `<svg class="op-trend" viewBox="0 0 ${w} ${h}" role="img" aria-label="${D.esc(rotulo)}"><line x1="20" y1="140" x2="660" y2="140" stroke="var(--chart-grid)"/><polyline fill="none" stroke="var(--chart-series-1)" stroke-width="3" points="${coord.map(c => c.join(',')).join(' ')}"/>${coord.map((c, i) => `<circle cx="${c[0]}" cy="${c[1]}" r="3" fill="var(--chart-series-1)"><title>${D.fmtDia(dias[i].dia)}: ${fmt(valores[i])}</title></circle>`).join('')}</svg><p class="nota-fonte">${D.fmtDia(dias[0].dia)} a ${D.fmtDia(dias[dias.length - 1].dia)} · ${D.esc(rotulo)}: ${fmt(valores[valores.length - 1])}. Valores diários na tabela abaixo.</p>`;
  }
  function tracking(res) {
    const t = res.fonte?.total, m = res.meta?.total;
    const body = tabela(['Fonte', 'Resultado'], linha('Leads reais · registros deduplicados', t?.leads) + linha('Meta · leads atribuídos', m?.leads))
      + '<p class="nota-fonte">Fontes com critérios diferentes. Recebimento de lead, aceite de integração e atribuição de anúncio não são somados nem tratados como entrega comercial.</p>';
    return secao(res, 'tracking', 'Tracking e comparação de fontes', body);
  }
  function secundarios(res) {
    const m = res.meta?.total, t = res.fonte?.total;
    return secao(res, 'secundarios', 'Indicadores secundários', tabela(['Indicador', 'Valor'],
      linha('Impressões', m?.impressions) + linha('Cliques', m?.clicks)
      + linha('CTR', razao(m?.clicks, m?.impressions, 100), D.fmtP)
      + linha('CPM', razao(m?.spend, m?.impressions, 1000), D.fmtR)
      + linha('CPC', razao(m?.spend, m?.clicks), D.fmtR)
      + linha('Taxa de qualificação', razao(t?.qualificados, t?.leads, 100), D.fmtP)));
  }
  function metas(res) {
    return '<div class="op-grid">'
      + secao(res, 'ritmo', res.config.inicio ? 'Orçamento e ritmo do lançamento' : 'Orçamento e ritmo do mês', '<p class="nota-fonte">Orçamento por funil: não configurado. Ritmo de investimento indisponível sem orçamento de referência.</p>')
      + secao(res, 'metas', 'Meta e projeção de resultados', '<p class="nota-fonte">Meta por funil: não configurada. Projeção indisponível sem meta e cobertura temporal validadas.</p>') + '</div>';
  }
  function evolucao(res) {
    const dias = diario(res);
    const tabelaDias = tabela(['Dia', 'Investimento', 'Leads reais', 'Qualificados', 'Custo médio por lead'], dias.map(d => `<tr><td>${D.fmtDia(d.dia)}</td><td class="num">${valor(d.investimento, D.fmtR)}</td><td class="num">${valor(d.leads)}</td><td class="num">${valor(d.qualificados)}</td><td class="num">${valor(razao(d.investimento, d.leads), D.fmtR)}</td></tr>`).join('') || '<tr><td colspan="5">Dados diários indisponíveis.</td></tr>');
    return '<div class="op-grid">' + secao(res, 'investimento-acumulado', 'Investimento acumulado', grafico(dias, 'investimento', true, 'Investimento acumulado', D.fmtR))
      + secao(res, 'resultados-acumulados', 'Leads acumulados', grafico(dias, 'leads', true, 'Leads acumulados')) + '</div>'
      + secao(res, 'diario', 'Evolução diária e custo médio por lead', grafico(dias, 'leads', false, 'Leads do último dia') + tabelaDias + '<p class="nota-fonte">Custo médio = investimento Meta ÷ todos os leads reais do dia. Inclui origens sem atribuição paga; não é CPL atribuído de mídia.</p>');
  }
  function canais(res) {
    return secao(res, 'canais', 'Canais de mídia', tabela(['Canal', 'Investimento'], linha('Meta Ads', res.meta?.total.spend, D.fmtR)) + '<p class="nota-fonte">Google Ads e outros canais: sem fonte conciliada neste funil.</p>')
      + secao(res, 'funil', 'Funil de conversão', tabela(['Etapa', 'Resultado'], linha('Visitantes identificados nesta rota', null) + linha('Leads reais', res.fonte?.total?.leads) + linha('Qualificados', res.fonte?.total?.qualificados) + linha('Agendamentos conciliados', null)));
  }
  function temperaturas(res) {
    if (!res.meta) return secao(res, 'temperaturas', 'HOT / COLD', ausente('investimento de mídia indisponível'));
    const buckets = ['HOT', 'COLD', 'Sem classificação'];
    const classificar = r => /\[HOT\]/i.test(r.nome) ? 'HOT' : /\[COLD\]/i.test(r.nome) ? 'COLD' : 'Sem classificação';
    const linhas = buckets.map(tipo => ({ tipo, rows: res.meta.campanhas.filter(c => classificar(c) === tipo) })).filter(g => g.rows.length);
    return secao(res, 'temperaturas', 'HOT / COLD', tabela(['Temperatura', 'Investimento'], linhas.map(g => linha(g.tipo, soma(g.rows, 'spend'), D.fmtR)).join('') || '<tr><td colspan="2">Sem investimento por campanha no recorte.</td></tr>') + '<p class="nota-fonte">Classificação pelas tags explícitas do nome da campanha. Público sem tag permanece sem classificação.</p>');
  }
  function origens(res) {
    const paginas = res.fonte?.por_pagina || [], campanhas = res.fonte?.por_campanha || [];
    return secao(res, 'origens', 'Origens e páginas de captação', paginas.length ? tabela(['Página', 'Leads reais'], paginas.map(p => linha(p.pagina, p.leads)).join('')) : ausente('sem dimensão de página para este funil; formulário instantâneo permanece separado'))
      + secao(res, 'utm', 'UTM e identificação de campanha', campanhas.length ? tabela(['Campanha registrada', 'Leads reais'], campanhas.map(c => linha(c.campanha, c.leads)).join('')) + '<p class="nota-fonte">Etiquetas registradas na captação; não comprovam origem paga. Separação pago/orgânico indisponível sem conciliação.</p>' : ausente('não há etiquetas de campanha disponíveis no recorte'))
      + secao(res, 'leads', 'Leads e qualificação', tabela(['Dimensão agregada', 'Contatos'], linha('Leads únicos dentro deste funil', res.fonte?.total?.leads) + linha('Qualificados confirmados', res.fonte?.qualificacao?.confirmados) + linha('Qualificação indeterminada', res.fonte?.qualificacao?.indeterminados)) + `<p class="nota-fonte">${D.esc(res.fonte?.qualificacao?.regra || 'Regra de qualificação indisponível')}. Sem dados pessoais no painel.</p>`);
  }
  D.tabelasMidiaOperacao = function (res) {
    return ['conjuntos', 'anuncios'].map(key => {
      const titulo = key === 'conjuntos' ? 'Conjuntos de anúncios' : 'Anúncios';
      const rows = res.meta?.[key] || [];
      const falhou = !res.meta || res.meta.degradado.includes(key === 'anuncios' ? 'anúncios' : key);
      return secao(res, key, titulo, falhou ? ausente('fonte de mídia incompleta') : tabela(['Nome', 'Investimento', 'Meta reporta', 'Cliques'], rows.map(r => `<tr><td>${D.esc(r.nome)}</td><td class="num">${valor(r.spend, D.fmtR)}</td><td class="num">${valor(r.leads)}</td><td class="num">${valor(r.clicks)}</td></tr>`).join('') || '<tr><td colspan="4">Sem entrega no período para os IDs deste funil.</td></tr>'));
    }).join('');
  };
  D.secoesOperacao = function (res) {
    const link = 'https://lorenzo-painel.vercel.app/operacao/sevilha-performance/dashboard';
    const nav = [['tracking', 'Tracking'], ['ritmo', 'Metas e ritmo'], ['diario', 'Evolução'], ['canais', 'Canais'], ['temperaturas', 'HOT/COLD'], ['origens', 'Origens'], ['debriefing', 'Debriefing']];
    const ausencias = [['posicionamentos', 'Posicionamentos', 'a fonte atual agrega a conta inteira; a divisão por IDs deste funil ainda não está disponível'], ['paises', 'Países', 'sem leitura geográfica por funil'], ['demografia', 'Demografia', 'sem leitura de idade e gênero por funil']];
    return `<nav class="op-section-nav" aria-label="Seções do funil">${nav.map(([id, nome]) => `<a href="#${res.id}-${id}">${nome}</a>`).join('')}</nav>`
      + tracking(res) + secundarios(res) + metas(res) + evolucao(res) + canais(res)
      + (res.config.inicio ? secao(res, 'fases', 'Fases do lançamento', tabela(['Fase configurada', 'Janela'], `<tr><td>Captação</td><td>${D.fmtDia(res.config.inicio)} a ${D.fmtDia(res.config.fim)}</td></tr>`) + '<p class="nota-fonte">Investimento separado por aquecimento, captação e vendas: indisponível sem mapeamento de fases.</p>') : '')
      + D.tabelasMidiaOperacao(res) + temperaturas(res)
      + ausencias.map(([id, nome, texto]) => secao(res, id, nome, ausente(texto))).join('')
      + (!res.config.inicio ? secao(res, 'vendas', 'Vendas, receita e ROAS', ausente('vendas e receita ainda não conciliadas com esta rota de captação')) : '')
      + origens(res)
      + secao(res, 'debriefing', 'Debriefing', '<p class="nota-fonte">Os debriefings e registros operacionais vinculados ao funil ficam na Central autenticada da agência.</p>' + `<a class="op-link" href="${link}">Abrir dashboard e debriefings na Central →</a>`);
  };
})(window.SPD = window.SPD || {});
