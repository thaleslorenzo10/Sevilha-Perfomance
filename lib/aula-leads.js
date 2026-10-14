'use strict';

const { conexao, rest, TABELAS } = require('./supabase');
const { enviarEvento, montarUserData, eventIdPorContato, normalizarTelefone } = require('./capi');
const { sendToRDMarketing, sendToRDCRM } = require('./lead-integracoes');
const { gravarLead } = require('./sheets-write');

const PAGINA = '/aula-gestao-operacional';
const CAMPOS = ['nome', 'email', 'telefone', 'cargo', 'colaboradores', 'escritorio', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ttclid', 'msclkid', 'fbp', 'fbc', 'external_id', 'event_id', 'page_url', 'user_agent'];

async function banco(query, options = {}) {
  const c = conexao();
  if (!c) throw new Error('persistencia_indisponivel');
  const r = await fetch(rest(TABELAS.leads, query), {
    ...options, headers: { ...c.headers, Prefer: 'return=representation' }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('persistencia_indisponivel');
  return r.json();
}

async function tratarAula(req, res) {
  const body = req.body;
  if (JSON.stringify(body).length > 24000 || CAMPOS.some(k => body[k] != null && (typeof body[k] !== 'string' || body[k].length > 2048))) {
    return res.status(400).json({ ok: false, error: 'dados_invalidos' });
  }
  if (!body.nome?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email?.trim() || '') || !/^55\d{10,11}$/.test(normalizarTelefone(body.telefone || ''))) {
    return res.status(400).json({ ok: false, error: 'dados_invalidos' });
  }
  let data = Object.fromEntries(CAMPOS.map(k => [k, body[k] || null]));
  data.pagina = PAGINA;
  data.email = body.email.trim().toLowerCase();
  data.event_id = body.event_id || eventIdPorContato('aula-20261027', data.email);
  data.user_agent = body.user_agent || req.headers['user-agent'] || '';
  const destinos = ['sheets', 'rd_marketing', 'rd_crm', 'capi', 'checkout'];
  data.integracoes = { banco: { status: 'salvo' }, ...Object.fromEntries(destinos.map(k => [k, { status: 'pendente' }])) };
  let row;
  let repetido = false;
  try {
    const filtro = `pagina=eq.${PAGINA}&event_id=eq.${encodeURIComponent(data.event_id)}`;
    const anteriores = await banco(`${filtro}&select=*&limit=1`);
    if (anteriores[0]) {
      if (anteriores[0].email !== data.email || normalizarTelefone(anteriores[0].telefone) !== normalizarTelefone(data.telefone)) return res.status(409).json({ ok: false, error: 'event_id_utilizado' });
      row = anteriores[0];
      data = { ...row, integracoes: { ...row.integracoes } };
      repetido = true;
    } else {
      [row] = await banco('', { method: 'POST', body: JSON.stringify(data) });
    }
    if (!row?.id) throw new Error('persistencia_sem_confirmacao');
  } catch {
    return res.status(503).json({ ok: false, error: 'persistencia_indisponivel' });
  }
  const quando = Math.floor(Date.now() / 1000);
  const userData = montarUserData({
    nome: data.nome, email: data.email, telefone: data.telefone, pais: 'br',
    externalId: [data.external_id, data.email], fbp: data.fbp, fbc: data.fbc, fbclid: data.fbclid,
    ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
    userAgent: data.user_agent, quandoMs: quando * 1000,
  });
  const meta = async (evento, eventId) => {
    if (!process.env.META_CAPI_TOKEN) return { status: 'nao_configurado' };
    const r = await enviarEvento({
      evento, eventId, quando, userData, seguro: true, actionSource: 'website',
      sourceUrl: data.page_url || req.headers.referer || 'https://www.sevilhaperformance.com.br/aula-gestao-operacional',
      customData: { content_name: 'Aula Gestão Operacional', content_category: 'aula', currency: 'BRL', value: 27 },
    });
    return { status: r.ok ? 'enviado' : 'falhou', recebidos: r.recebidos || 0 };
  };
  const acoes = {
    sheets: async () => {
      const r = await gravarLead(data, { seguro: true });
      return { status: r.ok ? 'enviado' : r.status || 'falhou' };
    },
    rd_marketing: () => sendToRDMarketing(data), rd_crm: () => sendToRDCRM(data, data.integracoes.rd_crm),
    capi: () => meta('Lead', data.event_id), checkout: () => meta('InitiateCheckout', `ic:${data.event_id}`),
  };
  const pendentes = destinos.filter(k => !['enviado', 'nao_aplicavel'].includes(data.integracoes[k]?.status));
  const resultados = await Promise.allSettled(pendentes.map(k => acoes[k]()));
  pendentes.forEach((k, i) => { data.integracoes[k] = resultados[i].status === 'fulfilled' ? resultados[i].value : { status: 'incerto' }; });
  try {
    await banco(`id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', body: JSON.stringify({ integracoes: data.integracoes }) });
  } catch { console.warn('[aula] lead salvo; recibos pendentes de reconciliacao'); }
  return res.status(200).json({ ok: true, event_id: data.event_id, ...(repetido ? { repetido: true } : {}), events_received: data.integracoes.capi?.recebidos || 0 });
}

module.exports = { tratarAula };
