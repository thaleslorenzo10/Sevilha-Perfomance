'use strict';

/**
 * Registro de visita, compartilhado por duas entradas:
 *
 *   • /api/ab      — o redirect do teste A/B, que já sabe a variante sorteada.
 *   • /api/pageview — beacon das páginas fora do rodízio (a /mentoria é acessada
 *     direto pelo anúncio, sem passar pelo redirect; sem beacon ela não teria
 *     visita registrada e nenhuma taxa de conversão seria calculável).
 *
 * Bot não conta: inflaria o denominador da conversão sem nunca preencher
 * formulário. E o IP é truncado antes de sair daqui (LGPD) — o último octeto
 * não acrescenta nada a uma métrica agregada e é o que individualiza a pessoa.
 *
 * `variant` só existe para o rodízio: página fora dele grava NULL. A coluna era
 * NOT NULL até a migração `sevilha_page_views_variant_nullable` — quem mexer no
 * esquema precisa manter isso, senão o beacon volta a falhar em produção sem
 * nenhum teste local acusar (fetch simulado não valida constraint de banco).
 */

const { TABELAS, conexao } = require('./supabase');

const BOT_PATTERN = /bot|crawl|slurp|spider|mediapartners|google|baidu|bing|msn|teoma|yahoo|ask/i;

const PARAMETROS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ttclid', 'msclkid',
];

function ehBot(userAgent) {
  return BOT_PATTERN.test(userAgent || '');
}

/** 1.2.3.4 → 1.2.3.0. IPv6 fica como está: não há octeto final a cortar. */
function truncarIp(ip) {
  if (!ip) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.replace(/\.\d+$/, '.0');
  return ip;
}

function ipDaRequisicao(req) {
  const encaminhado = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return truncarIp(encaminhado || req.socket?.remoteAddress || '');
}

/** Extrai UTMs e click ids de um URLSearchParams, com null no lugar de vazio. */
function parametrosDe(searchParams) {
  const out = {};
  for (const chave of PARAMETROS) out[chave] = searchParams.get(chave) || null;
  return out;
}

/**
 * Grava a visita. Nunca lança: métrica não pode derrubar navegação nem cadastro.
 * Devolve true quando a linha entrou.
 */
async function registrarVisita(dados) {
  const c = conexao();
  if (!c) return false;

  try {
    const res = await fetch(`${c.url}/rest/v1/${TABELAS.pageViews}`, {
      method:  'POST',
      headers: { ...c.headers, Prefer: 'return=minimal' },
      body:    JSON.stringify(dados),
    });

    if (!res.ok) {
      console.error('[pageview error]', res.status, await res.text());
      return false;
    }
    console.log(`[pageview OK] pagina=${dados.pagina} variant=${dados.variant ?? '—'}`);
    return true;
  } catch (e) {
    console.error('[pageview exception]', e.message);
    return false;
  }
}

module.exports = { registrarVisita, ehBot, truncarIp, ipDaRequisicao, parametrosDe, PARAMETROS };
