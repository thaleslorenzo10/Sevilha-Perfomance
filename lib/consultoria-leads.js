'use strict';

const crypto = require('crypto');
const { conexao, rest, TABELAS } = require('./supabase');
const { normalizarTelefone } = require('./capi');
const { recibo, PAGINAS_CONSULTORIA } = require('./lead-integracoes');

const PORTES = ['De 0 a 4', 'De 5 a 9', 'De 10 a 19', 'De 20 a 29', 'De 30 a 49', 'Mais de 50'];
const CARGOS = ['Dono/Sócio', 'Cargo Gerencial', 'Cargo Operacional'];
const DESTINOS = ['sheets', 'rd_marketing', 'rd_crm', 'capi', 'qualificacao'];

function validarConsultoria(body) {
  const campos = ['nome', 'email', 'telefone', 'cargo', 'colaboradores', 'escritorio', 'event_id'];
  const invalido = campos.find(k => body[k] != null && typeof body[k] !== 'string');
  if (invalido) return invalido;
  if (!body.nome?.trim() || body.nome.length > 200) return 'nome';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email?.trim() || '') || body.email.length > 254) return 'email';
  if (!/^55\d{10,11}$/.test(normalizarTelefone(body.telefone) || '')) return 'telefone';
  if (!CARGOS.includes(body.cargo)) return 'cargo';
  if (!PORTES.includes(body.colaboradores)) return 'colaboradores';
  if ((body.escritorio || '').length > 200) return 'escritorio';
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(body.event_id || '')) return 'event_id';
  const tracking = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ttclid', 'msclkid', 'fbp', 'fbc', 'external_id', 'page_url', 'user_agent', 'referrer'];
  return tracking.find(k => body[k] != null && (typeof body[k] !== 'string' || body[k].length > 2048)) || null;
}

async function banco(query, options = {}) {
  const c = conexao();
  if (!c) throw new Error('banco_nao_configurado');
  const response = await fetch(rest(TABELAS.leads, query), {
    ...options, headers: { ...c.headers, Prefer: 'return=representation', ...options.headers }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const erro = new Error('banco_indisponivel');
    erro.status = response.status;
    throw erro;
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('banco_resposta_invalida');
  return rows;
}

const filtro = id => `event_id=eq.${encodeURIComponent(id)}&pagina=in.(${PAGINAS_CONSULTORIA.join(',')})`;
async function ler(id) {
  const rows = await banco(`${filtro(id)}&select=*&limit=2`);
  if (rows.length > 1) throw new Error('banco_evento_duplicado');
  return rows[0];
}

function iniciais() {
  return { banco: recibo('salvo'), ...Object.fromEntries(DESTINOS.map(k => [k, recibo('pendente')])) };
}

async function salvar(data) {
  const existente = await ler(data.event_id);
  if (existente) return conferirIdentidade(existente, data);
  try {
    const [row] = await banco('', { method: 'POST', body: JSON.stringify({ ...data, integracoes: iniciais() }) });
    if (!row) throw new Error('banco_sem_confirmacao');
    return row;
  } catch (e) {
    if (e.status !== 409) throw e;
    const row = await ler(data.event_id);
    if (!row) throw e;
    return conferirIdentidade(row, data);
  }
}

function conferirIdentidade(row, data) {
  if (row.email?.trim().toLowerCase() !== data.email.trim().toLowerCase() || normalizarTelefone(row.telefone) !== normalizarTelefone(data.telefone)) {
    const erro = new Error('event_id_utilizado');
    erro.status = 409;
    throw erro;
  }
  return row;
}

async function atualizar(id, estados, anterior) {
  const compare = anterior === null ? 'integracoes=is.null' : `integracoes=eq.${encodeURIComponent(JSON.stringify(anterior))}`;
  const rows = await banco(`${filtro(id)}&${compare}`, { method: 'PATCH', body: JSON.stringify({ integracoes: estados }) });
  return rows[0];
}

function resposta(row) {
  const states = row.integracoes || iniciais();
  return {
    ok: true, event_id: row.event_id,
    events_received: states.capi?.recebidos || 0,
    lead_qualificado: states.qualificacao?.status === 'enviado',
    integracoes: Object.fromEntries(['banco', ...DESTINOS].map(k => [k, states[k]?.status || 'pendente'])),
  };
}

async function executar(row, actions) {
  let estados = row.integracoes;
  for (const nome of DESTINOS) {
    const anterior = estados[nome] || recibo('pendente');
    if (!['pendente', 'falhou', 'nao_configurado'].includes(anterior.status)) continue;
    const processando = { ...estados, [nome]: { ...anterior, status: 'processando' } };
    const claimed = await atualizar(row.event_id, processando, estados);
    if (!claimed) throw new Error('recibo_concorrente');
    estados = processando;
    const checkpoint = async estado => {
      const novo = { ...estados, [nome]: estado };
      if (!await atualizar(row.event_id, novo, estados)) throw new Error('recibo_concorrente');
      estados = novo;
    };
    let resultado;
    try { resultado = await actions[nome](row, anterior, checkpoint); }
    catch { resultado = recibo('incerto', { codigo: 'destino_nao_confirmado' }); }
    await checkpoint(resultado);
  }
  const concluido = { ...estados, execucao: { status: 'livre' } };
  if (!await atualizar(row.event_id, concluido, estados)) throw new Error('recibo_concorrente');
  return { ...row, integracoes: concluido };
}

async function processarConsultoria(data, actions) {
  let row;
  try { row = await salvar(data); }
  catch (e) { return { status: e.status === 409 ? 409 : 503, body: { ok: false, error: e.status === 409 ? 'event_id_utilizado' : 'persistencia_indisponivel' } }; }
  try {
    const estados = row.integracoes || iniciais();
    // Uma claim duravel protege todos os POSTs, inclusive entre instancias serverless.
    // 330s supera maxDuration=300s; somente destinos nunca iniciados podem seguir.
    // shortcut: POST processando/incerto requer readback do destino antes de reenviar.
    const iniciada = Date.parse(estados.execucao?.em);
    const expirada = Number.isFinite(iniciada) && Date.now() - iniciada > 330000;
    if (estados.execucao?.status === 'processando' && !expirada) return { status: 200, body: resposta(row) };
    const claimed = { ...estados, execucao: { status: 'processando', id: crypto.randomUUID(), em: new Date().toISOString() } };
    const owner = await atualizar(row.event_id, claimed, row.integracoes || null);
    if (!owner) return { status: 200, body: resposta(await ler(row.event_id) || row) };
    row = await executar({ ...row, integracoes: claimed }, actions);
  } catch {
    // Lead ja salvo: erro de recibo deixa a claim para reconciliacao, sem reenviar POSTs.
    row = await ler(row.event_id).catch(() => row);
  }
  return { status: 200, body: resposta(row) };
}

module.exports = { validarConsultoria, processarConsultoria };
