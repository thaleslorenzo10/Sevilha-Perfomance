'use strict';
/**
 * /api/stats?modo=aula — contador da barra do lote da aula paga.
 *   node scripts/test-stats-aula.js
 * Sem rede: fetch é stubado com o Content-Range que o PostgREST devolve.
 */
let falhas = 0;
const ok = (c, d) => { console.log(`  ${c ? '✓' : '✗'} ${d}`); if (!c) falhas += 1; };

const chamadas = [];
function stubFetch(status, contentRange) {
  global.fetch = async (url, opts = {}) => {
    chamadas.push({ url: String(url), headers: opts.headers || {} });
    return { ok: status < 400, status, headers: { get: h => (h.toLowerCase() === 'content-range' ? contentRange : null) } };
  };
}
function req(method, url) { return { method, url, headers: {} }; }
function res() {
  const r = { code: 0, dado: null, cabecalhos: {} };
  r.status = c => { r.code = c; return r; };
  r.json = j => { r.dado = j; return r; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.cabecalhos[k] = v; return r; };
  return r;
}

const handler = require('../api/stats.js');
async function chamar(method = 'GET') {
  const r = res();
  await handler(req(method, '/api/stats?modo=aula'), r);
  return r;
}

/** 200 com exatamente este JSON. */
const responde = (r, esperado) => r.code === 200 && JSON.stringify(r.dado) === JSON.stringify(esperado);

(async () => {
  console.log('\n/api/stats?modo=aula');
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY;
  ok(responde(await chamar(), { vendidos: 0, indisponivel: true }), 'sem Supabase → 200 { vendidos: 0, indisponivel: true }');

  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'chave';
  stubFetch(206, '0-0/12');
  const r = await chamar();
  ok(responde(r, { vendidos: 12 }), 'Content-Range 0-0/12 → { vendidos: 12 }, sem baixar linhas');
  ok(r.cabecalhos['Cache-Control'] === 'public, max-age=60' && r.cabecalhos['Access-Control-Allow-Origin'] === '*', 'Cache-Control public, max-age=60 e CORS *');
  const c = chamadas[0];
  ok(/sevilha_compras_aula\?select=order_id&status=eq\.paid$/.test(c.url), 'consulta só status=paid');
  ok(c.headers.Prefer === 'count=exact' && c.headers.Range === '0-0', 'pede count=exact com Range 0-0');

  stubFetch(416, null);
  ok(responde(await chamar(), { vendidos: 0 }), 'tabela vazia (416) → { vendidos: 0 }');
  stubFetch(500, null);
  ok(responde(await chamar(), { vendidos: 0, indisponivel: true }), 'erro do Supabase → 200 { vendidos: 0, indisponivel: true }');
  ok((await chamar('POST')).code === 405, 'POST → 405');

  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
  process.exit(falhas ? 1 : 0);
})();
