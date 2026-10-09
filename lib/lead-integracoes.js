'use strict';

const { normalizarTelefone } = require('./capi');

const SESSAO = {
  marca: '[SE]', conversao: 'sessao-estrategica-consultoria',
  tags: ['sessao-estrategica', 'consultoria'], stageEnv: 'RD_CRM_STAGE_ID_SE', campaignEnv: 'RD_CRM_CAMPAIGN_ID_SE',
};
const CLUBE = {
  marca: '', conversao: 'pre-inscricao-clube-da-performance',
  tags: ['pre-inscricao', 'clube-da-performance'], stageEnv: 'RD_CRM_STAGE_ID', campaignEnv: 'RD_CRM_CAMPAIGN_ID',
};
const ehConsultoria = pagina => ['/mentoria', '/mentoria-2'].includes(pagina);
const ofertaDe = pagina => ehConsultoria(pagina) ? SESSAO : CLUBE;
const idSeguro = valor => /^[a-zA-Z0-9_:.!-]{1,160}$/.test(String(valor || '')) ? String(valor) : undefined;
const recibo = (status, extra = {}) => ({ status, ...extra });

async function chamar(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  const json = r.status === 204 ? {} : await r.json();
  if (!r.ok || json.error || json.errors) {
    const erro = new Error('destino_recusou');
    erro.status = r.status;
    erro.rejeitado = (r.status >= 400 && r.status < 500) || (r.ok && Boolean(json.error || json.errors));
    throw erro;
  }
  return json;
}

async function sendToRDMarketing(data) {
  const token = process.env.RD_MARKETING_TOKEN;
  if (!token) return recibo('nao_configurado');
  const oferta = ofertaDe(data.pagina);
  const payload = {
    conversion_identifier: oferta.conversao, name: data.nome, email: data.email,
    mobile_phone: data.telefone, tags: oferta.tags, traffic_source: data.utm_source,
    traffic_medium: data.utm_medium, traffic_campaign: data.utm_campaign,
    traffic_value: data.utm_term, traffic_content: data.utm_content,
    cf_pagina: data.pagina, cf_cargo: data.cargo, cf_colaboradores: data.colaboradores, cf_escritorio: data.escritorio,
  };
  Object.keys(payload).forEach(k => { if (!payload[k]) delete payload[k]; });
  try {
    await chamar(`https://api.rd.services/platform/conversions?api_key=${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'CONVERSION', event_family: 'CDP', payload }),
    });
    return recibo('enviado');
  } catch (e) {
    // 5xx/rede podem ter aplicado o POST: reconciliar antes de repetir.
    return recibo(e.rejeitado ? 'falhou' : 'incerto', { codigo: 'rd_marketing_recusou' });
  }
}

function dealDe(data, oferta) {
  const base = data.nome || data.email || 'Lead';
  return {
    name: oferta.marca ? `${oferta.marca} ${base}` : base,
    deal_stage_id: process.env[oferta.stageEnv] || (oferta === CLUBE ? '69d52f54c0b8000015d2e7bb' : undefined),
    deal_source_id: process.env.RD_CRM_SOURCE_ID || '68e5c150af14bb00013f8acb',
    campaign_id: process.env[oferta.campaignEnv] || (oferta === CLUBE ? '69d52f437e5d76001a90e080' : undefined),
    user_id: '68e6e08c6c2ac10017538422',
    deal_custom_fields: [
      ['68e6668a5621790019a1ad6d', data.utm_source], ['68e6669152f4a7001f8d9f8f', data.utm_campaign],
      ['68e666990450fa001e3e70f5', data.utm_content], ['68e666a608aace0019e118a1', data.utm_medium],
      ['68e6647cca456d0019525bae', data.cargo], ['68e6647462dc7600149cef2c', data.colaboradores],
      ['693057aecc0b1f0020a3fa25', data.escritorio],
    ].filter(([, value]) => value).map(([custom_field_id, value]) => ({ custom_field_id, value })),
  };
}

async function vincularContato(api, contactId, dealId) {
  const current = await api(`/contacts/${contactId}`);
  const ids = (current.deal_ids || []).map(d => typeof d === 'string' ? d : d._id || d.id).filter(Boolean);
  await api(`/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify({ contact: { deal_ids: [...new Set([...ids, dealId])] } }) });
  const verificado = await api(`/contacts/${contactId}`);
  if (!(verificado.deal_ids || []).some(d => (typeof d === 'string' ? d : d._id || d.id) === dealId)) {
    throw new Error('crm_vinculo_ausente');
  }
}

async function sendToRDCRM(data, anterior = {}, checkpoint = async () => {}) {
  const token = process.env.RD_CRM_TOKEN;
  if (!token) return recibo('nao_configurado');
  if (ehConsultoria(data.pagina) && !process.env.RD_CRM_STAGE_ID_SE?.trim()) return recibo('nao_configurado', { codigo: 'crm_etapa_se_ausente' });
  const api = (path, options = {}) => chamar(`https://crm.rdstation.com/api/v1${path}${path.includes('?') ? '&' : '?'}token=${token}`, {
    ...options, headers: { 'Content-Type': 'application/json' },
  });
  let contactId = idSeguro(anterior.contact_id);
  let dealId = idSeguro(anterior.deal_id);
  let criando = false;
  try {
    if (!dealId) {
      const search = data.email ? await api(`/contacts?email=${encodeURIComponent(data.email)}`) : { contacts: [] };
      const found = (search.contacts || [])[0];
      contactId = idSeguro(found?._id || found?.id);
      const contact = {
        name: data.nome || data.email || 'Lead', emails: data.email ? [{ email: data.email }] : [],
        phones: data.telefone ? [{ phone: normalizarTelefone(data.telefone), type: 'cellphone' }] : [],
      };
      if (contactId) await api(`/contacts/${contactId}`, { method: 'PUT', body: JSON.stringify({ contact }) });
      criando = true;
      const d = await api('/deals', {
        method: 'POST', body: JSON.stringify({ deal: dealDe(data, ofertaDe(data.pagina)), ...(!contactId ? { contacts: [contact] } : {}) }),
      });
      dealId = idSeguro(d._id || d.id);
      if (!dealId) return recibo('incerto', { codigo: 'crm_sem_id' });
      await checkpoint(recibo('processando', { deal_id: dealId, ...(contactId ? { contact_id: contactId } : {}) }));
    }
    if (contactId) await vincularContato(api, contactId, dealId);
    else {
      const detail = await api(`/deals/${dealId}`);
      const linked = (detail.contacts || []).some(c => (c.emails || []).some(e => (e.email || e) === data.email));
      if (!linked) return recibo('incerto', { deal_id: dealId, codigo: 'crm_vinculo_ausente' });
    }
    return recibo('enviado', { deal_id: dealId, ...(contactId ? { contact_id: contactId } : {}) });
  } catch (e) {
    const status = dealId || !criando || e.rejeitado ? 'falhou' : 'incerto';
    return recibo(status, { codigo: 'crm_nao_confirmado', ...(dealId ? { deal_id: dealId } : {}), ...(contactId ? { contact_id: contactId } : {}) });
  }
}

module.exports = { ehConsultoria, sendToRDMarketing, sendToRDCRM, idSeguro, recibo };
