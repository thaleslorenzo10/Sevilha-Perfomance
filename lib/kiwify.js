'use strict';

/**
 * Webhook da Kiwify para a aula paga (/aula-gestao-operacional).
 *
 * Entra por rewrite em /api/kiwify-webhook → api/eventos-qualificados.js,
 * porque o plano Hobby está em 12/12 functions. O que faz:
 *   1. valida a assinatura (HMAC-SHA1 de JSON.stringify(body) com o token);
 *   2. order_approved → upsert em sevilha_compras_aula + Purchase na CAPI +
 *      deal [AULA] do contato avança para o stage "pago" no RD CRM;
 *   3. order_refunded → só atualiza o status;
 *   4. qualquer outro evento → 200 sem ação (não-2xx faz a Kiwify reenviar).
 *
 * Responde 200 mesmo com CAPI ou CRM fora: a compra já está gravada e a falha
 * fica em capi_status/crm_status. Purchase é deduplicado por
 * sevilha_eventos_enviados (event_id kiwify:<order_id>).
 *
 * Envs: KIWIFY_WEBHOOK_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY,
 *       META_CAPI_TOKEN, RD_CRM_TOKEN, RD_CRM_STAGE_ID_AULA_PAGO
 */

const crypto = require('crypto');
const { enviarEvento, montarUserData, normalizarEmail, normalizarTelefone } = require('./capi');
const { jaEnviados, marcarEnviados } = require('./eventos-enviados');
const { conexao, rest, TABELAS } = require('./supabase');

const TABELA   = 'sevilha_compras_aula';
const ROTULO   = 'Aula Gestão Operacional';
const CRM_BASE = 'https://crm.rdstation.com/api/v1';

/**
 * Verificação documentada pela própria Kiwify: o exemplo Node deles assina
 * JSON.stringify(req.body). Ler o stream bruto não é opção aqui — bodyParser:false
 * quebraria o cron e o webhook do RD, que dividem a mesma function.
 */
function assinaturaConfere(req) {
  const token = process.env.KIWIFY_WEBHOOK_TOKEN;
  if (!token) { console.warn('[kiwify] KIWIFY_WEBHOOK_TOKEN não configurado'); return false; }
  const url = new URL(String(req.url || ''), 'http://localhost');
  const recebida = url.searchParams.get('signature') || '';
  const esperada = crypto.createHmac('sha1', token).update(JSON.stringify(req.body || {})).digest('hex');
  const a = Buffer.from(recebida), b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** approved_date vem "YYYY-MM-DD HH:mm" em Brasília; formato inesperado cai no agora. */
function dataPagamento(aprovado) {
  const d = new Date(String(aprovado || '').replace(' ', 'T') + '-03:00');
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

function registroDe(body) {
  const c = body.Customer || {};
  const t = body.TrackingParameters || {};
  const centavos = Number(body.Commissions?.charge_amount ?? body.charge_amount ?? 0);
  return {
    order_id:       String(body.order_id),
    status:         body.order_status === 'refunded' ? 'refunded' : 'paid',
    email:          normalizarEmail(c.email || ''),
    nome:           c.full_name || null,
    telefone:       normalizarTelefone(c.mobile || '') || null,
    valor_centavos: Number.isFinite(centavos) ? centavos : 0,
    sck:            t.sck || null,
    utm_source:     t.utm_source   || null,
    utm_medium:     t.utm_medium   || null,
    utm_campaign:   t.utm_campaign || null,
    utm_content:    t.utm_content  || null,
    utm_term:       t.utm_term     || null,
    pago_em:        dataPagamento(body.approved_date),
    payload:        body,
    updated_at:     new Date().toISOString(),
  };
}

async function sb(url, opts = {}) {
  const c = conexao();
  if (!c) throw new Error('Supabase não configurado');
  const res = await fetch(url, { ...opts, headers: { ...c.headers, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res;
}

async function leadPeloSck(sck, email) {
  const filtro = sck ? `event_id=eq.${encodeURIComponent(sck)}` : `email=eq.${encodeURIComponent(email)}`;
  const url = rest(TABELAS.leads, `${filtro}&select=id,fbp,fbc,external_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term&order=created_at.desc&limit=1`);
  if (!url) return null;
  try { return (await (await sb(url)).json())[0] || null; } catch (e) { console.warn('[kiwify] lead não localizado:', String(e.message).slice(0, 120)); return null; }
}

async function upsert(registro) {
  await sb(rest(TABELA, 'on_conflict=order_id'), {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(registro),
  });
}

async function atualizar(orderId, campos) {
  await sb(rest(TABELA, `order_id=eq.${encodeURIComponent(orderId)}`), {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(campos),
  });
}

async function enviarPurchase(registro, lead) {
  const eventId = `kiwify:${registro.order_id}`;
  let repetido;
  try { repetido = (await jaEnviados([eventId])).has(eventId); } catch (e) { return { ok: false, erro: `dedupe: ${e.message}` }; }
  if (repetido) return { ok: true, repetido: true };
  const userData = montarUserData({
    email: registro.email, telefone: registro.telefone, nome: registro.nome, pais: 'br',
    externalId: [lead?.external_id, registro.email], fbp: lead?.fbp, fbc: lead?.fbc,
    quandoMs: Date.parse(registro.pago_em),
  });
  const envio = await enviarEvento({
    evento: 'Purchase', eventId, quando: Math.floor(Date.parse(registro.pago_em) / 1000),
    userData, actionSource: 'website',
    customData: { content_name: ROTULO, content_ids: [registro.order_id], currency: 'BRL', value: registro.valor_centavos / 100 },
  });
  if (envio.ok) await marcarEnviados([{ event_id: eventId, evento: 'Purchase', fonte: 'kiwify', enviado_em: new Date().toISOString() }]);
  return envio;
}

/** Deal [AULA] do contato (pelo e-mail) → stage "pago". */
async function avancarDeal(email) {
  const token = process.env.RD_CRM_TOKEN, stage = process.env.RD_CRM_STAGE_ID_AULA_PAGO;
  if (!token || !stage) return 'sem-config';
  const s = await fetch(`${CRM_BASE}/contacts?token=${token}&email=${encodeURIComponent(email)}`);
  if (!s.ok) return `erro:contato ${s.status}`;
  const contato = ((await s.json()).contacts || [])[0];
  const ids = (contato?.deal_ids || []).map(d => (typeof d === 'string' ? d : d._id || d.id)).filter(Boolean);
  for (const id of ids.reverse()) {
    const g = await fetch(`${CRM_BASE}/deals/${id}?token=${token}`);
    if (!g.ok) continue;
    const deal = await g.json();
    if (!String(deal.name || '').startsWith('[AULA]')) continue;
    const p = await fetch(`${CRM_BASE}/deals/${id}?token=${token}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal: { deal_stage_id: stage } }),
    });
    return p.ok ? 'ok' : `erro:deal ${p.status}`;
  }
  return 'sem-deal';
}

async function tratarKiwify(req, res) {
  const body = req.body || {};
  const tipo = body.webhook_event_type;
  if (!assinaturaConfere(req)) {
    console.warn(`[kiwify] assinatura inválida tipo=${tipo} order_id=${body.order_id}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (tipo !== 'order_approved' && tipo !== 'order_refunded') {
    return res.status(200).json({ ok: true, ignorado: tipo });
  }
  try {
    const registro = registroDe(body);
    if (tipo === 'order_refunded') {
      await upsert({ ...registro, status: 'refunded' });
      return res.status(200).json({ ok: true, status: 'refunded' });
    }
    const lead = await leadPeloSck(registro.sck, registro.email);
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      if (!registro[k] && lead?.[k]) registro[k] = lead[k];
    }
    await upsert({ ...registro, lead_id: lead?.id || null, capi_status: 'pendente' });
    const envio = await enviarPurchase(registro, lead);
    const capiStatus = envio.ok ? 'ok' : `erro:${String(envio.erro || '').slice(0, 120)}`;
    let crmStatus = 'sem-config';
    try { crmStatus = await avancarDeal(registro.email); } catch (e) { crmStatus = `erro:${e.message}`.slice(0, 120); }
    await atualizar(registro.order_id, { capi_status: capiStatus, crm_status: crmStatus });
    console.log(`[kiwify] ${registro.order_id} capi=${capiStatus} crm=${crmStatus}`);
    return res.status(200).json({ ok: true, capi: capiStatus, crm: crmStatus });
  } catch (e) {
    // Sem gravação não há o que confirmar: 503 faz a Kiwify tentar de novo.
    console.error('[kiwify] falha:', String(e.message).slice(0, 120));
    return res.status(503).json({ error: 'Falha ao gravar a compra.' });
  }
}

module.exports = { tratarKiwify, assinaturaConfere, registroDe };
