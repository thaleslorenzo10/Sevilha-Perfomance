'use strict';

/**
 * Sevilha Performance — Webhook do Respondi
 * POST /api/respondi
 *
 * O formulário da landing page é hospedado pelo Respondi (form.respondi.app) e
 * os anúncios apontam direto para lá, então não há como rodar JS nosso na
 * página. Este endpoint recebe cada submissão pelo webhook nativo do Respondi e
 * dispara `LeadQualificado` na Conversions API quando o lead responde ter 10 ou
 * mais colaboradores — o perfil que a consultoria procura.
 *
 * Variáveis de ambiente:
 *   RESPONDI_WEBHOOK_SECRET = segredo combinado, obrigatório
 *   META_CAPI_TOKEN         = System User Access Token (o mesmo de /api/leads)
 *
 * Configuração no painel do Respondi (passo manual, feito pelo dono da conta):
 *   https://sevilha-perfomance.vercel.app/api/respondi?token=<segredo>
 */

const crypto = require('crypto');

const { norm } = require('../lib/texto');
const { ehQualificado } = require('../lib/porte');
const { enviarEvento, montarUserData, eventIdPorContato } = require('../lib/capi');

const EVENTO = 'LeadQualificado';
const FORM_URL = 'https://form.respondi.app/gvz4UKQr';

/* ── Leitura do payload ──────────────────────────────────────────────── */

/**
 * O formato exato do webhook do Respondi não é documentado publicamente, e a
 * documentação indica pelo menos duas formas de entregar as respostas
 * (`answers` chaveado pela pergunta e `raw_answers` como lista). Em vez de
 * apostar numa delas, achatamos o JSON inteiro em pares (pergunta, resposta) e
 * localizamos cada campo pelo conteúdo — a mesma tática que a leitura da
 * planilha já usa para o export do Meta, e que sobrevive a mudança de formato.
 */
const CHAVES_PERGUNTA = ['question', 'pergunta', 'label', 'title', 'field'];
const CHAVES_RESPOSTA = ['answer', 'resposta', 'value'];

function escalar(v) {
  return v !== null && v !== undefined && typeof v !== 'object';
}

function coletarPares(node, out = []) {
  if (Array.isArray(node)) {
    for (const item of node) coletarPares(item, out);
    return out;
  }
  if (!node || typeof node !== 'object') return out;

  const chaves = Object.keys(node);

  // Entrada no formato {question, answer}: a pergunta é o rótulo, não a chave.
  const kP = chaves.find(k => CHAVES_PERGUNTA.includes(norm(k)));
  const kR = chaves.find(k => CHAVES_RESPOSTA.includes(norm(k)));
  if (kP && kR && escalar(node[kP]) && escalar(node[kR])) {
    out.push([String(node[kP]), String(node[kR])]);
  }

  for (const k of chaves) {
    const v = node[k];
    if (escalar(v)) out.push([k, String(v)]);
    else coletarPares(v, out);
  }
  return out;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHAVES_TELEFONE = ['whats', 'telefone', 'phone', 'celular', 'fone'];
// Chaves que carregam números longos e nunca são telefone — sem esta exclusão
// um utm_term (id numérico de campanha) passaria pelo formato de telefone.
const CHAVES_NAO_TELEFONE = ['utm', 'id', 'fbclid', 'gclid', 'pontuacao', 'score'];

function acharPorChave(pares, teste) {
  for (const [chave, valor] of pares) {
    if (valor.trim() && teste(norm(chave))) return valor.trim();
  }
  return '';
}

function acharColaboradores(pares) {
  return acharPorChave(pares, c => c.includes('colaborador'));
}

function acharEmail(pares) {
  for (const [, valor] of pares) {
    const v = valor.trim();
    if (RE_EMAIL.test(v)) return v;
  }
  return '';
}

function acharTelefone(pares) {
  const porRotulo = acharPorChave(pares, c => CHAVES_TELEFONE.some(t => c.includes(t)));
  if (porRotulo) return porRotulo;

  for (const [chave, valor] of pares) {
    const c = norm(chave);
    if (CHAVES_NAO_TELEFONE.some(x => c.includes(x))) continue;
    const digitos = valor.replace(/\D/g, '');
    if (digitos.length >= 10 && digitos.length <= 13 && /[\s()+-]/.test(valor)) return valor.trim();
  }
  return '';
}

function acharExato(pares, nome) {
  return acharPorChave(pares, c => c === nome);
}

/**
 * Id da submissão, quando existe. Procurado só na raiz e em `respondent`:
 * dentro de `form` o que existe é o id do FORMULÁRIO, igual para todo lead —
 * usá-lo por engano colapsaria todas as conversões em uma só.
 */
function acharIdSubmissao(payload) {
  const escopos = [payload, payload.respondent, payload.body, payload.body && payload.body.respondent]
    .filter(o => o && typeof o === 'object');

  for (const chave of ['id', 'submission_id', 'submissionid', 'response_id', 'responseid']) {
    for (const escopo of escopos) {
      for (const k of Object.keys(escopo)) {
        if (norm(k) === chave && escalar(escopo[k]) && String(escopo[k]).trim()) {
          return String(escopo[k]).trim();
        }
      }
    }
  }
  return '';
}

/**
 * Chave de deduplicação do evento.
 *
 * O payload de produção do Respondi não traz id de submissão (confirmado no
 * workflow n8n que já recebe este webhook), e o Respondi reenvia a entrega
 * quando a resposta demora. Sem chave estável, cada retry viraria uma conversão
 * nova no relatório. O contato identifica a submissão de forma reproduzível, e
 * vai hasheado porque o event_id chega ao Meta sem criptografia.
 */
function eventIdDe(payload, email, telefone) {
  return acharIdSubmissao(payload)
      || eventIdPorContato('respondi', email || telefone);
}

function acharQuandoMs(payload) {
  for (const chave of ['submitted_at', 'created_at', 'timestamp', 'date', 'data']) {
    for (const k of Object.keys(payload)) {
      if (norm(k) !== chave || !escalar(payload[k])) continue;
      const ms = Date.parse(String(payload[k]));
      if (!Number.isNaN(ms)) return ms;
    }
  }
  return Date.now();
}

/* ── Autenticação ────────────────────────────────────────────────────── */

/**
 * O endpoint é público na internet: sem segredo, qualquer um injetaria
 * conversões falsas no pixel. O segredo é aceito por header e por query porque
 * nem todo painel de webhook permite configurar cabeçalho.
 */
function segredoConfere(req) {
  const esperado = process.env.RESPONDI_WEBHOOK_SECRET || '';
  if (!esperado) return false;

  const daQuery = new URL(req.url || '/', 'http://localhost').searchParams.get('token') || '';
  const recebido = String(req.headers?.['x-webhook-secret'] || daQuery);
  if (!recebido) return false;

  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function corpoComoObjeto(body) {
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string' && body.trim()) {
    try {
      const o = JSON.parse(body);
      return o && typeof o === 'object' ? o : null;
    } catch { return null; }
  }
  return null;
}

function ipDoCliente(req) {
  const encaminhado = req.headers?.['x-forwarded-for'];
  if (encaminhado) return String(encaminhado).split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

/* ── Handler ─────────────────────────────────────────────────────────── */

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  if (!segredoConfere(req)) {
    console.warn('[respondi] rejeitado: segredo ausente ou inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = corpoComoObjeto(req.body);
  if (!payload) return res.status(400).json({ error: 'Corpo não é JSON válido' });

  const pares         = coletarPares(payload);
  const colaboradores = acharColaboradores(pares);
  const email         = acharEmail(pares);
  const telefone      = acharTelefone(pares);
  const qualificado   = ehQualificado(colaboradores);

  // Log sem PII: só o que foi encontrado, nunca o conteúdo.
  console.log('[respondi] recebido —',
    `colaboradores=${colaboradores || '(vazio)'}`,
    `qualificado=${qualificado}`,
    `email=${email ? 'sim' : 'nao'}`,
    `telefone=${telefone ? 'sim' : 'nao'}`);

  // Sempre 200 quando o payload é válido, inclusive para quem não dispara:
  // webhook que recebe erro entra em retry e reenviaria o mesmo lead.
  if (!qualificado) return res.status(200).json({ ok: true, qualificado: false });

  // Sem contato não há chave de deduplicação estável nem correspondência útil
  // no Meta — e o dashboard também não conta esse lead, então mandar o evento
  // faria os dois números discordarem.
  if (!email && !telefone) {
    console.warn('[respondi] qualificado sem e-mail nem telefone — evento não enviado');
    return res.status(200).json({ ok: true, qualificado: true, enviado: false, motivo: 'sem contato' });
  }

  const quandoMs = acharQuandoMs(payload);

  await enviarEvento({
    evento:  EVENTO,
    eventId: eventIdDe(payload, email, telefone),
    quando:  Math.floor(quandoMs / 1000),
    userData: montarUserData({
      email,
      telefone,
      fbclid:    acharExato(pares, 'fbclid'),
      ip:        ipDoCliente(req),
      userAgent: req.headers?.['user-agent'] || '',
      quandoMs,
    }),
    customData: {
      colaboradores,
      utm_campaign: acharExato(pares, 'utm_campaign'),
      utm_source:   acharExato(pares, 'utm_source'),
      utm_content:  acharExato(pares, 'utm_content'),
    },
    sourceUrl:    FORM_URL,
    actionSource: 'website',
  });

  return res.status(200).json({ ok: true, qualificado: true });
};
