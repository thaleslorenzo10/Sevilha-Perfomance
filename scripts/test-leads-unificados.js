'use strict';
const assert = require('node:assert/strict');
const U = require('../lib/leads-unificados');
const { classifyCampaign } = require('../lib/meta');

assert.equal(classifyCampaign('[04/09/26] [CAFÉ COM SEVILHA] COLD + HOT').grupo, 'CAFE');
assert.equal(classifyCampaign('[SE] [FORMS] [LEAD]').grupo, 'SE');

const forms = [
  { fonte: 'FORMS', id: 'l:1', data: '2026-09-10', campanha: '[SE] [FORMS] [LEAD] [HOT]', adset: 'HOT', anuncio: 'AD 07', plataforma: 'ig', colaboradores: 'De 10 a 19', cargo: 'dono/sócio', email: 'a@x.com', telefone: '' },
  { fonte: 'FORMS', id: 'l:2', data: '2026-09-11', campanha: '[SE] [FORMS] [LEAD] [COLD]', adset: 'COLD', anuncio: 'AD 08', plataforma: 'fb', colaboradores: 'De 0 a 4', cargo: '', email: 'b@x.com', telefone: '' },
  { fonte: 'FORMS', id: 'l:3', data: '2026-08-01', campanha: '[SE] [FORMS] [LEAD] [COLD]', adset: 'COLD', anuncio: 'AD 08', plataforma: 'fb', colaboradores: 'De 20 a 29', cargo: '', email: 'antigo@x.com', telefone: '' },
];
const respondi = [
  { fonte: 'LP', id: 'a@x.com', data: '2026-09-12', campanha: '[SE] [LEAD] [HOT]', adset: '', anuncio: 'AD 03', plataforma: 'Instagram_Feed', colaboradores: '10 à 19', cargo: 'Dono/Sócio', email: 'A@x.com ', telefone: '' },
];
const supabase = [
  { id: 10, created_at: '2026-09-13T02:30:00+00:00', pagina: '/mentoria', email: 'c@x.com', telefone: '11999990000', utm_source: 'Instagram_Stories', utm_medium: 'HOT', utm_campaign: '[25/08] [SE] [PÁGINA NOVA] [LEAD-QL] [HOT]', utm_content: 'AD 09', colaboradores: 'de_10_a_19', cargo: 'socio' },
  { id: 11, created_at: '2026-09-13T12:00:00+00:00', pagina: '/mentoria-2', email: '', telefone: '+55 (11) 99999-0000', utm_source: '{{placement}}', utm_medium: '{{adset.name}}', utm_campaign: '{{campaign.name}}', utm_content: '', colaboradores: 'de_0_a_4', cargo: '' },
  { id: 12, created_at: '2026-09-11T15:00:00+00:00', pagina: 'rd:cafe-com-sevilha', email: 'd@x.com', telefone: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', colaboradores: 'De 30 a 49', cargo: '' },
  { id: 13, created_at: '2026-09-11T16:00:00+00:00', pagina: 'rd:cafe-com-sevilha', email: 'antigo@x.com', telefone: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', colaboradores: '', cargo: '' },
];

(async () => {
const r = U.unificar({ forms, respondi, supabase }, '2026-09-10', '2026-09-13');

// a@x.com aparece no FORMS (dia 10) e no Respondi (dia 12, e-mail com caixa e espaço): conta uma vez, na primeira data.
// telefone 11999990000 aparece no lead 10 (e-mail c@x.com) e no 11 (só telefone): lead 11 é repetição.
// antigo@x.com veio em agosto pelo FORMS e reapareceu pelo Café no dia 11: repetição, não conta.
assert.equal(r.total.leads, 4, 'a, b, c, d');
assert.equal(r.total.mql, 3, 'a (10-19), c (10-19), d (30-49)');
assert.equal(r.periodo.fuso, '-03:00');

const dia12 = r.por_dia.find(d => d.dia === '2026-09-12');
assert.equal(r.por_dia.length, 4, 'um item por dia do período, mesmo sem lead');
assert.equal(dia12.leads, 1, 'c@x.com; o Respondi do dia 12 era repetição de a@x.com');
const dia13 = r.por_dia.find(d => d.dia === '2026-09-13');
assert.equal(dia13.leads, 0, 'o lead 10 (02:30 UTC do dia 13) é dia 12 em Brasília; o lead 11 repete o telefone dele');
const dia10 = r.por_dia.find(d => d.dia === '2026-09-10');
assert.equal(dia10.fontes.FORMS, 1);

assert.equal(r.por_grupo.SE.leads, 3); assert.equal(r.por_grupo.CAFE.leads, 1); assert.equal(r.por_grupo.CAFE.mql, 1);
assert.equal(r.por_formato.FORMS.leads, 2); assert.equal(r.por_formato.LP.leads, 2);

const cafe = r.por_campanha.find(c => c.campanha === U.SEM_ETIQUETA);
assert.equal(cafe.grupo, 'CAFE', 'Café sem UTM cai no grupo pela fonte');
assert.ok(!r.por_campanha.find(c => c.campanha === U.ETIQUETA_QUEBRADA), 'o lead 11 era repetição; nada quebrado sobrou');

const conj = r.por_conjunto.find(c => c.conjunto === 'HOT');
assert.equal(conj.leads, 2, 'HOT junta FORMS (adset_name) e Supabase (utm_medium)');
assert.equal(r.por_anuncio.find(a => a.anuncio === 'AD 09').mql, 1);
assert.equal(r.por_fonte.find(f => f.fonte === 'instagram:stories').leads, 1);
assert.equal(r.por_fonte.find(f => f.fonte === 'instagram:geral').leads, 1, 'coluna platform "ig" do export');
assert.equal(r.por_pagina.find(p => p.pagina === '/mentoria').leads, 1);
assert.deepEqual(r.porte, { MAIOR_10: 3, MENOR_10: 1, INDEFINIDO: 0 });
assert.equal(r.qualificacao.cargo['Dono / Sócio'], 2);
assert.equal(r.qualificacao.colaboradores['De 10 a 19'], 2, 'faixa do export e slug do site viram o mesmo rótulo');
assert.equal(r.qualificacao.colaboradores['de_10_a_19'], undefined);

const fForms = r.fontes.find(f => f.nome === 'FORMS');
assert.equal(fForms.total_no_periodo, 2);
assert.equal(fForms.ultimo_lead, '2026-09-11');
assert.equal(fForms.dias_sem_lead, 2);
assert.equal(r.fontes.find(f => f.nome === 'RESPONDI').total_no_periodo, 0);

// Etiqueta quebrada quando o único registro é o quebrado.
const q = U.unificar({ forms: [], respondi: [], supabase: [supabase[1]] }, '2026-09-13', '2026-09-13');
assert.equal(q.por_campanha[0].campanha, U.ETIQUETA_QUEBRADA);
assert.equal(q.por_campanha[0].grupo, 'SE', 'sem campanha legível, a página /mentoria-2 diz o grupo');
assert.equal(q.por_fonte[0].fonte, U.ETIQUETA_QUEBRADA);
console.log('✓ leads-unificados');
})();
