'use strict';

/**
 * Webhook de conversão do RD Station Marketing → Supabase.
 *
 * A campanha [CAFÉ COM SEVILHA] leva para uma landing page do RD, então o lead
 * nasce lá e nenhuma fonte do painel o via. Ler a API do RD Marketing exigiria
 * OAuth; o webhook é configurado na interface do RD (Integrações → Webhooks,
 * evento "Conversão") e só precisa de um segredo na URL:
 *
 *   POST https://sevilha-perfomance.vercel.app/api/respondi?fonte=rd-marketing&token=<RD_MARKETING_WEBHOOK_SECRET>
 *
 * Servido por api/respondi.js (limite de 12 funções do plano). Só registra:
 * CRM, CAPI e planilha do Café continuam sendo feitos pelo próprio RD.
 *
 * Idempotência: event_id = rd:<uuid do contato>; antes de inserir, consulta.
 * Reenvio do RD (ele repete quando não recebe 200) não vira lead duplicado.
 */

const crypto = require('crypto');
const { TABELAS, conexao } = require('./supabase');
const { norm } = require('./texto');

function segredoConfere(req) {
  const esperado = process.env.RD_MARKETING_WEBHOOK_SECRET || '';
  if (!esperado) return false;
  const daQuery = new URL(req.url || '/', 'http://localhost').searchParams.get('token') || '';
  const a = Buffer.from(esperado), b = Buffer.from(daQuery);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function corpoComoObjeto(body) {
  if (!body) return null;
  if (typeof body === 'string') { try { return JSON.parse(body); } catch { return null; } }
  return typeof body === 'object' ? body : null;
}

/** O RD manda { leads: [...] }; aceita também um contato solto ou uma lista. */
function contatosDe(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.leads)) return payload.leads;
  if (payload.lead && typeof payload.lead === 'object') return [payload.lead];
  return [payload];
}

/** Primeiro valor não vazio cuja chave passa no teste (campos custom do RD são cf_<nome>). */
function achar(obj, teste) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (teste(norm(k)) && v !== null && v !== undefined && String(v).trim()) return String(v).trim();
  }
  return '';
}

const identificadorDe = conteudo => conteudo.identificador || conteudo.conversion_identifier || 'rd';
const emailDe = (c, conteudo) => c.email || conteudo.email_lead || conteudo.email || null;
const nomeDe = (c, conteudo) => c.name || conteudo.name || conteudo.nome || null;
const telefoneDe = (c, conteudo) => c.mobile_phone || c.personal_phone || conteudo.mobile_phone || conteudo.personal_phone || null;
const uuidDe = (c, conteudo, email, identificador) => c.uuid || c.id || conteudo.uuid
  || crypto.createHash('sha256').update(`${email}|${identificador}`).digest('hex').slice(0, 32);

/** Nome, e-mail, telefone e o uuid que vira event_id (derivado do e-mail quando o RD não manda um). */
function contatoDe(c, conteudo) {
  const identificador = identificadorDe(conteudo);
  const email = emailDe(c, conteudo);
  return {
    nome:     nomeDe(c, conteudo),
    email,
    telefone: telefoneDe(c, conteudo),
    identificador,
    uuid:     uuidDe(c, conteudo, email, identificador),
  };
}

function utmsDe(conteudo, origem) {
  return {
    utm_source:   conteudo.traffic_source   || origem.source   || null,
    utm_medium:   conteudo.traffic_medium   || origem.medium   || null,
    utm_campaign: conteudo.traffic_campaign || origem.campaign || null,
    utm_content:  conteudo.traffic_content  || origem.content  || null,
    utm_term:     conteudo.traffic_value    || origem.value    || null,
  };
}

// Data da conversão no RD, quando o contato traz uma: grava o lead com o
// horário real em vez do default do banco (o momento em que o webhook chegou).
const quandoDe = (c, conv, conteudo) => conv.created_at || conteudo.created_at || c.created_at || c.last_conversion_date;

function leadDe(c) {
  const conv = c.last_conversion || c.conversion || {};
  const conteudo = conv.content || conv;
  const origem = conv.conversion_origin || c.conversion_origin || {};
  const contato = contatoDe(c, conteudo);
  const convertidoEm = quandoDe(c, conv, conteudo);
  return {
    nome:     contato.nome,
    email:    contato.email,
    telefone: contato.telefone,
    pagina:   `rd:${contato.identificador}`,
    ...utmsDe(conteudo, origem),
    colaboradores: achar(conteudo, k => k.includes('colaborador')) || achar(c, k => k.includes('colaborador')) || null,
    cargo:        achar(conteudo, k => k.includes('cargo') || k.includes('posicao')) || null,
    event_id:     `rd:${contato.uuid}`,
    ...(convertidoEm ? { created_at: convertidoEm } : {}),
  };
}

async function gravarSeNovo(lead) {
  const c = conexao();
  if (!c) throw new Error('Supabase não configurado');
  const ja = await fetch(`${c.url}/rest/v1/${TABELAS.leads}?select=id&event_id=eq.${encodeURIComponent(lead.event_id)}&limit=1`,
    { headers: c.headers });
  if (!ja.ok) throw new Error(`Supabase ${ja.status} ao consultar`);
  if ((await ja.json()).length) return false;
  const r = await fetch(`${c.url}/rest/v1/${TABELAS.leads}`, {
    method: 'POST', headers: { ...c.headers, Prefer: 'return=minimal' }, body: JSON.stringify(lead),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return true;
}

async function responder(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!segredoConfere(req)) {
    console.warn('[rd-webhook] rejeitado: segredo ausente ou inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const payload = corpoComoObjeto(req.body);
  if (!payload) return res.status(400).json({ error: 'Corpo não é JSON válido' });

  const leads = contatosDe(payload).map(leadDe).filter(l => l.email || l.telefone);
  let gravados = 0, ignorados = 0;
  try {
    for (const l of leads) { if (await gravarSeNovo(l)) gravados++; else ignorados++; }
  } catch (e) {
    // 500 faz o RD reenviar mais tarde — o que queremos quando o banco falhou.
    console.error('[rd-webhook]', e.message);
    return res.status(500).json({ error: e.message });
  }
  console.log(`[rd-webhook] recebidos=${leads.length} gravados=${gravados} ignorados=${ignorados}`);
  return res.status(200).json({ ok: true, recebidos: leads.length, gravados, ignorados });
}

module.exports = { responder, leadDe };
