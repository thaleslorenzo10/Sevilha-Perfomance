'use strict';

/**
 * Sevilha Performance — imagem do resumo
 * GET /api/resumo.png?p=mes|7d|30d   (rewrite para /api/resumo-png)
 *
 * É uma imagem PRÓPRIA, não um screenshot do dashboard. A página tem vários
 * metros de altura e no WhatsApp viraria um borrão ilegível; aqui entra só o
 * que se lê no celular. Mesmo critério do resumo da Ambiental Pro.
 *
 * O layout usa flex puro: o renderizador (Satori) não implementa grid.
 */

const { montarResumo, brl, brl0, int, pct, nomeCurto } = require('../lib/resumo');

const NAVY    = '#0D1F6E';
const AZUL    = '#3D5AF1';
const LARANJA = '#f97316';
const ROXO    = '#7c3aed';
const TEAL    = '#0d9488';
const VERDE   = '#16a34a';
const CINZA   = '#6B6B7B';
const TINTA   = '#2D2926';
const FUNDO   = '#EFECF6';
const BORDA   = '#D6D3E4';
const LINHA   = '#EEF0F7';

function h(style, children) {
  const filhos = (Array.isArray(children) ? children : [children]).filter(c => c !== null && c !== false);
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: filhos } };
}
function t(style, valor) {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: String(valor) } };
}

function Card({ rotulo, valor, sub, cor }) {
  return h({
    flexDirection: 'column', flex: 1, background: '#fff', borderRadius: 14,
    padding: '16px 18px', marginRight: 12, borderLeft: `6px solid ${cor}`,
  }, [
    t({ fontSize: 15, color: CINZA, fontWeight: 600, letterSpacing: 0.4 }, rotulo.toUpperCase()),
    t({ fontSize: 36, fontWeight: 700, color: TINTA, marginTop: 6 }, valor),
    sub ? t({ fontSize: 15, color: '#9ca3af', marginTop: 5 }, sub) : null,
  ]);
}

function Secao(titulo, filhos, extra) {
  return h({
    flexDirection: 'column', background: '#fff', borderRadius: 14,
    padding: '14px 18px', marginBottom: 12, ...(extra || {}),
  }, [
    t({ fontSize: 15, fontWeight: 700, color: NAVY, letterSpacing: 0.6, marginBottom: 10 },
      titulo.toUpperCase()),
    ...filhos,
  ]);
}

/** Célula da matriz: quantidade em cima, custo por lead embaixo. */
function celula(c, cor) {
  return h({ flexDirection: 'column', flex: 1, alignItems: 'flex-end' }, [
    t({ fontSize: 24, fontWeight: 700, color: c.leads > 0 ? cor : '#c7c9d4' },
      c.leads > 0 ? int(c.leads) : '—'),
    t({ fontSize: 15, color: CINZA, marginTop: 2 }, c.cpl ? `${brl(c.cpl)}/lead` : ''),
  ]);
}

module.exports = async function handler(req, res) {
  const p = new URL(req.url, 'http://localhost').searchParams.get('p') || 'mes';

  try {
    const r = await montarResumo(p);
    const { ImageResponse } = await import('@vercel/og');
    const temLeads = !!r.leads;

    // ── Matriz porte × formato ────────────────────────────────────────
    const cabecalhoMatriz = h({ alignItems: 'flex-end', paddingBottom: 8, borderBottom: `2px solid ${BORDA}` }, [
      t({ flex: 1.5, fontSize: 15, color: CINZA, fontWeight: 600 }, 'PORTE'),
      t({ flex: 1, fontSize: 15, color: AZUL, fontWeight: 700, justifyContent: 'flex-end' }, 'FORMULÁRIO'),
      t({ flex: 1, fontSize: 15, color: LARANJA, fontWeight: 700, justifyContent: 'flex-end' }, 'LANDING PAGE'),
      t({ flex: 1, fontSize: 15, color: TINTA, fontWeight: 700, justifyContent: 'flex-end' }, 'TOTAL'),
    ]);

    const linhaMatriz = (rotulo, cor, m, ultima) => h({
      alignItems: 'center', padding: '12px 0',
      borderBottom: ultima ? 'none' : `1px solid ${LINHA}`,
    }, [
      h({ flex: 1.5, alignItems: 'center' }, [
        h({ width: 12, height: 12, borderRadius: 3, background: cor, marginRight: 10 }, []),
        t({ fontSize: 20, fontWeight: 600, color: TINTA }, rotulo),
      ]),
      celula(m.forms, AZUL),
      celula(m.lp, LARANJA),
      celula(m.total, TINTA),
    ]);

    // ── Melhores anúncios ─────────────────────────────────────────────
    const anuncios = (r.anuncios || []).slice(0, 4);
    
    const linhasAnuncio = anuncios.map((a, i) => h({
      flexDirection: 'column', padding: '10px 0',
      borderTop: i === 0 ? 'none' : `1px solid ${LINHA}`,
    }, [
      h({ alignItems: 'center' }, [
        t({
          fontSize: 13, fontWeight: 700, color: '#fff', borderRadius: 5,
          padding: '3px 0', width: 56, justifyContent: 'center', marginRight: 12,
          background: a.formato === 'FORMS' ? AZUL : LARANJA,
        }, a.formato === 'FORMS' ? 'FORM' : 'LP'),
        t({ flex: 1, fontSize: 19, fontWeight: 600, color: TINTA }, nomeCurto(a.nome).slice(0, 40)),
        t({ fontSize: 19, fontWeight: 700, color: VERDE, width: 230, justifyContent: 'flex-end' },
          `${int(a.leads)} leads · ${brl(a.cpl)}`),
      ]),
      a.link ? t({ fontSize: 14, color: AZUL, marginTop: 4, marginLeft: 68 }, a.link) : null,
    ]));

    const imagem = h({
      flexDirection: 'column', width: '100%', height: '100%',
      background: FUNDO, padding: 30, fontFamily: 'sans-serif',
    }, [
      // Cabeçalho
      h({ alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }, [
        h({ flexDirection: 'column' }, [
          t({ fontSize: 32, fontWeight: 700, color: NAVY }, 'Sevilha Performance'),
          t({ fontSize: 18, color: CINZA, marginTop: 3 }, `Sessão Estratégica · ${r.periodo.legenda}`),
        ]),
        t({ fontSize: 18, color: CINZA }, r.periodo.rotulo),
      ]),

      // KPIs
      h({ marginBottom: 12 }, [
        Card({ rotulo: 'Investido', valor: brl0(r.investido.total), cor: AZUL,
               sub: `captação ${brl0(r.investido.captacao)}` }),
        Card({ rotulo: 'Leads reais', valor: temLeads ? int(r.leads.total) : '—', cor: VERDE,
               sub: temLeads ? `form. ${int(r.leads.forms)} · LP ${int(r.leads.lp)}` : 'planilha sem dados' }),
        Card({ rotulo: 'CPL real', valor: temLeads ? brl(r.leads.cpl) : '—', cor: VERDE,
               sub: 'captação ÷ leads reais' }),
        Card({ rotulo: 'CTR', valor: pct(r.entrega.ctr), cor: CINZA,
               sub: `CPM ${brl(r.entrega.cpm)} · ${int(r.entrega.cliques)} cliques` }),
      ]),

      // Matriz porte × formato
      temLeads ? Secao('Porte do escritório × formato de campanha', [
        cabecalhoMatriz,
        linhaMatriz('10 ou mais colaboradores', ROXO, r.leads.matriz.maior, false),
        linhaMatriz('Menos de 10 colaboradores', TEAL, r.leads.matriz.menor, true),
        t({ fontSize: 14, color: '#9ca3af', marginTop: 8 },
          'Custo por lead = investimento do formato ÷ leads daquele porte; as faixas dividem o mesmo investimento'
          + (r.leads.sem_resposta > 0 ? ` · ${int(r.leads.sem_resposta)} sem resposta fora` : '')),
      ]) : null,

      // Melhores anúncios
      linhasAnuncio.length ? Secao('Melhores anúncios do período (por leads)', linhasAnuncio, { flex: 1 }) : null,
    ]);

    // Altura somada por linha: anúncio com link ocupa mais que um sem link,
    // e assumir o mesmo para todos cortava a última linha.
    const alturaAnuncios = anuncios.reduce((s, a) => s + (a.link ? 70 : 50), 0);
    const altura = 345
      + (temLeads ? 215 : 0)
      + (anuncios.length ? 80 + alturaAnuncios : 0);

    const png = new ImageResponse(imagem, { width: 1200, height: Math.min(altura, 1400) });
    const buffer = Buffer.from(await png.arrayBuffer());

    res.setHeader('Content-Type', 'image/png');
    // Sem cache: o n8n já quebra o cache com ?t=, mas se alguém abrir a URL
    // direto deve ver o número de agora, não o da última execução.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).end(buffer);

  } catch (err) {
    console.error('[api/resumo-png]', err.message);
    return res.status(502).json({ error: err.message });
  }
};
