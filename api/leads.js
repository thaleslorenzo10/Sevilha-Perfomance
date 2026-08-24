/**
 * Sevilha Performance — Vercel Serverless Function
 * POST /api/leads
 *
 * 1. Salva lead no Supabase (tabela: sevilha_leads)
 * 2. Grava a linha na planilha (páginas com formulário próprio)
 * 3. Envia para RD Station Marketing e para o RD Station CRM
 * 4. Envia Lead para a Meta Conversions API (CAPI) — e LeadQualificado quando
 *    o escritório tem 10 ou mais colaboradores
 *
 * Variáveis de ambiente no Vercel:
 *   SUPABASE_URL          = https://hojcntkggnwrvbvmcwxe.supabase.co
 *   SUPABASE_SERVICE_KEY  = <service_role key>
 *   META_CAPI_TOKEN       = <System User Access Token>
 *   RD_MARKETING_TOKEN    = <RD Station Marketing API token>
 */

'use strict';

const crypto = require('crypto');

// Normalização, hash e envio ao CAPI moram em lib/capi.js — o mesmo caminho que
// o webhook do Respondi usa, para os dois eventos hasharem igual.
const { enviarEvento, montarUserData, normalizarTelefone, eventIdPorContato } = require('../lib/capi');
const { ehQualificado } = require('../lib/porte');
const registroDeEventos = require('../lib/eventos-enviados');
const { gravarLead } = require('../lib/sheets-write');
const { TABELAS } = require('../lib/supabase');

/* ─────────────────────────────────────────────────────────
   OFERTAS

   Duas ofertas dividem este endpoint. O Clube da Performance é mentoria para
   escritórios de até 10 colaboradores; a Sessão Estratégica (/mentoria e
   /mentoria-2, em teste A/B) é o
   diagnóstico da consultoria, para escritórios acima de 10. Os leads entram no
   mesmo funil do CRM, mas precisam ser distinguíveis depois — daí a marca no
   nome do deal e o identificador de conversão próprio no RD Marketing.

   As etapas e campanhas continuam configuráveis por ambiente: no dia em que a
   Sessão Estratégica ganhar funil próprio, é variável, não deploy de código.
───────────────────────────────────────────────────────── */

const SESSAO_ESTRATEGICA = {
  rotulo:      'Sessão Estratégica',
  marca:       '[SE]',
  conversao:   'sessao-estrategica-consultoria',
  tags:        ['sessao-estrategica', 'consultoria'],
  stageEnv:    'RD_CRM_STAGE_ID_SE',
  campaignEnv: 'RD_CRM_CAMPAIGN_ID_SE',
};

// Toda página nova da Sessão Estratégica precisa entrar aqui. Fora do mapa, o
// lead cai no padrão e entra no funil do Clube da Performance — silenciosamente.
const OFERTAS = {
  '/mentoria':   SESSAO_ESTRATEGICA,
  '/mentoria-2': SESSAO_ESTRATEGICA,
};

const OFERTA_PADRAO = {
  rotulo:      'Clube da Performance',
  marca:       '',
  conversao:   'pre-inscricao-clube-da-performance',
  tags:        ['pre-inscricao', 'clube-da-performance'],
  stageEnv:    'RD_CRM_STAGE_ID',
  campaignEnv: 'RD_CRM_CAMPAIGN_ID',
};

function ofertaDe(pagina) {
  return OFERTAS[pagina] || OFERTA_PADRAO;
}

/** Nome do deal marcado com a oferta, para separar os dois produtos no funil. */
function nomeDoDeal(data, oferta) {
  const base = data.nome || data.email || 'Lead';
  return oferta.marca ? `${oferta.marca} ${base}` : base;
}

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────
   RD STATION MARKETING
───────────────────────────────────────────────────────── */

async function sendToRDMarketing(data) {
  const oferta = ofertaDe(data.pagina);
  const token  = process.env.RD_MARKETING_TOKEN;
  if (!token) {
    console.warn('[RD Marketing] RD_MARKETING_TOKEN não definido');
    return;
  }

  const payload = {
    event_type:   'CONVERSION',
    event_family: 'CDP',
    payload: {
      conversion_identifier: oferta.conversao,
      name:             data.nome     || undefined,
      email:            data.email    || undefined,
      mobile_phone:     data.telefone || undefined,
      tags:             oferta.tags,
      traffic_source:   data.utm_source   || undefined,
      traffic_medium:   data.utm_medium   || undefined,
      traffic_campaign: data.utm_campaign || undefined,
      traffic_value:    data.utm_term     || undefined,
      traffic_content:  data.utm_content  || undefined,
      cf_pagina:        data.pagina       || undefined,
      cf_cargo:         data.cargo        || undefined,
      cf_colaboradores: data.colaboradores || undefined,
      cf_escritorio:    data.escritorio   || undefined,
    },
  };

  // Remove campos undefined
  Object.keys(payload.payload).forEach(k => {
    if (payload.payload[k] === undefined) delete payload.payload[k];
  });

  try {
    const res = await fetch(`https://api.rd.services/platform/conversions?api_key=${token}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('[RD Marketing Error]', res.status, await res.text());
    } else {
      console.log(`[RD Marketing OK] lead enviado — email=${data.email}`);
    }
  } catch (err) {
    console.error('[RD Marketing Exception]', err.message);
  }
}

/* ─────────────────────────────────────────────────────────
   RD STATION CRM

   IMPORTANTE — comportamento verificado empiricamente da API v1
   (validado em scripts/test-api-leads-e2e.js):

   • Para CRIAR deal + contato novo:
       POST /deals  →  body: { deal: {...}, contacts: [{name, emails, phones}] }
       (contacts INLINE no ROOT do body — NÃO funciona passar só {id}/{_id})

   • Para vincular um contato EXISTENTE a um deal NOVO:
       1. POST /deals  →  body: { deal: {...} }   (sem contacts)
       2. PUT /contacts/:id  →  body: { contact: { deal_ids: [novoDealId, ...] } }

   • Campo `contact_id` dentro de `deal` é SILENCIOSAMENTE IGNORADO
     (era o bug que deixava deals sem email/telefone no CRM).
───────────────────────────────────────────────────────── */

/**
 * O que a API devolve depois de criar o deal — funil, etapa, responsável e
 * nome. Sem isso o log diz "criado" e ninguém sabe onde procurar quando o deal
 * não aparece na tela que a pessoa está olhando.
 */
function ondeCaiu(d) {
  if (!d || typeof d !== 'object') return 'sem resposta detalhada';
  const etapa  = d.deal_stage?.name    || d.deal_stage_id    || '?';
  const funil   = d.deal_stage?.deal_pipeline?.name
               || d.deal_pipeline?.name || d.deal_pipeline_id || '?';
  const dono    = d.user?.name || d.user?.nickname || d.user_id || '?';
  const nome    = d.name || '?';
  return `nome="${nome}" funil="${funil}" etapa="${etapa}" responsavel="${dono}"`;
}

async function sendToRDCRM(data) {
  const oferta = ofertaDe(data.pagina);
  const token  = process.env.RD_CRM_TOKEN;
  if (!token) {
    console.warn('[RD CRM] RD_CRM_TOKEN não definido');
    return;
  }

  const BASE = 'https://crm.rdstation.com/api/v1';

  // Telefone sempre normalizado (só dígitos, 55 + DDD + número)
  const phoneNormalized = data.telefone ? normalizarTelefone(data.telefone) : null;

  const contactInline = {
    name:   data.nome || data.email || 'Lead',
    emails: data.email      ? [{ email: data.email }]                          : [],
    phones: phoneNormalized ? [{ phone: phoneNormalized, type: 'cellphone' }]  : [],
  };

  // TODOS os novos deals vão pro Geraldo Tadeu (100% dos leads)
  const GERALDO_USER_ID = '68e6e08c6c2ac10017538422';

  const deal = {
    name:           nomeDoDeal(data, oferta),
    // Funil "Clube da Performance", etapa "Pré-inscritos" — as duas ofertas
    // dividem o mesmo funil hoje. Sobrescrever pelo ambiente muda isso.
    deal_stage_id:  process.env[oferta.stageEnv]    || '69d52f54c0b8000015d2e7bb',
    deal_source_id: process.env.RD_CRM_SOURCE_ID    || '68e5c150af14bb00013f8acb', // Busca Paga | Facebook Ads
    campaign_id:    process.env[oferta.campaignEnv] || '69d52f437e5d76001a90e080', // [CP] Clube da Performance > CRM
    user_id:        GERALDO_USER_ID,            // owner = Geraldo Tadeu (100% dos leads)
    deal_custom_fields: [
      { custom_field_id: '68e6668a5621790019a1ad6d', value: data.utm_source    || '' },
      { custom_field_id: '68e6669152f4a7001f8d9f8f', value: data.utm_campaign  || '' },
      { custom_field_id: '68e666990450fa001e3e70f5', value: data.utm_content   || '' },
      { custom_field_id: '68e666a608aace0019e118a1', value: data.utm_medium    || '' },
      { custom_field_id: '68e6647cca456d0019525bae', value: data.cargo         || '' },
      { custom_field_id: '68e6647462dc7600149cef2c', value: data.colaboradores || '' },
      { custom_field_id: '693057aecc0b1f0020a3fa25', value: data.escritorio    || '' },
    ].filter(f => f.value),
  };

  try {
    // ── 1. Busca contato existente pelo email ─────────────────────
    let existingContactId = null;
    if (data.email) {
      try {
        const sRes = await fetch(
          `${BASE}/contacts?token=${token}&email=${encodeURIComponent(data.email)}`
        );
        if (sRes.ok) {
          const sData = await sRes.json();
          const found = (sData.contacts || [])[0];
          if (found) existingContactId = found._id || found.id;
        }
      } catch (e) {
        console.warn('[RD CRM] busca por email falhou:', e.message);
      }
    }

    // ── 2. Cria deal ──────────────────────────────────────────────
    let dealId = null;

    if (existingContactId) {
      // 2a. Contato existe → atualiza dados, cria deal bare, vincula depois
      try {
        await fetch(`${BASE}/contacts/${existingContactId}?token=${token}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ contact: contactInline }),
        });
      } catch (e) {
        console.warn('[RD CRM] update contato existente falhou:', e.message);
      }

      const dRes = await fetch(`${BASE}/deals?token=${token}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deal }),
      });
      if (!dRes.ok) {
        console.error('[RD CRM Deal Error]', dRes.status, await dRes.text());
        return;
      }
      const d = await dRes.json();
      dealId = d._id || d.id;
      console.log(`[RD CRM] deal ${dealId} ${ondeCaiu(d)}`);

      // Vincula deal ao contato via PUT /contacts com deal_ids mesclado
      try {
        const gRes = await fetch(`${BASE}/contacts/${existingContactId}?token=${token}`);
        const currentContact = gRes.ok ? await gRes.json() : {};
        const currentIds = (currentContact.deal_ids || [])
          .map(d => typeof d === 'string' ? d : (d._id || d.id))
          .filter(Boolean);
        const newIds = currentIds.includes(dealId) ? currentIds : [...currentIds, dealId];

        await fetch(`${BASE}/contacts/${existingContactId}?token=${token}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ contact: { deal_ids: newIds } }),
        });
        console.log(`[RD CRM OK] deal ${dealId} vinculado a contato existente ${existingContactId} — email=${data.email}`);
      } catch (e) {
        console.warn('[RD CRM] vínculo pós-criação falhou:', e.message);
      }
    } else {
      // 2b. Contato novo → POST /deals com contacts inline no ROOT
      const dRes = await fetch(`${BASE}/deals?token=${token}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ deal, contacts: [contactInline] }),
      });
      if (!dRes.ok) {
        console.error('[RD CRM Deal Error]', dRes.status, await dRes.text());
        return;
      }
      const d = await dRes.json();
      dealId = d._id || d.id;
      console.log(`[RD CRM OK] deal criado com contato inline — id=${dealId} ${ondeCaiu(d)} email=${data.email}`);
    }
  } catch (err) {
    console.error('[RD CRM Exception]', err.message);
  }
}


/* ─────────────────────────────────────────────────────────
   LEADQUALIFICADO

   O evento existe para o Meta aprender com quem tem o porte que a consultoria
   atende. Os dois funis antigos não passam por servidor nosso no momento da
   conversão, então /api/eventos-qualificados os varre das planilhas de 4 em 4
   horas (workflow do n8n). O formulário desta landing page passa por aqui, e
   esperar a varredura seria atrasar o evento sem motivo — além de não
   funcionar, porque a varredura lê as planilhas do Respondi e do Meta, não a
   aba que gravamos.

   A trava de reenvio é a mesma tabela da varredura, e o event_id segue a mesma
   convenção determinística: se um dia as duas fontes se cruzarem, o Meta não
   conta a conversão duas vezes.
─────────────────────────────────────────────────────────── */

const EVENTO_QUALIFICADO = 'LeadQualificado';

async function enviarLeadQualificado(data, { userData, eventTime, sourceUrl }) {
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
      },
      sourceUrl,
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
    cargo         = '',
    colaboradores = '',
    escritorio    = '',
  } = body;

  const eventTime = Math.floor(Date.now() / 1000);
  const ip        = getClientIp(req);
  const ua        = user_agent || req.headers['user-agent'] || '';
  const finalEventId = event_id || `ev_${eventTime}_${crypto.randomBytes(4).toString('hex')}`;

  const leadData = {
    nome, email, telefone, pagina,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    fbclid, gclid, ttclid, msclkid,
    fbp, fbc, external_id,
    event_id: finalEventId,
    page_url, user_agent: ua,
    cargo, colaboradores, escritorio,
  };

  // ── 1. Supabase primeiro — crítico, aguarda antes de tudo ─────
  await saveToSupabase(leadData);

  // ── 2-5. Planilha + RD Marketing + RD CRM + Meta CAPI em paralelo ──
  const userData = montarUserData({
    email, telefone, nome, pais: 'br',
    externalId: external_id, fbp, fbc, fbclid,
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

  const sourceUrl = page_url || req.headers.referer || '';

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
      actionSource: 'website',
    }),
    enviarLeadQualificado(leadData, { userData, eventTime, sourceUrl }),
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
