'use strict';

// Contrato agregado compartilhado pelo painel original e pela central Lorenzo.
// O recorte de origem/edição precede o dedupe: reinscrição em outro funil é válida.
const { lerForms, lerSupabase } = require('./leads-fontes');
const { unificar } = require('./leads-unificados');
const { lerCompras } = require('./eventos-dashboard-compras');
const { EVENTOS, validarPeriodo } = require('./eventos-dashboard');
const FIXTURES = new Set(['0a3e7114-4605-4c8c-a262-7a545a35d42d', '036875a5-d83e-4400-ad4a-3e5011f32d71']);
const PAGINAS_SITE = new Set(['/mentoria', '/mentoria-2', '/formulario-consultoria']);
const CAMPANHAS = Object.freeze({
  sessao_site: ['120253649292430526'],
  sessao_formulario: ['120253413819760526', '120253330191810526', '120252309825010526', '120252309137770526', '120248779747120526', '120244151200240526', '120244151189900526', '120240157588290526', '120235128444610526', '120234941844500526'],
  'aula-2026-10-27': ['120253647076340526', '120253647019390526', '120253257675140526', '120253257675000526'],
  'aula-2026-10-06': ['120253422702950526', '120253422686060526', '120253422648440526', '120253257675140526', '120253257675000526', '120253144969620526'],
  'cafe-2026-11-11': ['120253550384170526'],
});

function escopo(funil, edicao, since, until) {
  validarPeriodo(since, until);
  if ((Date.parse(until) - Date.parse(since)) / 86400000 > 365) throw Error('Período máximo de 366 dias');
  if (!['sessao_formulario', 'sessao_site', 'aula', 'cafe'].includes(funil)) throw Error('Funil inválido');
  const evento = EVENTOS.find(e => e.id === edicao && e.grupo.toLowerCase() === funil);
  if (['aula', 'cafe'].includes(funil) && !evento) throw Error('Edição obrigatória e compatível com o funil');
  if (funil.startsWith('sessao_') && edicao) throw Error('Perpétuo não aceita edição');
  if (evento && (since < evento.inicio || until > evento.data)) throw Error('Período fora da edição');
  return evento;
}

const paginaDe = l => String(l.pagina || '').replace(/\/+$/, '');
function filtrar(funil) {
  if (funil === 'sessao_formulario') return l => l.fonte === 'FORMS' && l.grupo === 'SE';
  if (funil === 'sessao_site') return l => l.fonte === 'SUPABASE' && PAGINAS_SITE.has(paginaDe(l)) && !FIXTURES.has(l.id);
  if (funil === 'aula') return l => l.fonte === 'SUPABASE' && paginaDe(l) === '/aula-gestao-operacional';
  return l => l.grupo === 'CAFE' && (paginaDe(l) === '/cafe-com-sevilha' || l.fonte === 'CAFE');
}

const seguro = valor => {
  const s = [...String(valor || '')].filter(c => c.charCodeAt(0) >= 32).join('').slice(0, 160);
  return !s || /@|(?:\+?\d[\s().-]*){10,}/.test(s) ? 'Sem etiqueta válida' : s;
};
function agregados(leads, estrita) {
  const total = leads.total;
  const contar = l => ({ leads: l.leads, qualificados: estrita && total.indeterminados ? null : l.mql });
  return {
    total: contar(total),
    por_dia: leads.por_dia.map(l => ({ dia: l.dia, ...contar(l) })),
    por_campanha: leads.por_campanha.map(l => ({ campanha: seguro(l.campanha), ...contar(l) })),
    por_pagina: leads.por_pagina.map(l => ({ pagina: seguro(l.pagina), ...contar(l) })),
    qualificacao: { regra: estrita ? 'Mais de 10 colaboradores; faixa de 10 a 19 indeterminada' : '10 ou mais colaboradores', confirmados: total.mql, indeterminados: estrita ? total.indeterminados : null },
  };
}

async function montar({ funil, edicao = null, since, until }, fontes = { forms: lerForms, supabase: lerSupabase, compras: lerCompras }) {
  const evento = escopo(funil, edicao, since, until);
  const nativa = funil === 'sessao_formulario';
  const opcoes = { filtrarLead: filtrar(funil), consultoriaEstrita: funil.startsWith('sessao_'), inicioEdicao: evento?.inicio, fimEdicao: evento?.data };
  const [leitura, compras] = await Promise.allSettled([
    nativa ? fontes.forms() : fontes.supabase(since, until, opcoes),
    funil === 'aula' ? fontes.compras(since, until) : Promise.resolve(null),
  ]);
  const resposta = { cliente: 'sevilha-performance', funil, edicao, periodo: { since, until, fuso: 'America/Sao_Paulo' },
    gerado_em: new Date().toISOString(), campaign_ids: CAMPANHAS[edicao || funil],
    total: { leads: null, qualificados: null }, por_dia: [], por_campanha: [], por_pagina: [], qualificacao: null,
    fontes: [{ nome: nativa ? 'FORMS' : 'SUPABASE', disponivel: leitura.status === 'fulfilled' }], compras: null, fixtures_excluidas: 0 };
  if (leitura.status === 'fulfilled') {
    const registros = leitura.value.registros;
    const payload = unificar({ [nativa ? 'forms' : 'supabase']: registros }, since, until, opcoes);
    Object.assign(resposta, agregados(payload, opcoes.consultoriaEstrita));
    resposta.fixtures_excluidas = registros.filter(l => FIXTURES.has(l.id)).length;
  }
  if (funil === 'aula') {
    resposta.fontes.push({ nome: 'KIWIFY_WEBHOOK', disponivel: compras.status === 'fulfilled' });
    if (compras.status === 'fulfilled') resposta.compras = compras.value;
  }
  return resposta;
}

async function responder(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  const args = Object.fromEntries(['funil', 'edicao', 'since', 'until'].map(k => [k, params.get(k)]));
  try { escopo(args.funil, args.edicao, args.since, args.until); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  res.setHeader('Cache-Control', 'no-store');
  try { return res.status(200).json(await montar(args)); }
  catch { return res.status(502).json({ error: 'Fonte operacional indisponível' }); }
}

module.exports = { montar, responder, escopo, CAMPANHAS };
