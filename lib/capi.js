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
 * Dispara um evento e devolve `{ ok, recebidos, fbtrace_id, erro }`.
 *
 * O `ok` existe porque quem chama precisa saber se o Meta realmente aceitou —
 * não basta a chamada ter acontecido. Sem esse retorno, uma varredura que grava
 * "enviado" pelo simples fato de ter chamado a função marca como concluído algo
 * que nunca saiu, e o lead nunca mais é tentado. Falta de token, erro no corpo
 * da resposta e exceção de rede são todos `ok: false`.
 */
async function enviarEvento({ evento, eventId, quando, userData, customData, sourceUrl, actionSource }) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    const erro = 'META_CAPI_TOKEN não definido';
    console.warn(`[capi] ${erro} — ${evento} não enviado`);
    return { ok: false, erro };
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

    if (json.error || !res.ok) {
      const erro = JSON.stringify(json.error || json).slice(0, 500);
      console.error(`[capi] erro ${evento} — event_id=${eventId}`, erro);
      return { ok: false, erro, fbtrace_id: json.fbtrace_id };
    }

    console.log(`[capi] ${evento} ok — event_id=${eventId} recebidos=${json.events_received}`);
    return { ok: true, recebidos: json.events_received ?? 0, fbtrace_id: json.fbtrace_id };
  } catch (err) {
    console.error(`[capi] exceção ${evento} — event_id=${eventId}`, err.message);
    return { ok: false, erro: err.message };
  }
}

/**
 * Chave de deduplicação determinística a partir do contato do lead.
 *
 * Usada quando a origem não fornece id de submissão (é o caso do webhook do
 * Respondi e da varredura da planilha de LP). Precisa ser idêntica nos dois
 * caminhos: se um dia os dois rodarem para o mesmo lead, o Meta descarta o
 * segundo em vez de contar a conversão duas vezes. Vai hasheada porque o
 * event_id chega ao Meta sem criptografia.
 */
function eventIdPorContato(prefixo, contato) {
  return `${prefixo}:${hash(String(contato || '').trim().toLowerCase()).slice(0, 32)}`;
}

module.exports = {
  enviarEvento, montarUserData, hash, eventIdPorContato,
  normalizarEmail, normalizarTelefone, normalizarNome,
  PIXEL_ID, CAPI_URL,
};
