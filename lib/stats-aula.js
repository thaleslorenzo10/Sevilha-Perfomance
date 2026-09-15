'use strict';

/**
 * GET /api/stats?modo=aula → { vendidos }
 *
 * Contador da barra do lote em /aula-gestao-operacional: compras pagas na
 * Kiwify (sevilha_compras_aula, status='paid'). Só o total do Content-Range —
 * nenhuma linha desce. Supabase ausente ou erro devolve 200 com
 * { vendidos: 0, indisponivel: true }: a barra soma isso ao vendidosFora do
 * config e nunca quebra por causa do endpoint.
 */

const { conexao, rest, totalDoContentRange } = require('./supabase');

const TABELA = 'sevilha_compras_aula';

async function contarPagas() {
  const c = conexao();
  if (!c) return null;
  const r = await fetch(rest(TABELA, 'select=order_id&status=eq.paid'), {
    headers: { ...c.headers, Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' },
  });
  // 416 = pedimos além do fim: tabela vazia, total zero.
  if (r.status === 416) return 0;
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return totalDoContentRange(r);
}

async function responderAula(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, max-age=60'); // o 405 de método é do api/stats.js
  try {
    const total = await contarPagas();
    if (total === null) return res.status(200).json({ vendidos: 0, indisponivel: true });
    return res.status(200).json({ vendidos: total });
  } catch (e) {
    console.warn('[stats aula] contador indisponível:', e.message);
    return res.status(200).json({ vendidos: 0, indisponivel: true });
  }
}

module.exports = { responderAula };
