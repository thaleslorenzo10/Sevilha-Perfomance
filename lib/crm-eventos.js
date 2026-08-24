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
 *   1. transformar a etapa em evento (marco conhecido ganha nome próprio; o
 *      resto vira CRM + nome da etapa);
 *   2. recuperar o lead original no Supabase para melhorar a correspondência
 *      (fbclid e telefone que o CRM não guarda);
 *   3. mandar o evento, uma vez só por negociação e por etapa.
 *
 * Variáveis de ambiente:
 *   RD_CRM_TOKEN          = token do RD CRM. O webhook não manda contato
 *                           nenhum, então sem este token não há e-mail para
 *                           mandar ao Meta e nenhum evento sai.
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

/**
 * Etapa sem padrão conhecido também vira evento, nomeado a partir dela.
 *
 * "Pré-inscritos" → `CRMPreInscritos`. O prefixo separa, no Gerenciador de
 * Eventos, o que veio do funil do que veio do site — sem ele, uma etapa
 * chamada "Lead" viraria um evento com o mesmo nome do evento padrão do Meta e
 * os dois se misturariam nos relatórios.
 *
 * O Meta aceita letra, número e underscore no nome de evento personalizado, e
 * corta o que for longo demais; a sanitização aqui evita que ele decida por nós.
 */
const TAMANHO_MAX_EVENTO = 40;

function eventoDaEtapa(etapa) {
  const limpo = norm(etapa).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (!limpo.length) return null;

  const camel = limpo.map(p => p[0].toUpperCase() + p.slice(1)).join('');
  return ('CRM' + camel).slice(0, TAMANHO_MAX_EVENTO);
}

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
  if (padrao) return padrao.evento;

  // Toda etapa vira evento: mais sinal para o Meta trabalhar. O que decide se
  // um evento é útil é o volume dele, não a existência — e etapa que nunca
  // acontece simplesmente não gera evento nenhum.
  return eventoDaEtapa(deal.etapa);
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
    etapaId: d.deal_stage?.id || d.deal_stage?._id || d.deal_stage_id || null,
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

/* ── Busca do contato no CRM ─────────────────────────────────────────── */

/**
 * O payload do webhook de negociação do RD CRM não inclui contatos — só o
 * negócio. E sem e-mail ou telefone o Meta não tem com quem casar o evento,
 * então o webhook sozinho não basta: buscamos a negociação completa na API.
 *
 * Documentado aqui porque é contraintuitivo e custou uma leitura da referência:
 * https://developers.rdstation.com/reference/webhooks-payload-crm
 */
async function contatosDoDeal(dealId) {
  const token = process.env.RD_CRM_TOKEN;
  if (!token || !dealId) return null;

  try {
    const res = await fetch(`https://crm.rdstation.com/api/v1/deals/${dealId}?token=${token}`);
    if (!res.ok) {
      console.warn(`[CRM webhook] não foi possível ler o deal ${dealId}: HTTP ${res.status}`);
      return null;
    }
    const d = await res.json();
    const contatos = d.contacts || [];
    return {
      email:    contatos.flatMap(c => (c.emails || []).map(e => e.email)).filter(Boolean)[0] || null,
      telefone: contatos.flatMap(c => (c.phones || []).map(p => p.phone)).filter(Boolean)[0] || null,
      nome:     contatos[0]?.name || null,
    };
  } catch (e) {
    console.warn('[CRM webhook] falha ao buscar o deal no CRM:', e.message);
    return null;
  }
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

/**
 * Monta user_data e custom_data do evento. Webhook e varredura mandam o mesmo
 * conteúdo de propósito: se um dia os dois rodarem para a mesma negociação, o
 * que o Meta recebe não pode depender de qual caminho chegou primeiro.
 */
async function montarEvento(deal, evento, indiceLeadId) {
  const original = await leadOriginal(deal.email);

  // O lead_id é o identificador que o próprio Meta deu ao lead do formulário
  // instantâneo, e é a chave de correspondência de prioridade mais alta que
  // existe — acima até de e-mail. O CRM não o guarda, mas o export do Meta sim:
  // casamos por e-mail ou telefone para recuperá-lo.
  const leadId = indiceLeadId ? procurarLeadId(indiceLeadId, deal) : null;

  const userData = montarUserData({
    email:      deal.email,
    telefone:   deal.telefone || original?.telefone,
    nome:       deal.contato,
    pais:       'br',
    externalId: deal.email,
    leadId:     leadId || undefined,
    fbclid:     original?.fbclid,
    quandoMs:   original?.created_at ? Date.parse(original.created_at) : undefined,
  });

  const customData = {
    // Os dois campos que o guia "Enviar um evento de CRM" exige para o Meta
    // tratar isto como evento de CRM, e não como um evento personalizado
    // qualquer. Sem eles o evento é aceito, mas não entra na integração de
    // leads qualificados — que é justamente o que se quer alimentar.
    event_source:      'crm',
    lead_event_source: 'RD Station CRM',
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

  return { userData, customData };
}

/** Acha o lead_id do Meta pelo contato da negociação. */
function procurarLeadId(indice, deal) {
  const porEmail = deal.email && indice.get('e:' + norm(deal.email));
  if (porEmail) return porEmail;

  const digitos = String(deal.telefone || '').replace(/\D/g, '').slice(-11);
  return (digitos && indice.get('t:' + digitos)) || null;
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

  if (body?.event_name === 'crm_deal_deleted') {
    return res.status(200).json({ ok: true, ignorado: true, motivo: 'negociação excluída' });
  }

  const deal   = lerDeal(body);
  const evento = eventoDe(deal);

  if (!evento) {
    // Ignorar é o caso comum: o CRM avisa toda mudança, e a maioria não é
    // marco de funil. O log traz a etapa para dar nome ao que falta mapear.
    console.log(`[CRM webhook] sem evento para etapa="${deal.etapa || '?'}" deal=${deal.id || '?'}`);
    return res.status(200).json({ ok: true, ignorado: true, etapa: deal.etapa });
  }

  // O caminho normal passa por aqui: o webhook não manda contato nenhum.
  if (!deal.email && !deal.telefone) {
    const doCrm = await contatosDoDeal(deal.id);
    if (doCrm) {
      deal.email    = doCrm.email;
      deal.telefone = doCrm.telefone;
      deal.contato  = deal.contato || doCrm.nome;
    }
  }

  if (!deal.email && !deal.telefone) {
    console.warn(`[CRM webhook] deal=${deal.id} sem e-mail nem telefone, nem no payload nem na API — ` +
      'sem isso o Meta não casa com ninguém. Confira RD_CRM_TOKEN.');
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

  const { userData, customData } = await montarEvento(deal, evento);

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

/* ── Varredura ───────────────────────────────────────────────────────── */

/**
 * O mesmo trabalho do webhook, só que puxando em vez de esperando.
 *
 * Existe porque webhook no RD CRM depende do plano Basic para cima: no Free a
 * tela nem aparece. A API de negociações, essa responde em qualquer plano — é
 * a mesma que já usamos para criar os deals. Então a varredura é o caminho que
 * funciona sem depender de contrato, e o webhook vira otimização de latência
 * para quando houver plano.
 *
 * Roda no cron diário. A trava é a mesma do webhook, então os dois podem
 * conviver sem mandar o evento duas vezes.
 */
/**
 * Índice contato → lead_id, montado a partir dos leads que o cron já leu da
 * planilha do formulário instantâneo. Sai de graça: os dados já estão em
 * memória quando a varredura do CRM começa.
 */
function indiceDeLeadIds(leads) {
  const indice = new Map();
  for (const l of leads || []) {
    if (!l.leadId) continue;
    if (l.email) indice.set('e:' + norm(l.email), l.leadId);
    const digitos = String(l.telefone || '').replace(/\D/g, '').slice(-11);
    if (digitos) indice.set('t:' + digitos, l.leadId);
  }
  return indice;
}

/** Etapa → funil, em uma chamada, para o log dizer de qual produto é o deal. */
async function mapaDeFunis(token) {
  try {
    const res = await fetch(`https://crm.rdstation.com/api/v1/deal_stages?token=${token}&limit=200`);
    if (!res.ok) return {};
    const json = await res.json();
    const mapa = {};
    for (const e of (json.deal_stages || [])) {
      mapa[e._id || e.id] = e.deal_pipeline?.name || null;
    }
    return mapa;
  } catch {
    return {};
  }
}

const JANELA_VARREDURA_DIAS = 7;   // o Meta recusa evento com mais de 7 dias
const PAGINAS_MAX = 10;            // 10 × 200 = 2000 negociações por execução

async function varrerCrm({ indiceLeadId } = {}) {
  const token = process.env.RD_CRM_TOKEN;
  if (!token) {
    console.warn('[CRM varredura] RD_CRM_TOKEN não definido — nada a fazer');
    return { ok: false, motivo: 'sem token' };
  }

  // A listagem de negociações traz a etapa, mas não o funil dela — sem este
  // mapa o log fica com "?" no lugar do funil e não dá para separar [SE] de [CP].
  const funilDaEtapa = await mapaDeFunis(token);

  const limite = Date.now() - JANELA_VARREDURA_DIAS * 86400_000;
  const candidatos = [];
  // Inventário do funil: quantas negociações em cada etapa e o que cada etapa
  // virou. É o que responde "por que não saiu evento nenhum?" sem precisar
  // abrir o CRM — e o que mostra o nome exato de uma etapa que os padrões não
  // pegaram, para mapear pelo ambiente em vez de adivinhar.
  const porEtapa = {};
  let paginas = 0;
  let truncou = false;

  // Sem ordem explícita a API decide sozinha por onde começar, e como paramos
  // em PAGINAS_MAX, começar pelos antigos significaria perder justamente as
  // negociações que mudaram hoje — as únicas que interessam.
  for (let page = 1; page <= PAGINAS_MAX; page++) {
    const res = await fetch(
      `https://crm.rdstation.com/api/v1/deals?token=${token}&limit=200&page=${page}` +
      `&order=updated_at&direction=desc`
    );
    if (!res.ok) {
      console.error(`[CRM varredura] HTTP ${res.status} na página ${page}`);
      break;
    }
    const json  = await res.json();
    const deals = json.deals || [];
    paginas++;
    if (!deals.length) break;

    let dentroDaJanela = 0;
    for (const bruto of deals) {
      const deal = lerDeal(bruto);
      if (!deal.funil && deal.etapaId) deal.funil = funilDaEtapa[deal.etapaId] || null;
      const quando = Date.parse(deal.quando || '') || 0;
      if (quando && quando < limite) { continue; }
      dentroDaJanela++;
      const evento = eventoDe(deal);

      const chave = deal.etapa || '(sem etapa)';
      porEtapa[chave] = porEtapa[chave] || { total: 0, evento: evento || null };
      porEtapa[chave].total++;
      if (evento) porEtapa[chave].evento = evento;

      if (evento) candidatos.push({ deal, evento, quando });
    }

    if (deals.length < 200) break;
    // Página inteira fora da janela: com a ordem por atualização, o resto é
    // ainda mais antigo. Parar aqui evita ler 2000 negociações todo dia.
    if (dentroDaJanela === 0) break;
    if (page === PAGINAS_MAX) truncou = true;
  }

  // Um lote de ids por vez: consultar a trava por evento faria N chamadas.
  const comId = candidatos.map(c => ({
    ...c,
    eventId: eventIdPorContato(`crm-${c.evento.toLowerCase()}`, c.deal.id || c.deal.email),
  }));
  const jaForam = comId.length ? await registro.jaEnviados(comId.map(c => c.eventId)) : new Set();
  const novos   = comId.filter(c => !jaForam.has(c.eventId));

  let enviados = 0, falhas = 0, semContato = 0;
  const marcar = [];

  for (const { deal, evento, eventId, quando } of novos) {
    if (!deal.email && !deal.telefone) {
      const doCrm = await contatosDoDeal(deal.id);
      if (doCrm) { deal.email = doCrm.email; deal.telefone = doCrm.telefone; deal.contato = deal.contato || doCrm.nome; }
    }
    if (!deal.email && !deal.telefone) { semContato++; continue; }

    const resultado = await enviarEvento({
      evento,
      eventId,
      quando: quando ? Math.floor(quando / 1000) : undefined,
      ...(await montarEvento(deal, evento, indiceLeadId)),
      actionSource: 'system_generated',
    });

    if (resultado.ok) { enviados++; marcar.push({ event_id: eventId, evento, fonte: `rd-crm-varredura:${deal.funil || '?'}` }); }
    else falhas++;
  }

  if (marcar.length) await registro.marcarEnviados(marcar);

  const resumo = { ok: true, paginas, candidatos: candidatos.length, ja_enviados: jaForam.size, enviados, falhas, sem_contato: semContato, truncou, por_etapa: porEtapa };
  console.log('[CRM varredura]', JSON.stringify(resumo));
  return resumo;
}

module.exports = { tratarWebhook, varrerCrm, indiceDeLeadIds, eventoDe, eventoDaEtapa, lerDeal, contatosDoDeal, PADROES, EVENTO_GANHO };
