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

module.exports = { TABELAS, conexao, rest };
