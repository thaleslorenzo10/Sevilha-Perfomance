'use strict';

/**
 * Envio de eventos para a Meta Conversions API.
 *
 * Concentra o que precisa estar certo em todo evento: normalização conforme a
 * spec do Meta (é o que decide se o hash bate com o cadastro do usuário lá) e o
 * hash SHA-256 de tudo que é dado pessoal. Nome, e-mail e telefone só saem
 * daqui hasheados — nunca em claro.
 */

const crypto = require('crypto');

const PIXEL_ID    = process.env.META_PIXEL_ID || '657178423444244';
const API_VERSION = 'v19.0';
const CAPI_URL    = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

/* ── Normalização (spec oficial do Meta) ─────────────────────────────── */

function hash(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizarEmail(raw) {
  if (!raw) return null;
  return String(raw).trim().toLowerCase();
}

function normalizarTelefone(raw) {
  if (!raw) return null;
  const digitos = String(raw).replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
  if (digitos.length === 11) return '55' + digitos;
  if (digitos.length === 10) return '55' + digitos;
  return digitos;
}

function normalizarNome(raw) {
  if (!raw) return null;
  return String(raw).trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
}

/**
 * Monta o bloco user_data já hasheado. Campos ausentes ficam de fora — mandar
 * hash de string vazia piora a correspondência em vez de melhorar.
 *
 * `leadId` é a exceção: o identificador de lead do formulário instantâneo do
 * Meta vai em claro, porque é um id do próprio Meta e não um dado pessoal.
 */
function montarUserData({ email, telefone, nome, pais, externalId, leadId, fbp, fbc, fbclid, ip, userAgent, quandoMs }) {
  const ud = {};

  if (email)    ud.em = [hash(normalizarEmail(email))];
  if (telefone) ud.ph = [hash(normalizarTelefone(telefone))];
  if (pais)     ud.country = [hash(String(pais).trim().toLowerCase())];
  if (nome) {
    const partes = normalizarNome(nome).split(/\s+/).filter(Boolean);
    if (partes[0])         ud.fn = [hash(partes[0])];
    if (partes.length > 1) ud.ln = [hash(partes[partes.length - 1])];
  }
  if (externalId) ud.external_id = [hash(externalId)];
  if (leadId)     ud.lead_id = String(leadId);

  if (fbp) ud.fbp = fbp;
  if (fbc) ud.fbc = fbc;
  else if (fbclid) ud.fbc = `fb.1.${quandoMs || Date.now()}.${fbclid}`;

  if (ip)        ud.client_ip_address = ip;
  if (userAgent) ud.client_user_agent = userAgent;

  return ud;
}

/**
 * Dispara um evento. Devolve a resposta do Meta, ou null quando o token não
 * está configurado — nesse caso apenas avisa no log, porque derrubar o webhook
 * por falta de token faria o Respondi reenviar o mesmo lead indefinidamente.
 */
async function enviarEvento({ evento, eventId, quando, userData, customData, sourceUrl, actionSource }) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    console.warn('[capi] META_CAPI_TOKEN não definido — evento não enviado:', evento);
    return null;
  }

  const dado = {
    event_name:   evento,
    event_time:   quando || Math.floor(Date.now() / 1000),
    event_id:     eventId,
    action_source: actionSource || 'website',
    user_data:    userData || {},
  };
  if (sourceUrl)  dado.event_source_url = sourceUrl;
  if (customData) dado.custom_data = customData;

  try {
    const res  = await fetch(`${CAPI_URL}?access_token=${token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ data: [dado] }),
    });
    const json = await res.json();
    if (json.error) console.error('[capi] erro', evento, JSON.stringify(json.error));
    else console.log(`[capi] ${evento} ok — event_id=${eventId} recebidos=${json.events_received}`);
    return json;
  } catch (err) {
    console.error('[capi] exceção', evento, err.message);
    return null;
  }
}

module.exports = {
  enviarEvento, montarUserData, hash,
  normalizarEmail, normalizarTelefone, normalizarNome,
  PIXEL_ID, CAPI_URL,
};
