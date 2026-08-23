'use strict';

/**
 * Sevilha Performance — A/B Split Function
 * GET /campanha (via vercel.json rewrite → /api/ab)
 *
 * Divide o tráfego igualmente entre as 3 landing pages (33.3% cada).
 * O visitante fica na mesma variante via cookie _sp_variant (sticky 30 dias).
 * Repassa toda a query string (UTMs, fbclid, gclid…) para a página destino.
 * Registra cada visita na tabela page_views do Supabase.
 */

const { registrarVisita, ehBot, ipDaRequisicao, parametrosDe } = require('../lib/pageviews');

const VARIANTS = ['/', '/pre-inscricao-2', '/pre-inscricao-3'];
const COOKIE_NAME = '_sp_variant';
const COOKIE_TTL_DAYS = 30;

module.exports = async function handler(req, res) {
  // ── 1. Lê cookie existente (sticky) ─────────────────────────────────────
  const rawCookie = req.headers['cookie'] || '';
  const cookieMap = Object.fromEntries(
    rawCookie.split(';')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const idx = s.indexOf('=');
        return idx > -1
          ? [s.slice(0, idx).trim(), s.slice(idx + 1).trim()]
          : [s.trim(), ''];
      })
  );

  let variant;
  const existing = parseInt(cookieMap[COOKIE_NAME], 10);
  if (!isNaN(existing) && existing >= 0 && existing <= 2) {
    variant = existing; // visitante recorrente — mesma variante
  } else {
    variant = Math.floor(Math.random() * 3); // novo visitante — aleatorizar
  }

  // ── 2. Monta URL de destino com query string preservada ─────────────────
  const destination = VARIANTS[variant];
  const incomingUrl = new URL(req.url, 'http://localhost');
  const queryString  = incomingUrl.searchParams.toString();
  const redirectUrl  = queryString ? `${destination}?${queryString}` : destination;

  // ── 3. Extrai UTMs e click IDs da query string ───────────────────────────
  const pageViewPayload = {
    variant,
    pagina:     destination,
    ...parametrosDe(incomingUrl.searchParams),
    user_agent: req.headers['user-agent'] || null,
    ip:         ipDaRequisicao(req),
  };

  // ── 4. Salva pageview no Supabase (ignora bots) ──────────────────────────
  if (!ehBot(req.headers['user-agent'])) {
    await registrarVisita(pageViewPayload);
  }

  // ── 5. Redireciona com cookie sticky ─────────────────────────────────────
  const maxAge = COOKIE_TTL_DAYS * 24 * 60 * 60;
  res.setHeader('Set-Cookie',      `${COOKIE_NAME}=${variant}; Max-Age=${maxAge}; Path=/; SameSite=Lax; HttpOnly`);
  res.setHeader('Cache-Control',   'no-store, private');
  res.setHeader('Location',        redirectUrl);
  return res.status(302).end();
};
