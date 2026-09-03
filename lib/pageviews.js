'use strict';

/**
 * Registro de visita, compartilhado por duas entradas:
 *
 *   • /api/ab      — o redirect do teste A/B, que já sabe a variante sorteada.
 *   • /api/pageview — beacon das páginas fora do rodízio (a /mentoria é acessada
 *     direto pelo anúncio, sem passar pelo redirect; sem beacon ela não teria
 *     visita registrada e nenhuma taxa de conversão seria calculável).
 *
 * Bot não conta: inflaria o denominador da conversão sem nunca preencher
 * formulário. E o IP é truncado antes de sair daqui (LGPD) — o último octeto
 * não acrescenta nada a uma métrica agregada e é o que individualiza a pessoa.
 *
 * `variant` só existe para o rodízio: página fora dele grava NULL. A coluna era
 * NOT NULL até a migração `sevilha_page_views_variant_nullable` — quem mexer no
 * esquema precisa manter isso, senão o beacon volta a falhar em produção sem
 * nenhum teste local acusar (fetch simulado não valida constraint de banco).
 */

const { TABELAS, conexao } = require('./supabase');

const BOT_PATTERN = /bot|crawl|slurp|spider|mediapartners|google|baidu|bing|msn|teoma|yahoo|ask/i;

const PARAMETROS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'ttclid', 'msclkid',
];

function ehBot(userAgent) {
  return BOT_PATTERN.test(userAgent || '');
}

/** 1.2.3.4 → 1.2.3.0. IPv6 fica como está: não há octeto final a cortar. */
function truncarIp(ip) {
  if (!ip) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.replace(/\.\d+$/, '.0');
  return ip;
}

function ipDaRequisicao(req) {
  const encaminhado = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return truncarIp(encaminhado || req.socket?.remoteAddress || '');
}

/** Extrai UTMs e click ids de um URLSearchParams, com null no lugar de vazio. */
function parametrosDe(searchParams) {
  const out = {};
  for (const chave of PARAMETROS) out[chave] = searchParams.get(chave) || null;
  return out;
}

/**
 * Grava a visita. Nunca lança: métrica não pode derrubar navegação nem cadastro.
 * Devolve true quando a linha entrou.
 */
async function registrarVisita(dados) {
  const c = conexao();
  if (!c) return false;

  try {
    const res = await fetch(`${c.url}/rest/v1/${TABELAS.pageViews}`, {
      method:  'POST',
      headers: { ...c.headers, Prefer: 'return=minimal' },
      body:    JSON.stringify(dados),
    });

    if (!res.ok) {
      console.error('[pageview error]', res.status, await res.text());
      return false;
    }
    console.log(`[pageview OK] pagina=${dados.pagina} variant=${dados.variant ?? '—'}`);
    return true;
  } catch (e) {
    console.error('[pageview exception]', e.message);
    return false;
  }
}

/**
 * Beacon: POST /api/pageview (servido por api/ab.js — o plano Hobby limita o
 * deploy a 12 funções, então as duas entradas dividem a mesma função).
 *
 * Só as páginas da lista entram. Manter a lista curta impede que a visita seja
 * contada duas vezes — a página do rodízio já é registrada no redirect.
 */
function paginasComBeacon() {
  return (process.env.PAGEVIEW_BEACON_PAGES || '/mentoria,/mentoria-2')
    .split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Micro-evento do funil (rolagem, clique no CTA, campo preenchido, abandono).
 *
 * Vai para tabela própria, e não para a de visitas, porque a contagem de
 * visitas é o denominador da conversão: misturar as duas faria a taxa cair
 * sozinha a cada evento novo que alguém instrumentasse.
 */
async function registrarEvento(dados) {
  const c = conexao();
  if (!c) return false;

  try {
    const res = await fetch(`${c.url}/rest/v1/${TABELAS.eventosPagina}`, {
      method:  'POST',
      headers: { ...c.headers, Prefer: 'return=minimal' },
      body:    JSON.stringify(dados),
    });
    if (!res.ok) {
      console.error('[evento error]', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[evento exception]', e.message);
    return false;
  }
}

// Lista fechada: o endpoint é público, e sem ela qualquer um enche a tabela com
// nomes inventados e o funil vira ilegível.
const EVENTOS_ACEITOS = new Set([
  // `pageview` é o único que não é micro-evento: ele existe para o relatório
  // contar VISITANTE distinto em vez de carregamento. A linha da tabela de
  // visitas não serve para isso — ela não guarda quem visitou (e não deve:
  // ali ficam as UTMs, e o IP já entra truncado). Sem este evento, recarregar
  // a página dividia a taxa de conversão por dois.
  'pageview',
  'scroll', 'cta_click', 'form_open', 'form_start', 'campo_ok', 'porte', 'cargo',
  'faq_open', 'form_abandon', 'submit_error', 'form_submit', 'whatsapp',
  // Formulário de dois passos: `cta_chip` é o atalho de porte no topo da
  // página (a primeira interação sendo a pergunta, e não um botão), e
  // `passo_2` é quem chegou aos campos de contato. Juntos respondem se o
  // gargalo é abrir o formulário ou preenchê-lo.
  'cta_chip', 'passo_2',
  // Quem respondeu menos de 10 colaboradores e aceitou ir para o Clube da
  // Performance. Mede a recuperação do lead fora de perfil, que antes era
  // descartado depois de preencher o formulário inteiro.
  'clube',
]);

async function tratarEvento(req, res, { pagina, userAgent }) {
  const body   = req.body || {};
  const evento = String(body.evento || '').trim();

  if (!EVENTOS_ACEITOS.has(evento)) {
    return res.status(400).json({ ok: false, motivo: 'evento desconhecido' });
  }

  const ok = await registrarEvento({
    visitante:  String(body.visitante || '').slice(0, 64) || null,
    pagina,
    evento,
    valor:      body.valor != null ? String(body.valor).slice(0, 120) : null,
    user_agent: userAgent,
    ip:         ipDaRequisicao(req),
  });

  return res.status(ok ? 201 : 200).json({ ok });
}

async function tratarBeacon(req, res) {
  const body   = req.body || {};
  const pagina = String(body.pagina || '').trim();

  if (!paginasComBeacon().includes(pagina)) {
    return res.status(400).json({ ok: false, motivo: 'pagina fora da lista do beacon' });
  }

  const userAgent = req.headers['user-agent'] || '';
  // 204 e não erro: o bot não precisa saber que foi filtrado, e o navegador
  // real nunca cai aqui.
  if (ehBot(userAgent)) return res.status(204).end();

  // Mesmo endpoint, dois destinos: o plano Hobby do Vercel limita o deploy a 12
  // funções, então micro-evento e visita dividem esta entrada em vez de ganhar
  // uma função só para si.
  if (body.evento) return tratarEvento(req, res, { pagina, userAgent });

  const params = new URLSearchParams(String(body.query || ''));

  const ok = await registrarVisita({
    variant: null,
    pagina,
    ...parametrosDe(params),
    user_agent: userAgent,
    ip:         ipDaRequisicao(req),
  });

  return res.status(ok ? 201 : 200).json({ ok });
}

module.exports = {
  registrarVisita, ehBot, truncarIp, ipDaRequisicao, parametrosDe, PARAMETROS,
  tratarBeacon, paginasComBeacon,
  registrarEvento, tratarEvento, EVENTOS_ACEITOS,
};
