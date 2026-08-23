'use strict';

/**
 * Sevilha Performance — Beacon de visita
 * POST /api/pageview   body: { pagina, page_url, ...utms }
 *
 * As páginas do teste A/B ganham a visita no redirect /campanha. A /mentoria é
 * acessada direto pelo anúncio e não passa por lá, então quem registra é o
 * próprio navegador, via assets/tracking.js.
 *
 * `variant` fica null de propósito: a página não está no rodízio, e inventar um
 * número aqui contaminaria o comparativo do teste.
 */

const { registrarVisita, ehBot, ipDaRequisicao, parametrosDe } = require('../lib/pageviews');

// Só as páginas que precisam do beacon. Manter a lista curta impede que a
// mesma visita seja contada duas vezes (redirect + beacon) se alguém copiar o
// tracking.js para uma página que já está no rodízio.
const PAGINAS = (process.env.PAGEVIEW_BEACON_PAGES || '/mentoria')
  .split(',').map(s => s.trim()).filter(Boolean);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).end();

  const body   = req.body || {};
  const pagina = String(body.pagina || '').trim();

  if (!PAGINAS.includes(pagina)) {
    return res.status(400).json({ ok: false, motivo: 'pagina fora da lista do beacon' });
  }

  const userAgent = req.headers['user-agent'] || '';
  if (ehBot(userAgent)) {
    // 204 e não erro: o bot não precisa saber que foi filtrado, e o navegador
    // real nunca cai aqui.
    return res.status(204).end();
  }

  const params = new URLSearchParams(String(body.query || ''));

  const ok = await registrarVisita({
    variant:    null,
    pagina,
    ...parametrosDe(params),
    user_agent: userAgent,
    ip:         ipDaRequisicao(req),
  });

  return res.status(ok ? 201 : 200).json({ ok });
};
