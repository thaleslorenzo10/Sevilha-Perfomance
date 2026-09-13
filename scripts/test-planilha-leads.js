'use strict';
const assert = require('node:assert/strict');
const P = require('../lib/planilha-leads');

// Registro do export do Meta (23 colunas): id, created_time, ad_id, ad_name, adset_id, adset_name,
// campaign_id, campaign_name, form_id, form_name, is_organic, platform, perguntas…
const rec = ['l:123', '2026-09-10T10:00:00-03:00', '1', 'AD 07', '2', 'HOT', '3', '[SE] [FORMS] [LEAD] [HOT]',
  '4', '[SE] [FORMS] 6', 'false', 'ig', 'Maria', 'maria@x.com', '+55 11 99999-0000', 'De 10 a 19', 'dono/sócio',
  '', '', '', '', '', ''];
const forms = P.extractForms([rec, ['l:124', '2026-09-11', '1', 'AD 08', '2', 'COLD', '3', '[SE] [FORMS] [LEAD] [COLD]',
  '4', 'F', 'false', 'fb', '<test lead: dummy>', 'test@meta.com', '', 'De 0 a 4', '', '', '', '', '', '', '']]);
assert.equal(forms.length, 1, 'lead de teste do Meta não entra');
assert.equal(forms[0].id, 'l:123');
assert.equal(forms[0].data, '2026-09-10');
assert.equal(forms[0].adset, 'HOT');
assert.equal(forms[0].anuncio, 'AD 07');
assert.equal(forms[0].plataforma, 'ig');
assert.equal(forms[0].email, 'maria@x.com');
assert.equal(forms[0].telefone, '+55 11 99999-0000');
assert.equal(forms[0].colaboradores, 'De 10 a 19');

const rows = [
  ['Qual seu nome?', 'Qual seu e-mail?', 'Qual seu Whatsapp?', 'Quantos colaboradores você tem?', 'Cargo que ocupa', 'UTM Campaign', 'UTM Source', 'UTM Content', 'Data'],
  ['Ana', 'ana@x.com', '', '10 à 19', 'Dono/Sócio', '[SE] [LEAD] [HOT]', 'Instagram_Feed', 'AD 03', '09/09/2026'],
  ['Zé', '', '', 'De 0 a 4', '', '', '', '', '09/09/2026'],
];
const lp = P.findLPHeaders(rows).flatMap(h => P.extractLP(rows, h));
assert.equal(lp.length, 1, 'linha sem e-mail e sem telefone não é lead');
assert.equal(lp[0].id, 'ana@x.com');
assert.equal(lp[0].data, '2026-09-09');
assert.equal(lp[0].anuncio, 'AD 03');
assert.equal(lp[0].plataforma, 'Instagram_Feed');

assert.equal(P.ehLeadDeTeste(['x', '<TEST LEAD: dummy>']), true);
assert.equal(P.ehLeadDeTeste(['x', 'ok@x.com']), false);
assert.equal(P.labelCargo('dono / sócio'), 'Dono / Sócio');
assert.equal(P.labelColaboradores('10 à 19'), '10 a 19');
console.log('✓ planilha-leads');
