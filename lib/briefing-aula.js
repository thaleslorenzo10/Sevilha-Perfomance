'use strict';

const { createHash } = require('node:crypto');
const { conexao, rest } = require('./supabase');

const CAMPOS = ['publico', 'problema', 'resultado', 'tema', 'conteudo', 'pratica',
  'materiais', 'agenda', 'preco', 'acesso', 'gravacao', 'checkout', 'proxima_oferta',
  'professor', 'provas', 'links'];
const OBRIGATORIOS = ['publico', 'problema', 'resultado', 'tema', 'conteudo', 'professor'];
const LIMITE = 56 * 1024;
const TABELA = 'sevilha_briefings_aula';

function falha(status, message) {
  return Object.assign(new Error(message), { status });
}

function objeto(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function lerPayload(req) {
  if (Number(req.headers['content-length']) > LIMITE) {
    throw falha(413, 'Respostas muito longas. Reduza o texto e tente novamente.');
  }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    throw falha(400, 'Envie as respostas em JSON.');
  }
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (!raw) throw falha(400, 'Respostas inválidas.');
  if (Buffer.byteLength(raw) > LIMITE) throw falha(413, 'Respostas muito longas.');
  try { return JSON.parse(raw); }
  catch { throw falha(400, 'Respostas inválidas.'); }
}

function validar(payload) {
  if (!objeto(payload) || Object.keys(payload).some(k => !['id', 'answers', 'website'].includes(k))) {
    throw falha(400, 'Formato de respostas inválido.');
  }
  if (typeof payload.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.id)) {
    throw falha(400, 'Identificador inválido. Recarregue a página.');
  }
  if (payload.website !== '' || !objeto(payload.answers)) {
    throw falha(400, 'Formato de respostas inválido.');
  }
  if (Object.keys(payload.answers).some(k => !CAMPOS.includes(k))) {
    throw falha(400, 'Campo desconhecido no briefing.');
  }
  const answers = validarRespostas(payload.answers);
  return { id: payload.id.toLowerCase(), answers,
    payload_hash: createHash('sha256').update(JSON.stringify(answers)).digest('hex') };
}

function validarRespostas(respostas) {
  const answers = {};
  for (const campo of CAMPOS) {
    const valor = Object.hasOwn(respostas, campo) ? respostas[campo] : '';
    if (typeof valor !== 'string' || valor.length > 3000) {
      throw falha(422, 'Cada resposta deve ser um texto com até 3.000 caracteres.');
    }
    answers[campo] = valor.trim();
  }
  if (OBRIGATORIOS.some(k => !answers[k])) throw falha(422, 'Preencha os campos obrigatórios.');
  return answers;
}

function conferirOrigem(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const host = req.headers.host || '';
  const hosts = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL, host]
    .filter(value => typeof value === 'string' && /^[a-z0-9.-]+(?::\d+)?$/i.test(value));
  const permitidas = hosts.map(value => `https://${value}`);
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) permitidas.push(`http://${host}`);
  if (!permitidas.includes(origin)) throw falha(400, 'Origem da solicitação inválida.');
}

async function requisitar(url, options) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
}

function confirmar(rows, registro) {
  const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  if (!row || row.id !== registro.id || typeof row.created_at !== 'string' ||
      !Number.isFinite(Date.parse(row.created_at))) throw falha(503, 'Não foi possível confirmar o salvamento. Tente novamente.');
  if (row.payload_hash !== registro.payload_hash) throw falha(409, 'Este envio já foi salvo com outras respostas. Recarregue a página antes de reenviar.');
  return { ok: true, id: row.id, created_at: row.created_at };
}

async function salvar(registro) {
  const conn = conexao();
  if (!conn) throw falha(503, 'O salvamento está indisponível. Tente novamente mais tarde.');
  const response = await requisitar(rest(TABELA), { method: 'POST',
    headers: { ...conn.headers, Prefer: 'return=representation' }, body: JSON.stringify(registro) });
  const data = await response.json();
  if (response.ok) return confirmar(data, registro);
  if (response.status !== 409 || data.code !== '23505') throw falha(503, 'Não foi possível salvar. Suas respostas podem ser reenviadas.');
  const existente = await requisitar(rest(TABELA, `id=eq.${registro.id}&select=id,created_at,payload_hash&limit=1`),
    { headers: conn.headers });
  if (!existente.ok) throw falha(503, 'Não foi possível confirmar o salvamento. Tente novamente.');
  return confirmar(await existente.json(), registro);
}

module.exports = { lerPayload, validar, conferirOrigem, salvar };
