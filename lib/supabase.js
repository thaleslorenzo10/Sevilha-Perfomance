'use strict';

/**
 * Nomes das tabelas do Supabase, em um lugar só.
 *
 * O banco é compartilhado entre clientes da Lorenzo Media e segue a convenção
 * `<cliente>_<dominio>`: sevilha_leads, sevilha_page_views, vava_leads,
 * festival_compras… Este projeto nasceu antes disso e escrevia em
 * `leads_sevilhaperfomance` / `page_views_sevilhaperfomance`, que hoje são
 * VIEWS de compatibilidade apontando para as tabelas novas — criadas para o
 * n8n continuar funcionando durante a migração, e marcadas como depreciadas no
 * próprio comentário da view.
 *
 * Escrever pela view funciona (elas são auto-atualizáveis), mas mantém viva uma
 * indireção que já tem data para morrer. Daqui em diante o código fala com as
 * tabelas reais, e quem quiser apontar para outro lugar sobrescreve por
 * ambiente — útil para rodar contra um projeto de teste sem tocar no código.
 */

const TABELAS = {
  leads:            process.env.SUPABASE_TABELA_LEADS      || 'sevilha_leads',
  pageViews:        process.env.SUPABASE_TABELA_PAGE_VIEWS || 'sevilha_page_views',
  eventosEnviados:  process.env.SUPABASE_TABELA_EVENTOS    || 'sevilha_eventos_enviados',
  eventosPagina:    process.env.SUPABASE_TABELA_EVENTOS_PAGINA || 'sevilha_eventos_pagina',
};

/** Credenciais + cabeçalhos do PostgREST, ou null quando não configurado. */
function conexao() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  return {
    url,
    headers: {
      'Content-Type':  'application/json',
      apikey:          key,
      Authorization:   `Bearer ${key}`,
    },
  };
}

/** URL REST de uma tabela — `TABELAS.leads`, não o nome cru. */
function rest(tabela, querystring = '') {
  const c = conexao();
  if (!c) return null;
  return `${c.url}/rest/v1/${tabela}${querystring ? `?${querystring}` : ''}`;
}

/**
 * GET paginado no PostgREST. O `fetchAll` antigo pedia uma página só: acima do
 * max-rows do servidor as contagens ficavam silenciosamente menores. A URL
 * precisa de `order=` para a paginação ser estável.
 */
/** Total do PostgREST em `Content-Range: <ini>-<fim>/<total>` — null quando ausente ou "*". */
function totalDoContentRange(r) {
  const cr = r.headers && typeof r.headers.get === 'function' ? r.headers.get('content-range') : null;
  const m = cr && /\/(\d+)$/.exec(cr);
  return m ? Number(m[1]) : null;
}

// Com o total do Content-Range sabemos exatamente quando parar, mesmo se o
// servidor entregar menos que PAG por página (max-rows configurado abaixo de
// 1000); sem o header (ex.: stubs de teste), volta ao critério antigo.
function acabou({ ini, lote, total, PAG }) {
  return total !== null ? (ini + lote.length >= total) : (lote.length < PAG || lote.length === 0);
}

async function lerTudo(url, headersExtra = {}) {
  const c = conexao();
  if (!c) throw new Error('Supabase não configurado');
  const PAG = 1000;
  const MAX_PAGINAS = 50; // teto contra período gigante gerando loop sem fim
  const linhas = [];
  let truncado = true;
  for (let pagina = 0, ini = 0; pagina < MAX_PAGINAS; pagina++, ini += PAG) {
    const r = await fetch(url, {
      headers: { ...c.headers, ...headersExtra, Prefer: 'count=exact', Range: `${ini}-${ini + PAG - 1}`, 'Range-Unit': 'items' },
    });
    if (r.status === 416) { truncado = false; break; } // pedimos além do fim: total era múltiplo exato da página
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const lote = await r.json();
    linhas.push(...lote);
    if (acabou({ ini, lote, total: totalDoContentRange(r), PAG })) { truncado = false; break; }
  }
  if (truncado) console.warn(`[supabase] lerTudo: atingiu o teto de ${MAX_PAGINAS} páginas — resultado pode estar truncado`);
  return linhas;
}

module.exports = { TABELAS, conexao, rest, lerTudo };
