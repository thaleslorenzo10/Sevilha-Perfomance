'use strict';

/**
 * Sevilha Performance — A/B Split Function
 * GET /campanha (via vercel.json rewrite → /api/ab)
 *
 * Divide o tráfego igualmente entre as 3 landing pages (33.3% cada).
 * O visitante fica na mesma variante via cookie _sp_variant (sticky 30 dias).
 * Repassa toda a query string (UTMs, fbclid, gclid…) para a página destino.
 * Registra cada visita na tabela page_views do Supabase.
 *
 * A mesma função atende POST /api/pageview (via rewrite): é o beacon das
 * páginas fora do rodízio. As duas entradas gravam na mesma tabela, e o plano
 * Hobby limita o deploy a 12 funções — separar custaria uma função por uma
 * dúzia de linhas.
 */

const { registrarVisita, ehBot, ipDaRequisicao, parametrosDe, tratarBeacon } = require('../lib/pageviews');

/**
 * Dois experimentos, um mecanismo. Cada oferta tem a sua entrada, as suas
 * páginas e o seu cookie — misturar os dois faria o visitante do Clube da
 * Performance carregar a variante da Sessão Estratégica e vice-versa.
 *
 *   /campanha    → Clube da Performance (escritórios até 10 colaboradores)
 *   /diagnostico → Sessão Estratégica  (escritórios acima de 10)
 */
const EXPERIMENTOS = {
  cp: {
    variantes: ['/', '/pre-inscricao-2', '/pre-inscricao-3'],
    cookie:    '_sp_variant',
    visitaNoRedirect: true,
  },
  se: {
    variantes: (process.env.AB_PAGINAS_SE || '/mentoria,/mentoria-2')
                 .split(',').map(s => s.trim()).filter(Boolean),
    cookie:    '_sp_variant_se',
    // Estas páginas têm beacon próprio (assets/tracking.js), porque também são
    // acessadas direto pelo anúncio, sem passar por aqui. Registrar a visita no
    // redirect TAMBÉM contaria a mesma pessoa duas vezes e cortaria a taxa de
    // conversão pela metade. Uma fonte por página: aqui, o beacon.
    visitaNoRedirect: false,
  },
};

const COOKIE_TTL_DAYS = 30;

/** O caminho decide o experimento; sem correspondência, o rodízio antigo. */
function experimentoDe(url) {
  return url.pathname.includes('diagnostico') ? EXPERIMENTOS.se : EXPERIMENTOS.cp;
}

module.exports = async function handler(req, res) {
  // ── 0. Beacon das páginas fora do rodízio ───────────────────────────────
  if (req.method === 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    return tratarBeacon(req, res);
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

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

  const incomingUrl = new URL(req.url, 'http://localhost');
  const experimento = experimentoDe(incomingUrl);
  const total       = experimento.variantes.length;

  let variant;
  const existing = parseInt(cookieMap[experimento.cookie], 10);
  if (!isNaN(existing) && existing >= 0 && existing < total) {
    variant = existing; // visitante recorrente — mesma variante
  } else {
    variant = Math.floor(Math.random() * total); // novo visitante — aleatorizar
  }

  // ── 2. Monta URL de destino com query string preservada ─────────────────
  const destination = experimento.variantes[variant];
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
  if (experimento.visitaNoRedirect && !ehBot(req.headers['user-agent'])) {
    await registrarVisita(pageViewPayload);
  }

  // ── 5. Redireciona com cookie sticky ─────────────────────────────────────
  const maxAge = COOKIE_TTL_DAYS * 24 * 60 * 60;
  res.setHeader('Set-Cookie',      `${experimento.cookie}=${variant}; Max-Age=${maxAge}; Path=/; SameSite=Lax; HttpOnly`);
  res.setHeader('Cache-Control',   'no-store, private');
  res.setHeader('Location',        redirectUrl);
  return res.status(302).end();
};
