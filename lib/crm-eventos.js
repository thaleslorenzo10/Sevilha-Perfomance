'use strict';

/**
 * Sevilha Performance — eventos de fundo de funil, do RD Station CRM para o Meta
 * POST /api/crm-webhook?token=…   (servido por api/eventos-qualificados.js)
 *
 * O que a landing page manda ao Meta é o que a pessoa declarou de si: preencheu
 * o formulário, disse ter 10+ colaboradores. Isso é topo de funil — o algoritmo
 * aprende a achar gente que preenche formulário, não gente que vira cliente.
 * Este arquivo devolve ao Meta o que só o time comercial sabe: a reunião foi
 * marcada, aconteceu, o negócio fechou.
 *
 * A integração nativa do RD Station Marketing não resolve isto. Ela cobre só
 * lead de formulário instantâneo do Meta e dispara a venda quando alguém clica
 * "Marcar como venda" na mão — a landing page própria fica de fora, e o que
 * depende de clique manual não acontece.
 *
 * O RD CRM chama este endpoint a cada mudança de negociação. O trabalho aqui é:
 *   1. decidir se a etapa nova corresponde a algum evento (senão, ignora);
 *   2. recuperar o lead original no Supabase para melhorar a correspondência
 *      (fbclid e telefone que o CRM não guarda);
 *   3. mandar o evento, uma vez só por negociação e por etapa.
 *
 * Variáveis de ambiente:
 *   RD_CRM_WEBHOOK_SECRET = segredo na URL do webhook. Sem ele o endpoint
 *                           recusa tudo: um webhook aberto aceita evento
 *                           forjado, e evento forjado ensina o Meta errado.
 *   RD_CRM_EVENTOS        = JSON opcional {"nome da etapa": "NomeDoEvento"},
 *                           para nomear etapa que os padrões abaixo não pegam.
 *   META_CAPI_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

const crypto = require('crypto');

const { enviarEvento, montarUserData, eventIdPorContato } = require('./capi');
const registro = require('./eventos-enviados');
const { TABELAS } = require('./supabase');
const { norm } = require('./texto');

/**
 * Etapa do funil → evento no Meta.
 *
 * O casamento é por nome, não por id: id de etapa muda quando alguém recria o
 * funil, e aí o webhook silenciosamente para de mandar. Nome sobrevive à
 * recriação e diz na leitura o que está acontecendo.
 *
 * Os nomes dos eventos são próprios de propósito. `LeadQualificado` já existe e
 * significa "declarou 10+ colaboradores no formulário"; misturar as duas coisas
 * no mesmo evento apagaria a diferença entre o que a pessoa diz e o que o time
 * comercial confirmou — que é justamente a diferença que este arquivo existe
 * para medir.
 */
const PADROES = [
  { re: /reuni.*(agendad|marcad)|sess.*(agendad|marcad)|agendament/, evento: 'ReuniaoAgendada'    },
  { re: /reuni.*realizad|sess.*realizad|diagn.*realizad|compareceu/, evento: 'ReuniaoRealizada'   },
  { re: /qualificad/,                                               evento: 'LeadQualificadoCRM' },
];

/** Negócio ganho vira Purchase — evento padrão do Meta, aceita valor. */
const EVENTO_GANHO = 'Purchase';

function mapaDoAmbiente() {
  const bruto = process.env.RD_CRM_EVENTOS;
  if (!bruto) return {};
  try {
    const obj = JSON.parse(bruto);
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [norm(k), v]));
  } catch (e) {
    console.error('[CRM webhook] RD_CRM_EVENTOS não é JSON válido — ignorado:', e.message);
    return {};
  }
}

/**
 * Qual evento esta negociação representa agora, ou null se nenhum.
 * Ganho vence a etapa: negócio fechado é Purchase mesmo que a etapa se chame
 * outra coisa.
 */
function eventoDe(deal) {
  if (deal.ganho) return EVENTO_GANHO;

  const etapa = norm(deal.etapa || '');
  if (!etapa) return null;

  const doAmbiente = mapaDoAmbiente()[etapa];
  if (doAmbiente) return doAmbiente;

  const padrao = PADROES.find(p => p.re.test(etapa));
  return padrao ? padrao.evento : null;
}

/* ── Leitura do payload ──────────────────────────────────────────────── */

function primeiro(lista, campo) {
  for (const item of lista || []) {
    const v = item?.[campo];
    if (v) return v;
  }
  return null;
}

/**
 * O corpo do webhook do RD CRM já mudou de formato entre versões, e nem toda
 * conta manda os mesmos campos. Em vez de exigir um formato, procuramos o dado
 * onde ele costuma estar — e quem não achar etapa nenhuma cai no log com o
 * corpo cru, que é o que permite corrigir isto em minutos.
 */
function lerDeal(body) {
  const d = body?.deal || body || {};
  const contatos = d.contacts || body?.contacts || [];

  const emails = contatos.flatMap(c => (c.emails || []).map(e => e.email || e)).filter(Boolean);
  const fones  = contatos.flatMap(c => (c.phones || []).map(p => p.phone || p)).filter(Boolean);

  const statusNome = norm(d.deal_status?.name || d.status || '');

  return {
    id:    d.id || d._id || body?.id || null,
    nome:  d.name || null,
    etapa: d.deal_stage?.name || d.deal_stage_name || body?.deal_stage?.name || null,
    funil: d.deal_stage?.deal_pipeline?.name || d.deal_pipeline?.name || null,
    ganho: d.win === true || /ganh|won/.test(statusNome),
    perdido: d.win === false && /perd|lost/.test(statusNome),
    valor: Number(d.amount_total ?? d.amount_unique ?? d.amount_montly ?? 0) || 0,
    email: emails[0] || primeiro(contatos, 'email') || null,
    telefone: fones[0] || primeiro(contatos, 'phone') || null,
    contato: contatos[0]?.name || null,
    quando: d.updated_at || d.created_at || null,
  };
}

/* ── Enriquecimento ──────────────────────────────────────────────────── */

/**
 * O CRM guarda quem é a pessoa; o Supabase guarda de onde ela veio. Sem o
 * fbclid do clique original a correspondência do Meta cai muito — é a diferença
 * entre o evento ser atribuído ao anúncio ou ficar órfão.
 */
async function leadOriginal(email) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !email) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/${TABELAS.leads}` +
      `?select=telefone,fbclid,event_id,pagina,utm_campaign,colaboradores,created_at` +
      `&email=eq.${encodeURIComponent(email.trim().toLowerCase())}` +
      `&order=created_at.desc&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return null;
    const linhas = await res.json();
    return linhas[0] || null;
  } catch (e) {
    // Falha aqui piora a correspondência, não impede o evento.
    console.warn('[CRM webhook] não foi possível ler o lead original:', e.message);
    return null;
  }
}

/* ── Segurança ───────────────────────────────────────────────────────── */

function segredoConfere(req) {
  const esperado = process.env.RD_CRM_WEBHOOK_SECRET || '';
  if (!esperado) return false;

  const url      = new URL(req.url || '/', 'http://localhost');
  const daQuery  = url.searchParams.get('token') || '';
  const doHeader = String(req.headers?.['x-webhook-token'] || '');
  const recebido = daQuery || doHeader;
  if (!recebido) return false;

  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ── Handler ─────────────────────────────────────────────────────────── */

async function tratarWebhook(req, res) {
  if (!segredoConfere(req)) {
    console.warn('[CRM webhook] rejeitado: token ausente ou inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const deal   = lerDeal(body);
  const evento = eventoDe(deal);

  if (!evento) {
    // Ignorar é o caso comum: o CRM avisa toda mudança, e a maioria não é
    // marco de funil. O log traz a etapa para dar nome ao que falta mapear.
    console.log(`[CRM webhook] sem evento para etapa="${deal.etapa || '?'}" deal=${deal.id || '?'}`);
    return res.status(200).json({ ok: true, ignorado: true, etapa: deal.etapa });
  }

  if (!deal.email && !deal.telefone) {
    console.warn('[CRM webhook] negociação sem e-mail nem telefone — sem isso o Meta não casa com ninguém:',
      JSON.stringify(body).slice(0, 400));
    return res.status(200).json({ ok: false, motivo: 'contato ausente' });
  }

  // Uma negociação passa pela mesma etapa mais de uma vez (reagendamento, volta
  // de etapa). A trava é por negociação e evento, não por pessoa: a mesma pessoa
  // pode ter um segundo negócio meses depois, e esse é um evento novo de verdade.
  const eventId = eventIdPorContato(`crm-${evento.toLowerCase()}`, deal.id || deal.email);
  const jaForam = await registro.jaEnviados([eventId]);
  if (jaForam.has(eventId)) {
    console.log(`[CRM webhook] ${evento} já enviado para deal=${deal.id} — ignorado`);
    return res.status(200).json({ ok: true, duplicado: true, evento });
  }

  const original = await leadOriginal(deal.email);

  const userData = montarUserData({
    email:      deal.email,
    telefone:   deal.telefone || original?.telefone,
    nome:       deal.contato,
    pais:       'br',
    externalId: deal.email,
    fbclid:     original?.fbclid,
    quandoMs:   original?.created_at ? Date.parse(original.created_at) : undefined,
  });

  const customData = {
    origem:        'rd-crm',
    funil:         deal.funil || undefined,
    etapa:         deal.etapa || undefined,
    pagina:        original?.pagina || undefined,
    campanha:      original?.utm_campaign || undefined,
    colaboradores: original?.colaboradores || undefined,
  };
  if (evento === EVENTO_GANHO && deal.valor > 0) {
    customData.value    = deal.valor;
    customData.currency = 'BRL';
  }

  const resultado = await enviarEvento({
    evento,
    eventId,
    userData,
    customData,
    // O evento nasce de uma mudança no CRM, não de navegação. `system_generated`
    // é o que o Meta chama isso; mandar como `website` seria descrever errado.
    actionSource: 'system_generated',
  });

  // Só marca a trava quando o Meta aceitou. Marcar antes transforma uma falha
  // temporária em evento perdido para sempre.
  if (resultado.ok) {
    await registro.marcarEnviados([{ event_id: eventId, evento, fonte: `rd-crm:${deal.funil || '?'}` }]);
    console.log(`[CRM webhook] ${evento} enviado — deal=${deal.id} etapa="${deal.etapa}" recebidos=${resultado.recebidos}`);
  }

  return res.status(200).json({
    ok:      resultado.ok,
    evento,
    deal:    deal.id,
    etapa:   deal.etapa,
    erro:    resultado.erro,
  });
}

module.exports = { tratarWebhook, eventoDe, lerDeal, PADROES, EVENTO_GANHO };
