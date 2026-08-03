'use strict';

/**
 * Sevilha Performance — imagem do resumo
 * GET /api/resumo.png?p=7d|30d|mes   (rewrite para /api/resumo-png)
 *
 * É uma imagem PRÓPRIA, não um screenshot do dashboard. A página tem vários
 * metros de altura e no WhatsApp viraria um borrão ilegível; aqui entra só o
 * que se lê no celular de manhã. Mesmo critério do resumo da Ambiental Pro.
 *
 * O layout usa flex puro: o renderizador (Satori) não implementa grid.
 */

const { montarResumo, brl, brl0, int, pct, nomeCurto } = require('../lib/resumo');

const NAVY   = '#0D1F6E';
const AZUL   = '#3D5AF1';
const LARANJA= '#f97316';
const ROXO   = '#7c3aed';
const TEAL   = '#0d9488';
const CINZA  = '#6B6B7B';
const FUNDO  = '#EFECF6';
const BORDA  = '#D6D3E4';

/** Cria elemento no formato que o Satori espera, sem precisar de JSX/build. */
function h(style, children) {
  const filhos = (Array.isArray(children) ? children : [children]).filter(c => c !== null && c !== false);
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: filhos } };
}
function texto(style, valor) {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: String(valor) } };
}

function Card({ rotulo, valor, sub, cor, largura }) {
  return h({
    flexDirection: 'column', flex: largura || 1, background: '#fff', borderRadius: 16,
    padding: '18px 20px', marginRight: 14, borderLeft: `6px solid ${cor}`,
  }, [
    texto({ fontSize: 17, color: CINZA, fontWeight: 600, letterSpacing: 0.5 }, rotulo.toUpperCase()),
    texto({ fontSize: 40, fontWeight: 700, color: '#2D2926', marginTop: 8 }, valor),
    sub ? texto({ fontSize: 16, color: '#9ca3af', marginTop: 6 }, sub) : null,
  ]);
}

module.exports = async function handler(req, res) {
  const p = new URL(req.url, 'http://localhost').searchParams.get('p') || '7d';

  try {
    const r = await montarResumo(p);
    const { ImageResponse } = await import('@vercel/og');

    const temLeads = !!r.leads;

    const linhasCampanha = r.campanhas.slice(0, 5).map((c, i) => h({
      alignItems: 'center', padding: '10px 0',
      borderTop: i === 0 ? 'none' : `1px solid ${BORDA}`,
    }, [
      h({ width: 78 }, texto({
        fontSize: 15, fontWeight: 700, color: '#fff', borderRadius: 6, padding: '3px 0',
        width: 62, justifyContent: 'center',
        background: c.formato === 'FORMS' ? AZUL : LARANJA,
      }, c.formato === 'FORMS' ? 'FORM' : 'LP')),
      texto({ flex: 1, fontSize: 20, color: '#2D2926' },
        nomeCurto(c.nome).slice(0, 42)),
      texto({ fontSize: 20, fontWeight: 700, color: '#2D2926', width: 150, justifyContent: 'flex-end' },
        brl0(c.spend)),
    ]));

    const imagem = h({
      flexDirection: 'column', width: '100%', height: '100%',
      background: FUNDO, padding: 36, fontFamily: 'sans-serif',
    }, [
      // Cabeçalho
      h({ alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22 }, [
        h({ flexDirection: 'column' }, [
          texto({ fontSize: 34, fontWeight: 700, color: NAVY }, 'Sevilha Performance'),
          texto({ fontSize: 19, color: CINZA, marginTop: 4 }, `Sessão Estratégica · ${r.periodo.legenda}`),
        ]),
        texto({ fontSize: 19, color: CINZA }, r.periodo.rotulo),
      ]),

      // Linha 1 — dinheiro e leads
      h({ marginBottom: 14 }, [
        Card({ rotulo: 'Investido', valor: brl0(r.investido.total), cor: AZUL,
               sub: `captação ${brl0(r.investido.captacao)}` }),
        Card({ rotulo: 'Leads reais', valor: temLeads ? int(r.leads.total) : '—', cor: '#16a34a',
               sub: temLeads ? `form. ${int(r.leads.forms)} · LP ${int(r.leads.lp)}` : 'planilha sem dados' }),
        Card({ rotulo: 'CPL real', valor: temLeads ? brl(r.leads.cpl) : '—', cor: '#16a34a',
               sub: 'captação ÷ leads reais' }),
        Card({ rotulo: 'CTR', valor: pct(r.entrega.ctr), cor: CINZA,
               sub: `CPM ${brl(r.entrega.cpm)}` }),
      ]),

      // Linha 2 — porte
      temLeads ? h({ marginBottom: 14 }, [
        Card({ rotulo: '10+ colaboradores', valor: int(r.leads.porte.maior), cor: ROXO,
               sub: r.leads.porte.cpl_maior ? `${brl(r.leads.porte.cpl_maior)} por lead` : '—' }),
        Card({ rotulo: 'Menos de 10', valor: int(r.leads.porte.menor), cor: TEAL,
               sub: r.leads.porte.cpl_menor ? `${brl(r.leads.porte.cpl_menor)} por lead` : '—' }),
        Card({ rotulo: 'Formulário', valor: brl0(r.formatos.FORMS.spend), cor: AZUL,
               sub: r.formatos.FORMS.leads !== null ? `${int(r.formatos.FORMS.leads)} leads` : '' }),
        Card({ rotulo: 'Landing Page', valor: brl0(r.formatos.LP.spend), cor: LARANJA,
               sub: r.formatos.LP.leads !== null ? `${int(r.formatos.LP.leads)} leads` : '' }),
      ]) : null,

      // Campanhas
      linhasCampanha.length ? h({
        flexDirection: 'column', background: '#fff', borderRadius: 16, padding: '14px 20px', flex: 1,
      }, [
        texto({ fontSize: 17, fontWeight: 700, color: NAVY, letterSpacing: 0.5, marginBottom: 14 },
          'CAMPANHAS NO PERÍODO'),
        ...linhasCampanha,
      ]) : null,
    ]);

    const png = new ImageResponse(imagem, { width: 1200, height: temLeads ? 812 : 640 });
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
