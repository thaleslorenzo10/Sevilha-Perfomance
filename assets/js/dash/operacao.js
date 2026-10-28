'use strict';
/* Funis independentes: nenhuma métrica geral é reaproveitada como resultado do funil. */
(function (D) {
  const CONFIG = {
    'se-formulario': { funil: 'sessao_formulario', nome: 'Captação por formulário', tipo: 'Perpétuo', descricao: 'Sessão Estratégica · formulário instantâneo do Meta' },
    'se-site': { funil: 'sessao_site', nome: 'Captação pela página do site', tipo: 'Perpétuo', descricao: 'Sessão Estratégica · páginas da consultoria' },
    'aula-2026-10-27': { funil: 'aula', nome: 'Aula · 27 de outubro', tipo: 'Lançamento', inicio: '2026-10-14', fim: '2026-10-27', descricao: 'Gestão Operacional · aula e gravação' },
    'cafe-2026-11-11': { funil: 'cafe', nome: 'Café · 11 de novembro', tipo: 'Lançamento', inicio: '2026-10-14', fim: '2026-11-11', descricao: 'Café com Sevilha · inscrições' },
    'aula-2026-10-06': { funil: 'aula', nome: 'Aula · 6 de outubro', tipo: 'Lançamento', inicio: '2026-09-17', fim: '2026-10-06', descricao: 'Gestão Operacional · histórico' },
  };
  let ativa = '', since = '', until = '', versao = 0;
  const cache = new Map();
  const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const num = (n, fmt = D.fmtN) => n == null ? '—' : fmt(n);
  const soma = (rs, campo) => rs.reduce((s, r) => s + (Number(r[campo]) || 0), 0);
  const titulo = (nome, sub, periodo) => `<div class="op-heading"><div><p class="op-eyebrow">Sevilha Performance · Lorenzo Media</p><h2>${D.esc(nome)}</h2><p class="op-description">${D.esc(sub)}</p></div><span class="op-period">${D.esc(periodo)}</span></div>`;
  const periodoTexto = p => p ? `${D.fmtDia(p.since)} a ${D.fmtDia(p.until)}` : 'Período indisponível';
  const kpi = (nome, valor, fmt, sub = '') => `<div class="kpi-card"><div class="kpi-label">${nome}</div><div class="kpi-value">${num(valor, fmt)}</div><div class="kpi-sub">${D.esc(sub)}</div></div>`;
  const fonteBoa = f => f.disponivel === true;

  D.periodoFunilOperacao = function (id, s, u) {
    const c = CONFIG[id];
    return c.inicio ? { since: c.inicio, until: c.fim < hoje() ? c.fim : hoje() } : { since: s, until: u };
  };
  D.metaFunilOperacao = function (meta, fonte) {
    if (!meta || !Array.isArray(fonte.campaign_ids) || !fonte.campaign_ids.length) return null;
    const ids = new Set(fonte.campaign_ids.map(String));
    const campanhas = (meta.campanhas || []).filter(c => ids.has(String(c.id)));
    const diario = Array.isArray(meta.serie_campanhas) ? meta.serie_campanhas.filter(d => ids.has(String(d.campaign_id))).map(d => ({ ...d, data: d.date_start })) : null;
    const completo = diario && diario.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.data) && Number.isFinite(d.spend) && d.spend >= 0) && Math.abs(soma(diario, 'spend') - soma(campanhas, 'spend')) < 0.02;
    return { diario: completo ? diario : null, campanhas, conjuntos: (meta.conjuntos || []).filter(c => ids.has(String(c.campaign_id))), anuncios: (meta.anuncios || []).filter(c => ids.has(String(c.campaign_id))), degradado: meta.degradado || [], total: { spend: soma(campanhas, 'spend'), leads: soma(campanhas, 'leads'), impressions: soma(campanhas, 'impressions'), clicks: soma(campanhas, 'clicks') } };
  };
  D.carregarFunilOperacao = function (id, s, u) {
    const c = CONFIG[id], p = D.periodoFunilOperacao(id, s, u), key = `${id}|${p.since}|${p.until}`;
    if (cache.has(key)) return cache.get(key);
    const qs = new URLSearchParams({ modo: 'operacao', funil: c.funil, since: p.since, until: p.until });
    if (c.inicio) qs.set('edicao', id);
    const pedido = Promise.allSettled([
      fetch(`/api/stats?${qs}`, { cache: 'no-store' }).then(async r => { if (!r.ok) throw new Error('Fonte de resultados indisponível'); return r.json(); }),
      D.buscarMeta(p.since, p.until),
    ]).then(([f, m]) => {
      const fonte = f.status === 'fulfilled' ? f.value : null;
      if (fonte && (fonte.cliente !== 'sevilha-performance' || fonte.funil !== c.funil || fonte.periodo?.since !== p.since || fonte.periodo?.until !== p.until || (c.inicio && fonte.edicao !== id))) throw new Error('A fonte retornou outro funil ou período.');
      return { id, config: c, periodo: p, fonte, meta: fonte && m.status === 'fulfilled' && m.value.periodo?.since === p.since && m.value.periodo?.until === p.until ? D.metaFunilOperacao(m.value, fonte) : null };
    });
    cache.set(key, pedido); pedido.catch(() => cache.delete(key));
    return pedido;
  };
  D.linhasFunilOperacao = function (res) {
    const { fonte, meta } = res;
    const leads = fonte?.por_campanha || [], midia = meta?.campanhas || [];
    const nomes = [...new Set([...midia.map(r => r.nome), ...leads.map(r => r.campanha)])];
    return nomes.map(nome => {
      const ms = midia.filter(r => r.nome === nome), ls = leads.filter(r => r.campanha === nome);
      return { nome, spend: meta && ms.length ? soma(ms, 'spend') : null, leads: fonte?.total && ls.length ? soma(ls, 'leads') : null, qualificados: fonte?.total && ls.length && ls.every(r => r.qualificados != null) ? soma(ls, 'qualificados') : null, meta_reporta: meta && ms.length ? soma(ms, 'leads') : null };
    });
  };
  function tabela(tituloTabela, linhas, colunas) {
    return `<section class="section"><div class="section-title">${tituloTabela}</div><div class="table-wrap"><table><thead><tr>${colunas.map(c => `<th${c[0] === 'nome' ? '' : ' class="num"'}>${c[1]}</th>`).join('')}</tr></thead><tbody>${linhas.length ? linhas.map(r => `<tr>${colunas.map(c => `<td${c[0] === 'nome' ? '' : ' class="num"'}>${c[0] === 'nome' ? D.esc(r[c[0]] || 'Sem identificação') : num(r[c[0]], c[2] || D.fmtN)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${colunas.length}" class="vazio">Sem dados disponíveis neste recorte.</td></tr>`}</tbody></table></div></section>`;
  }
  function aviso(res) {
    const fonte = res.fonte, faltas = [];
    if (fonte?.total?.leads == null) faltas.push('Leads e qualificação indisponíveis.');
    if (!res.meta) faltas.push('Investimento e entrega de mídia indisponíveis.');
    const indef = fonte?.qualificacao?.indeterminados;
    if (indef) faltas.push(`${D.fmtN(indef)} contatos com qualificação indeterminada; o total de qualificados fica indisponível.`);
    return faltas.length ? `<div class="banner banner-warn show" role="status">${faltas.map(D.esc).join(' ')}</div>` : '';
  }
  function resumoCard(res) {
    const c = res.config, t = res.fonte?.total;
    const comercial = c.funil === 'aula' ? `<div><dt>Inscrições pagas</dt><dd>${num(res.fonte?.compras?.aula?.pagas)}</dd></div><div><dt>Receita dos produtos</dt><dd>${num(res.fonte?.compras?.combinado?.receita, D.fmtR)}</dd></div>` : '';
    return `<article class="op-funnel"><p class="op-eyebrow">${c.tipo}</p><h3>${D.esc(c.nome)}</h3><p class="op-description">${D.esc(c.descricao)} · ${periodoTexto(res.periodo)}</p><dl class="op-metrics"><div><dt>Investimento</dt><dd>${num(res.meta?.total.spend, D.fmtR)}</dd></div><div><dt>Leads reais</dt><dd>${num(t?.leads)}</dd></div><div><dt>Qualificados</dt><dd>${num(t?.qualificados)}</dd></div>${comercial}</dl>${aviso(res)}<a class="op-link" href="#${res.id}" data-tab="${res.id}">Ver funil completo →</a></article>`;
  }
  function detalhe(res) {
    const { fonte: f, meta: m, config: c } = res, t = f?.total;
    const cols = [['nome', 'Campanha'], ['spend', 'Investimento', D.fmtR], ['leads', 'Leads reais'], ['qualificados', 'Qualificados'], ['meta_reporta', 'Meta reporta']];
    const fontes = f?.fontes || [];
    const confirmados = f?.qualificacao?.confirmados;
    const custos = m && t?.leads > 0 ? m.total.spend / t.leads : null;
    return titulo(c.nome, c.descricao, periodoTexto(res.periodo)) + aviso(res)
      + `<div class="op-kpis">${kpi('Investimento Meta', m?.total.spend, D.fmtR)}${kpi('Leads reais', t?.leads)}${kpi('Qualificados confirmados', confirmados, D.fmtN, f?.qualificacao?.regra || '')}${kpi('Custo médio por lead', custos, D.fmtR, 'Mídia ÷ todos os leads do funil')}${kpi('Taxa de qualificação', t?.qualificados == null || !t.leads ? null : 100 * t.qualificados / t.leads, D.fmtP)}${kpi('Agendamentos', null)}${kpi('Vendas', null)}${kpi('Receita', null, D.fmtR)}${kpi('ROAS atribuído', null)}</div>`
      + '<p class="op-table-note">O custo médio inclui os leads sem atribuição paga e não comprova atribuição individual. Leads reais e leads reportados pelo Meta são medidas distintas; não são somados.</p>'
      + `<section class="section"><div class="section-title">Fontes e acompanhamento</div><ul class="op-health">${fontes.map(v => `<li data-ok="${fonteBoa(v)}">${D.esc(v.nome)} · ${fonteBoa(v) ? 'disponível' : 'indisponível'}</li>`).join('')}</ul><p class="nota-fonte">Agendamentos e vendas desta rota: indisponíveis enquanto não houver conciliação por funil. O histórico comercial completo continua em Análises e histórico.</p></section>`
      + tabela('Campanhas do funil', D.linhasFunilOperacao(res), cols) + D.secoesOperacao(res);
  }
  async function carregar() {
    if (!['perpetuos', 'lancamentos', 'se-formulario', 'se-site'].includes(ativa) || !since || !until) return;
    const tab = ativa, atual = ++versao, el = document.getElementById('painel-' + tab);
    const lancamento = tab === 'lancamentos', overview = lancamento || tab === 'perpetuos';
    const ids = overview ? (lancamento ? ['aula-2026-10-27', 'cafe-2026-11-11', 'aula-2026-10-06'] : ['se-formulario', 'se-site']) : [tab];
    el.innerHTML = '<p role="status">Carregando os resultados por funil…</p>';
    const resultados = await Promise.allSettled(ids.map(id => D.carregarFunilOperacao(id, since, until)));
    if (atual !== versao) return;
    const rs = resultados.map((r, i) => r.status === 'fulfilled' ? r.value : { id: ids[i], config: CONFIG[ids[i]], periodo: D.periodoFunilOperacao(ids[i], since, until), fonte: null, meta: null });
    if (overview) {
      el.innerHTML = titulo(lancamento ? 'Visão geral dos lançamentos' : 'Visão geral dos perpétuos', lancamento ? 'Cada edição mantém seus resultados e seu período de captação.' : 'Sessão Estratégica · captação por formulário e pela página do site.', lancamento ? 'Acumulado de cada lançamento' : periodoTexto({ since, until })) + `<div class="op-grid">${rs.map(resumoCard).join('')}</div>`;
    } else {
      el.innerHTML = detalhe(rs[0]);

    }
  }
  D.abrirOperacao = function (nome) {
    ativa = nome; ++versao;
    document.body.classList.toggle('op-scoped', ['perpetuos', 'lancamentos', 'se-formulario', 'se-site'].includes(nome));
    document.body.classList.toggle('op-launch', nome === 'lancamentos' || !!CONFIG[nome]?.inicio);
    if (since) document.getElementById('periodBadge').textContent = nome === 'lancamentos' || CONFIG[nome]?.inicio ? 'Acumulado do lançamento' : periodoTexto({ since, until });
    carregar();
  };
  D.periodoOperacao = function (s, u) { since = s; until = u; cache.clear(); ++versao; if (ativa === 'lancamentos' || CONFIG[ativa]?.inicio) document.getElementById('periodBadge').textContent = 'Acumulado do lançamento'; carregar(); };
})(window.SPD = window.SPD || {});
