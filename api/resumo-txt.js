'use strict';

/**
 * Sevilha Performance — resumo em texto
 * GET /api/resumo.json?p=7d|30d|mes   (rewrite para /api/resumo-txt)
 *
 * Devolve { texto } para o n8n usar como legenda da imagem no WhatsApp,
 * junto com os números soltos caso alguém queira montar outra mensagem.
 */

const { montarResumo, montarTexto } = require('../lib/resumo');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const p = new URL(req.url, 'http://localhost').searchParams.get('p') || '7d';

  try {
    const resumo = await montarResumo(p);
    return res.status(200).json({ texto: montarTexto(resumo), ...resumo });
  } catch (err) {
    console.error('[api/resumo-txt]', err.message);
    return res.status(502).json({ error: err.message });
  }
};
