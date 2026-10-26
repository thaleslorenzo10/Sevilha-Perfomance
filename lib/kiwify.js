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
 * Falha CAPI retorna 503 para reentrega; falha CRM fica registrada: a compra já está gravada e a falha
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
const { classificar, centavos, NOMES } = require('./kiwify-produtos');

const TABELA   = 'sevilha_compras_aula';
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

/** approved_date vem em Brasília. Ausência não pode virar uma compra de hoje. */
function dataPagamento(aprovado) {
  const texto = String(aprovado || '');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(texto)) return null;
  const d = new Date(texto.replace(' ', 'T') + '-03:00');
  if (!Number.isFinite(d.getTime())) return null;
  const local = new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 16);
  return local === texto.replace(' ', 'T').slice(0, 16) ? d.toISOString() : null;
}

function registroDe(body) {
  const c = body.Customer || {};
  const t = body.TrackingParameters || {};
  const valor = centavos(body.Commissions?.charge_amount ?? body.charge_amount);
  return {
    order_id:       String(body.order_id),
    status:         body.order_status === 'refunded' ? 'refunded' : 'paid',
    email:          normalizarEmail(c.email || ''),
    nome:           c.full_name || null,
    telefone:       normalizarTelefone(c.mobile || '') || null,
    valor_centavos: valor,
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
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000), headers: { ...c.headers, ...(opts.headers || {}) } });
  if (!res.ok) {
    const erro = new Error(`Supabase ${res.status}`);
    erro.status = res.status;
    throw erro;
  }
  return res;
}

async function leadPeloSck(sck, email) {
  const filtro = sck ? `event_id=eq.${encodeURIComponent(sck)}` : `email=eq.${encodeURIComponent(email)}`;
  const url = rest(TABELAS.leads, `${filtro}&pagina=eq./aula-gestao-operacional&select=id,fbp,fbc,external_id,user_agent,page_url,utm_source,utm_medium,utm_campaign,utm_content,utm_term&order=created_at.desc&limit=1`);
  if (!url) return null;
  try { return (await (await sb(url)).json())[0] || null; } catch (e) { console.warn('[kiwify] lead não localizado:', String(e.message).slice(0, 120)); return null; }
}

async function existente(body) {
  const filtro = body.order_ref ? `payload->>order_ref=eq.${encodeURIComponent(body.order_ref)}` : `order_id=eq.${encodeURIComponent(body.order_id)}`;
  return (await (await sb(rest(TABELA, `${filtro}&select=order_id,status,payload,capi_status,crm_status,pago_em,valor_centavos&limit=1`))).json())[0] || null;
}

async function persistir(registro) {
  const resposta = await sb(rest('rpc/sevilha_registrar_compra_kiwify'), { method: 'POST', body: JSON.stringify({ registro: { ...registro, aprovacao_confirmada: !!dataPagamento(registro.payload?.approved_date) } }) });
  const salvo = await resposta.json();
  if (!salvo?.order_id) throw new Error('Persistência sem confirmação');
  return salvo;
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
    quandoMs: Date.parse(registro.pago_em), userAgent: lead?.user_agent,
  });
  const envio = await enviarEvento({
    evento: 'Purchase', eventId, quando: Math.floor(Date.parse(registro.pago_em) / 1000),
    userData, actionSource: lead?.user_agent ? 'website' : 'system_generated', seguro: true,
    sourceUrl: lead?.page_url || 'https://www.sevilhaperformance.com.br/aula-gestao-operacional',
    customData: { content_name: NOMES[classificar(registro.payload)], content_ids: [registro.order_id], currency: 'BRL', value: registro.valor_centavos / 100 },
  });
  if (envio.ok) await marcarEnviados([{ event_id: eventId, evento: 'Purchase', fonte: 'kiwify', enviado_em: new Date().toISOString() }]);
  return envio;
}

const crmFetch = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(8000) });

/** Deal [AULA] do contato (pelo e-mail) → stage "pago". */
async function avancarDeal(email) {
  const token = process.env.RD_CRM_TOKEN, stage = process.env.RD_CRM_STAGE_ID_AULA_PAGO;
  if (!token || !stage) return 'sem-config';
  const s = await crmFetch(`${CRM_BASE}/contacts?token=${token}&email=${encodeURIComponent(email)}`);
  if (!s.ok) return `erro:contato ${s.status}`;
  const contatos = (await s.json()).contacts || [];
  // A listagem devolve contatos "magros" (sem deal_ids) e o e-mail pode repetir em
  // mais de um contato — GET /contacts/:id é o único que traz o array completo.
  for (const contato of contatos) {
    const id = contato?._id || contato?.id;
    if (!id) continue;
    let dealIds = contato.deal_ids;
    const g = await crmFetch(`${CRM_BASE}/contacts/${id}?token=${token}`);
    if (g.ok) dealIds = (await g.json()).deal_ids;
    const ids = (dealIds || []).map(d => (typeof d === 'string' ? d : d._id || d.id)).filter(Boolean);
    for (const dealId of ids.reverse()) {
      const gd = await crmFetch(`${CRM_BASE}/deals/${dealId}?token=${token}`);
      if (!gd.ok) continue;
      const deal = await gd.json();
      if (!String(deal.name || '').startsWith('[AULA]')) continue;
      const p = await crmFetch(`${CRM_BASE}/deals/${dealId}?token=${token}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal: { deal_stage_id: stage } }),
      });
      return p.ok ? 'ok' : `erro:deal ${p.status}`;
    }
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
  if (!body.order_id || !body.Customer?.email) return res.status(400).json({ error: 'dados_invalidos' });
  try {
    const anterior = await existente(body);
    const registro = registroDe(body);
    if (tipo === 'order_refunded' && anterior) {
      registro.pago_em ||= anterior.pago_em;
      registro.valor_centavos ??= anterior.valor_centavos;
      if (!body.Product) registro.payload = { ...body, Product: anterior.payload?.Product };
    }
    if (!registro.pago_em || registro.valor_centavos == null || !registro.payload.Product?.product_name || (tipo === 'order_approved' && body.order_status !== 'paid')) return res.status(400).json({ error: 'compra_invalida' });
    const tipoProduto = classificar(registro.payload);
    if (tipo === 'order_approved' && anterior?.status === 'refunded') return res.status(200).json({ ok: true, status: 'refunded', repetido: true });
    if (tipo === 'order_refunded') {
      await persistir({ ...registro, status: 'refunded' });
      return res.status(200).json({ ok: true, status: 'refunded' });
    }
    const retroativo = !!anterior?.payload?.importacao;
    if (!['aula', 'gravacao'].includes(tipoProduto) || retroativo) {
      await persistir({ ...registro, capi_status: retroativo ? 'nao_enviado_retroativo' : 'nao_aplicavel', crm_status: 'nao_aplicavel' });
      return res.status(200).json({ ok: true, persistido: true, integracoes: 'preservadas_ou_nao_aplicaveis' });
    }
    const lead = await leadPeloSck(registro.sck, registro.email);
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      if (!registro[k] && lead?.[k]) registro[k] = lead[k];
    }
    const salvo = await persistir({ ...registro, lead_id: lead?.id || null, capi_status: 'pendente' });
    if (salvo.status === 'refunded' || salvo.payload?.importacao) return res.status(200).json({ ok: true, repetido: true });
    registro.order_id = salvo.order_id;
    const envio = salvo.capi_status === 'ok' ? { ok: true, repetido: true } : await enviarPurchase(registro, lead);
    const capiStatus = envio.ok ? 'ok' : `erro:${String(envio.erro || '').slice(0, 120)}`;
    let crmStatus = salvo.crm_status || 'sem-config';
    try { if (crmStatus !== 'ok') crmStatus = tipoProduto === 'aula' ? await avancarDeal(registro.email) : 'nao_aplicavel'; } catch (e) { crmStatus = `erro:${e.message}`.slice(0, 120); }
    await atualizar(registro.order_id, { capi_status: capiStatus, crm_status: crmStatus });
    console.log(`[kiwify] ${registro.order_id} capi=${capiStatus} crm=${crmStatus}`);
    return res.status(envio.ok ? 200 : 503).json({ ok: envio.ok, capi: capiStatus, crm: crmStatus });
  } catch (e) {
    // Sem gravação não há o que confirmar: 503 faz a Kiwify tentar de novo.
    console.error('[kiwify] falha:', String(e.message).slice(0, 120));
    return res.status(503).json({ error: 'Falha ao gravar a compra.' });
  }
}

module.exports = { tratarKiwify, assinaturaConfere, registroDe };
