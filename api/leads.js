/**
 * Sevilha Performance — Vercel Serverless Function
 * POST /api/leads
 *
 * 1. Salva lead no Supabase (tabela: sevilha_leads)
 * 2. Grava a linha na planilha (páginas com formulário próprio)
 * 3. Envia para RD Station Marketing e para o RD Station CRM
 * 4. Envia Lead para a Meta Conversions API (CAPI) — e LeadQualificado quando
 *    consultoria tem acima de 10 colaboradores; outras ofertas mantêm a regra existente
 *
 */

'use strict';

const crypto = require('crypto');

// Normalização, hash e envio ao CAPI moram em lib/capi.js — o mesmo caminho que
// o webhook do Respondi usa, para os dois eventos hasharem igual.
const { enviarEvento, montarUserData, eventIdPorContato } = require('../lib/capi');
const { ehQualificado, ehQualificadoConsultoria } = require('../lib/porte');
const { localizarPorIp } = require('../lib/geo');
const registroDeEventos = require('../lib/eventos-enviados');
const { gravarLead } = require('../lib/sheets-write');
const { TABELAS } = require('../lib/supabase');
const { ehConsultoria, sendToRDMarketing, sendToRDCRM } = require('../lib/lead-integracoes');
const { validarConsultoria, processarConsultoria } = require('../lib/consultoria-leads');


function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

/* ─────────────────────────────────────────────────────────
   SUPABASE — salva lead
───────────────────────────────────────────────────────── */

async function saveToSupabase(data) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Supabase] SUPABASE_URL ou SUPABASE_SERVICE_KEY não definidos');
    return;
  }

  const payload = {
    nome:         data.nome        || null,
    email:        data.email       || null,
    telefone:     data.telefone    || null,
    pagina:       data.pagina      || null,
    utm_source:   data.utm_source  || null,
    utm_medium:   data.utm_medium  || null,
    utm_campaign: data.utm_campaign || null,
    utm_term:     data.utm_term    || null,
    utm_content:  data.utm_content || null,
    fbclid:       data.fbclid      || null,
    gclid:        data.gclid       || null,
    ttclid:       data.ttclid      || null,
    msclkid:      data.msclkid     || null,
    fbp:          data.fbp         || null,
    fbc:          data.fbc         || null,
    external_id:  data.external_id || null,
    event_id:     data.event_id    || null,
    page_url:     data.page_url    || null,
    user_agent:   data.user_agent  || null,
    cargo:        data.cargo       || null,
    colaboradores: data.colaboradores || null,
    escritorio:   data.escritorio  || null,
    geo_cidade:   data.geo_cidade   || null,
    geo_estado:   data.geo_estado   || null,
    geo_cep:      data.geo_cep      || null,
    geo_raio_km:  data.geo_raio_km  ?? null,
    geo_asn:      data.geo_asn      || null,
  };

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${TABELAS.leads}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Supabase Error]', res.status, err);
    } else {
      console.log(`[Supabase OK] lead salvo — pagina=${payload.pagina} email=${payload.email}`);
    }
  } catch (err) {
    console.error('[Supabase Exception]', err.message);
  }
}

// Oferta propria usa prefixo deterministico compartilhado com a trava de qualificacao.

const EVENTO_QUALIFICADO = 'LeadQualificado';

async function enviarLeadQualificado(data, { userData, eventTime, sourceUrl, referrerUrl }) {
  if (!ehQualificado(data.colaboradores)) return { enviado: false, motivo: 'fora do porte' };

  const contato = data.email || data.telefone;
  if (!contato) return { enviado: false, motivo: 'sem e-mail nem telefone' };

  // Prefixo próprio: a varredura usa 'respondi' para os leads do formulário
  // hospedado e 'forms:' para os do Meta. Este é um terceiro formulário, de
  // outra oferta — colidir com o prefixo do Respondi faria quem preencheu os
  // dois contar uma vez só.
  const eventId = eventIdPorContato('sessao-estrategica', contato);

  try {
    const jaForam = await registroDeEventos.jaEnviados([eventId]);
    if (jaForam.has(eventId)) {
      console.log(`[LeadQualificado] já enviado antes — event_id=${eventId}`);
      return { enviado: false, motivo: 'duplicado' };
    }

    const envio = await enviarEvento({
      evento:  EVENTO_QUALIFICADO,
      eventId,
      quando:  eventTime,
      userData,
      customData: {
        colaboradores: data.colaboradores,
        cargo:         data.cargo,
        utm_campaign:  data.utm_campaign || undefined,
        utm_source:    data.utm_source   || undefined,
        utm_content:   data.utm_content  || undefined,
        escritorio:    data.escritorio    || undefined,
      },
      sourceUrl,
      referrerUrl,
      actionSource: 'website',
    });

    if (!envio.ok) {
      // Sem marcar na trava: a varredura das 4h tenta de novo.
      console.error('[LeadQualificado] falhou —', envio.erro);
      return { enviado: false, motivo: envio.erro };
    }

    await registroDeEventos.marcarEnviados([
      { event_id: eventId, evento: EVENTO_QUALIFICADO, fonte: `api-leads:${data.pagina}` },
    ]);
    console.log(`[LeadQualificado OK] ${data.colaboradores} — event_id=${eventId} pagina=${data.pagina}`);
    return { enviado: true, eventId };
  } catch (e) {
    console.error('[LeadQualificado] exceção —', e.message);
    return { enviado: false, motivo: e.message };
  }
}

function integracoesConsultoria(req, { ip, eventTime, referrer }) {
  const contexto = data => ({
    userData: montarUserData({
      email: data.email, telefone: data.telefone, nome: data.nome, pais: 'br',
      cidade: data.geo_cidade, estado: data.geo_estado, cep: data.geo_cep,
      externalId: [data.external_id, data.email], fbp: data.fbp, fbc: data.fbc,
      fbclid: data.fbclid, ip, userAgent: data.user_agent, quandoMs: eventTime * 1000,
    }),
    eventTime, sourceUrl: data.page_url || req.headers.referer || '', referrerUrl: referrer,
  });
  const meta = async (data, evento, eventId) => {
    if (!process.env.META_CAPI_TOKEN) return { status: 'nao_configurado' };
    const ctx = contexto(data);
    const envio = await enviarEvento({
      evento, eventId, quando: eventTime, userData: ctx.userData,
      customData: Object.fromEntries(Object.entries({ content_name: data.pagina, content_category: 'pre-inscricao', currency: 'BRL', value: 0,
        colaboradores: data.colaboradores, cargo: data.cargo, escritorio: data.escritorio,
        utm_source: data.utm_source, utm_medium: data.utm_medium, utm_campaign: data.utm_campaign,
        utm_term: data.utm_term, utm_content: data.utm_content, gclid: data.gclid }).filter(([, v]) => v !== '')),
      sourceUrl: ctx.sourceUrl, referrerUrl: ctx.referrerUrl, actionSource: 'website', seguro: true,
    });
    return envio.ok ? { status: 'enviado', recebidos: envio.recebidos } : { status: envio.erro === 'meta_indisponivel' ? 'incerto' : 'falhou', codigo: 'meta_nao_confirmou' };
  };
  return {
    sheets: async data => {
      const r = await gravarLead(data, { seguro: true });
      return { status: r.ok ? 'enviado' : r.status || 'falhou', ...(r.range ? { range: r.range } : {}) };
    },
    rd_marketing: sendToRDMarketing, rd_crm: sendToRDCRM,
    capi: data => meta(data, 'Lead', data.event_id),
    qualificacao: async data => {
      if (!ehQualificadoConsultoria(data.colaboradores)) return { status: 'nao_aplicavel' };
      const eventId = eventIdPorContato('sessao-estrategica', data.email);
      const enviados = await registroDeEventos.jaEnviados([eventId], { signal: AbortSignal.timeout(8000) });
      if (enviados.has(eventId)) return { status: 'enviado', event_id: eventId };
      const r = await meta(data, EVENTO_QUALIFICADO, eventId);
      if (r.status === 'enviado') await registroDeEventos.marcarEnviados([
        { event_id: eventId, evento: EVENTO_QUALIFICADO, fonte: `api-leads:${data.pagina}` },
      ], { signal: AbortSignal.timeout(8000) });
      return { ...r, ...(r.status === 'enviado' ? { event_id: eventId } : {}) };
    },
  };
}

/* ─────────────────────────────────────────────────────────
   HANDLER PRINCIPAL
───────────────────────────────────────────────────────── */

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  if (body.pagina === '/aula-gestao-operacional') return require('../lib/aula-leads').tratarAula(req, res);
  if (typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ ok: false, error: 'dados_invalidos' });
  if (ehConsultoria(body.pagina) && JSON.stringify(body).length > 24000) return res.status(413).json({ ok: false, error: 'dados_invalidos' });
  if (ehConsultoria(body.pagina)) {
    const campo = validarConsultoria(body);
    if (campo) return res.status(400).json({ ok: false, error: 'dados_invalidos', campo });
  }
  const {
    nome        = '',
    email       = '',
    telefone    = '',
    fbp         = '',
    fbc         = '',
    external_id = '',
    event_id    = '',
    page_url    = '',
    user_agent  = '',
    utm_source  = '',
    utm_medium  = '',
    utm_campaign = '',
    utm_term    = '',
    utm_content = '',
    fbclid        = '',
    gclid         = '',
    ttclid        = '',
    msclkid       = '',
    pagina        = '/',
    referrer      = '',
    cargo         = '',
    colaboradores = '',
    escritorio    = '',
  } = body;

  const eventTime = Math.floor(Date.now() / 1000);
  const ip        = getClientIp(req);
  const ua        = user_agent || req.headers['user-agent'] || '';
  const finalEventId = event_id || `ev_${eventTime}_${crypto.randomBytes(4).toString('hex')}`;

  // Localização pelo IP antes de gravar: o valor vai junto na linha do lead e é
  // o que os eventos de CRM — que saem depois, sem IP nenhum — reaproveitam.
  // Falha aqui devolve null e o lead segue sem os campos.
  const geo = await localizarPorIp(ip, { seguro: ehConsultoria(pagina) });

  const leadData = {
    nome, email, telefone, pagina,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    fbclid, gclid, ttclid, msclkid,
    fbp, fbc, external_id,
    event_id: finalEventId,
    page_url, user_agent: ua,
    cargo, colaboradores, escritorio,
    geo_cidade:  geo?.cidade || null,
    geo_estado:  geo?.estado || null,
    geo_cep:     geo?.cep    || null,
    geo_raio_km: geo?.raioKm ?? null,
    geo_asn:     geo?.asn    || null,
  };

  if (ehConsultoria(pagina)) {
    const resultado = await processarConsultoria(leadData, integracoesConsultoria(req, { ip, eventTime, referrer }));
    return res.status(resultado.status).json(resultado.body);
  }

  // ── 1. Supabase primeiro — crítico, aguarda antes de tudo ─────
  await saveToSupabase(leadData);

  // ── 2-5. Planilha + RD Marketing + RD CRM + Meta CAPI em paralelo ──
  const userData = montarUserData({
    email, telefone, nome, pais: 'br',
    // Palpite do IP, não dado declarado. Só entra quando a MaxMind respondeu
    // dentro do raio de precisão aceito — ver lib/geo.js.
    cidade: geo?.cidade, estado: geo?.estado, cep: geo?.cep,
    // O id do navegador e o e-mail: o CRM identifica a pessoa pelo e-mail, e
    // sem ele aqui o Lead da landing page e o evento do CRM ficam sendo duas
    // pessoas diferentes para o Meta.
    externalId: [external_id, email],
    fbp, fbc, fbclid,
    ip, userAgent: ua, quandoMs: eventTime * 1000,
  });

  const customData = {
    content_name: pagina, content_category: 'pre-inscricao', currency: 'BRL', value: 0,
  };
  if (utm_source)   customData.utm_source   = utm_source;
  if (utm_medium)   customData.utm_medium   = utm_medium;
  if (utm_campaign) customData.utm_campaign = utm_campaign;
  if (utm_term)     customData.utm_term     = utm_term;
  if (utm_content)  customData.utm_content  = utm_content;
  if (gclid)        customData.gclid        = gclid;
  if (cargo)         customData.cargo         = cargo;
  if (colaboradores) customData.colaboradores = colaboradores;
  if (escritorio)    customData.escritorio    = escritorio;

  const sourceUrl   = page_url || req.headers.referer || '';
  // De onde veio a visita. `event_source_url` é a página do formulário; este é
  // o passo anterior, e o Meta o usa como sinal próprio de atribuição.
  const referrerUrl = referrer || '';

  const [, , , capiResult, qualificadoResult] = await Promise.allSettled([
    gravarLead(leadData),
    sendToRDMarketing(leadData),
    sendToRDCRM(leadData),
    enviarEvento({
      evento:       'Lead',
      eventId:      finalEventId,
      quando:       eventTime,
      userData,
      customData,
      sourceUrl,
      referrerUrl,
      actionSource: 'website',
    }),
    enviarLeadQualificado(leadData, { userData, eventTime, sourceUrl, referrerUrl }),
  ]);

  const capiData = capiResult.status === 'fulfilled' ? capiResult.value : {};

  try {
    const qualificado = qualificadoResult.status === 'fulfilled' ? qualificadoResult.value : {};

    return res.status(200).json({
      ok:              true,
      events_received: capiData?.recebidos ?? 0,
      fbtrace_id:      capiData?.fbtrace_id ?? '',
      lead_qualificado: Boolean(qualificado?.enviado),
    });

  } catch (err) {
    console.error('[CAPI Exception]', err.message);
    return res.status(200).json({ ok: true, error: 'capi_exception' });
  }
};
