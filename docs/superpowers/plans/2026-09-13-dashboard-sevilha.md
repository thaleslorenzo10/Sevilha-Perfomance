# Dashboard Sevilha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um `/dashboard` cujos números batem entre si: leads reais unificados (Lead vs MQL), CPL/CPMQL por campanha, público, anúncio e posicionamento cruzando UTM com gasto do Meta, faixa executiva com comparação ao período anterior, e um script que confere as fontes.

**Architecture:** Backend em funções serverless Node (Vercel, CommonJS, sem framework): um endpoint novo de leads unificados servido como modo de `api/sheet-leads.js`, `api/meta.js` ganhando níveis adset/anúncio/posicionamento, `api/rd-stats.js` agrupando deals por campanha, webhook do RD Marketing servido como modo de `api/respondi.js`. Front em HTML estático + módulos de script simples em `assets/js/dash/` (namespace `window.SPD`), Chart.js 4 via CDN, tokens do `lm-ds.css`.

**Tech Stack:** Node 24 (CommonJS, `fetch` nativo), Vercel Hobby, Supabase PostgREST, Meta Graph API v19.0, RD Station CRM API v1, Google Sheets (lib/sheets.js), Chart.js 4.4.0, ESLint 9 + quality gates.

**Spec:** `docs/superpowers/specs/2026-09-13-dashboard-sevilha-design.md`

## Global Constraints

- **Vercel Hobby: no máximo 12 funções em `api/`.** Já existem 12. Nenhum arquivo novo em `api/`: endpoint novo é MODO de função existente, roteado por `?modo=`/`?fonte=` e, quando útil, rewrite em `vercel.json` (padrão de `/api/sessao-estrategica` → `/api/stats?modo=sessao-estrategica`).
- Teto de **350 linhas por arquivo** (`quality/max-lines`); lint com zero erro; linha de base de avisos não sobe (`npm run lint`).
- Fuso único `-03:00` via `lib/fuso.js`. Nenhum `FUSO = '-03:00'` local sobrevive.
- MQL = `ehQualificado(colaboradores)` de `lib/porte.js`. Rótulo na tela: **"MQL (10+)"**.
- Divisão por zero exibe `—`, nunca `0%`.
- Nomes em português, comentários em prosa normal (não caveman). Sem novas dependências npm.
- CSS e JS em `/assets` têm cache `immutable`: todo `<script src>`/`<link>` novo leva `?v=dash-1`; ao editar depois, subir o sufixo.
- Testes são scripts `node scripts/test-*.js` com `assert`, sem rede (stub de `global.fetch`). Cada task termina com o teste verde e um commit.
- Commits pelo orquestrador, um por task, terminando com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Emendas à spec (descobertas ao ler o código)

1. Limite de 12 funções → `/api/leads-unificados` é rewrite para `/api/sheet-leads?modo=unificados`; o webhook do RD é `POST /api/respondi?fonte=rd-marketing&token=…` (sem rewrite, para o `token` não depender da mesclagem de query).
2. Idempotência do webhook por consulta-e-insere em `event_id = rd:<uuid>`, sem migração SQL (índice único em `event_id` afetaria o caminho vivo de `api/leads.js`).
3. `csv.js` some: exportação vive em `tabelas.js`.
4. `/api/sessao-estrategica` (micro-funil da página /mentoria: travou_em, cta, faq) sai do dashboard; continua respondendo para quem quiser.
5. `stats.js` passa a contar visitantes distintos por página (tabela `sevilha_eventos_pagina`, coluna `criado_em`) para a conversão ter um denominador só.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/fuso.js` (novo) | dia em -03:00, início/fim do dia, lista de dias, período anterior |
| `lib/posicionamento.js` (novo) | chave comum de posicionamento (macro `{{placement}}` × breakdown do Meta) |
| `lib/planilha-leads.js` (novo) | extração de FORMS e Respondi das planilhas (movido de `api/sheet-leads.js`), regra única de lead de teste, rótulos de cargo/colaboradores |
| `lib/leads-unificados.js` (novo) | `normalizar` + `unificar` (puro): dedupe, etiqueta, grupo, MQL, agregados |
| `lib/leads-fontes.js` (novo) | lê as fontes (planilhas + Supabase paginado), monta payload, `responderUnificados` |
| `lib/supabase.js` | + `lerTudo(url)` paginado por `Range` |
| `lib/meta.js` | grupo `CAFE`; `fetchAdsetInsights`, `fetchPlacementInsights` |
| `api/meta.js` | fuso; `CAFE` nos grupos e na série; `conjuntos[]`, `anuncios[]`, `posicionamentos[]` |
| `api/sheet-leads.js` | importa extração de `lib/planilha-leads.js`; modo `unificados` |
| `api/eventos-qualificados.js` | importa `ehLeadDeTeste` de `lib/planilha-leads.js` |
| `api/stats.js` | fuso, `lerTudo`, visitantes distintos por página |
| `api/rd-stats.js` | `por_campanha` por campo custom `utm_campaign` |
| `lib/rd-webhook.js` (novo) + `api/respondi.js` | webhook de conversão do RD Marketing → `sevilha_leads` |
| `scripts/conferir-dados.js` (novo) | conferência entre fontes + invariantes |
| `assets/js/dash/{formato,cruzamento,api,graficos,tabelas,executivo,geral,formatos,grupo,origem,ab,main}.js` (novos) | front modular |
| `dashboard.html` | markup novo, sem `<style>` e sem JS inline |
| `assets/css/admin-dashboard.css` | recebe o CSS inline + classes novas |
| `vercel.json` | rewrite de leads-unificados; redirect de `/relatorio` |
| `relatorio.html`, `assets/css/admin-report.css` | removidos |
| `.env.example` | `RD_MARKETING_WEBHOOK_SECRET` |

## Ondas de execução (para dispatch paralelo)

- **Onda 1 (independentes):** T1 fuso · T2 posicionamento · T3 planilha-leads · T7 rd-stats · T8 rd-webhook · T11 front puro (formato + cruzamento)
- **Onda 2:** T4 leads-unificados (puro, inclui CAFE em lib/meta.js) · T10 conferir-dados · T12 CSS + api/graficos/tabelas
- **Onda 3:** T5 leads-fontes + modo + rewrite + lerTudo · T6 meta (depois de T4: mesmo arquivo lib/meta.js) · T13 HTML + main + executivo + geral
- **Onda 4:** T9 stats (usa lerTudo de T5) · T14 formatos + grupo · T15 origem + ab + relatorio
- **Onda 5:** T16 validação e deploy

---

### Task 1: `lib/fuso.js`

**Files:**
- Create: `lib/fuso.js`
- Test: `scripts/test-fuso.js`

**Interfaces:**
- Produces: `FUSO` ('-03:00'), `diaDe(valor: Date|string) → 'YYYY-MM-DD'|null`, `inicioDoDia(dia) → 'YYYY-MM-DDT00:00:00-03:00'`, `fimDoDia(dia)`, `cadaDia(since, until) → string[]`, `deslocarDias(dia, n)`, `periodoAnterior(since, until) → {since, until}`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test-fuso.js
'use strict';
const assert = require('node:assert/strict');
const f = require('../lib/fuso');

assert.equal(f.FUSO, '-03:00');
assert.equal(f.diaDe('2026-09-13'), '2026-09-13', 'data pura passa intacta');
assert.equal(f.diaDe('2026-09-13T02:30:00Z'), '2026-09-12', '02:30 UTC ainda é dia 12 em Brasília');
assert.equal(f.diaDe('2026-09-13T03:00:00Z'), '2026-09-13', '03:00 UTC vira meia-noite do dia 13');
assert.equal(f.diaDe('2026-04-06T23:30:00-05:00'), '2026-04-07', 'export do Meta em -05:00 vira dia seguinte');
assert.equal(f.diaDe(new Date('2026-01-01T01:00:00Z')), '2025-12-31');
assert.equal(f.diaDe(''), null); assert.equal(f.diaDe('abc'), null);
assert.equal(f.inicioDoDia('2026-09-01'), '2026-09-01T00:00:00-03:00');
assert.equal(f.fimDoDia('2026-09-01'), '2026-09-01T23:59:59-03:00');
assert.deepEqual(f.cadaDia('2026-08-30', '2026-09-01'), ['2026-08-30', '2026-08-31', '2026-09-01']);
assert.equal(f.deslocarDias('2026-09-01', -1), '2026-08-31');
assert.deepEqual(f.periodoAnterior('2026-09-07', '2026-09-13'), { since: '2026-08-31', until: '2026-09-06' });
console.log('✓ fuso');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-fuso.js`
Expected: `Cannot find module '../lib/fuso'`

- [ ] **Step 3: Write minimal implementation**

```js
// lib/fuso.js
'use strict';

/**
 * Fuso único do painel: -03:00 (Brasília, sem horário de verão desde 2019).
 * O banco grava em UTC, o Meta responde no fuso da conta e a planilha grava a
 * data como texto. Toda pergunta "isso foi em que dia?" passa por aqui — antes
 * havia uma cópia de FUSO em api/stats.js e outra em lib/sessao-estrategica.js,
 * e o eixo do Meta era montado em UTC.
 */

const FUSO = '-03:00';
const OFFSET_MS = -3 * 60 * 60 * 1000;
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' em -03:00 para uma Date ou string ISO. Data pura passa intacta. */
function diaDe(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const s = String(valor).trim();
  if (RE_DIA.test(s)) return s;
  const d = valor instanceof Date ? valor : new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

function inicioDoDia(dia) { return `${dia}T00:00:00${FUSO}`; }
function fimDoDia(dia)    { return `${dia}T23:59:59${FUSO}`; }

/** Todos os dias de since a until, inclusive. Teto de 400 para intervalo absurdo. */
function cadaDia(since, until) {
  const dias = [];
  const cur = new Date(`${since}T00:00:00Z`);
  const fim = new Date(`${until}T00:00:00Z`);
  for (let i = 0; cur <= fim && i < 400; i++) {
    dias.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dias;
}

function deslocarDias(dia, n) {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Período imediatamente anterior, com o mesmo número de dias. */
function periodoAnterior(since, until) {
  const n = cadaDia(since, until).length;
  return { since: deslocarDias(since, -n), until: deslocarDias(since, -1) };
}

module.exports = { FUSO, diaDe, inicioDoDia, fimDoDia, cadaDia, deslocarDias, periodoAnterior };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-fuso.js` — Expected: `✓ fuso`

- [ ] **Step 5: Commit**

```bash
git add lib/fuso.js scripts/test-fuso.js
git commit -m "feat(lib): fuso único -03:00 para dia, período e período anterior"
```

---

### Task 2: `lib/posicionamento.js`

**Files:**
- Create: `lib/posicionamento.js`
- Test: `scripts/test-posicionamento.js`

**Interfaces:**
- Produces: `chavePosicionamento(plataforma, posicao) → 'instagram:stories'`, `chaveDoMacro(valor) → chave|null` (aceita `Instagram_Stories`, `Facebook_Mobile_Feed`, `ig`, `fb`).

- [ ] **Step 1: Write the failing test**

```js
// scripts/test-posicionamento.js
'use strict';
const assert = require('node:assert/strict');
const { chavePosicionamento, chaveDoMacro } = require('../lib/posicionamento');

// Lado do lead: macro {{placement}} e coluna platform do export do Meta.
assert.equal(chaveDoMacro('Instagram_Stories'), 'instagram:stories');
assert.equal(chaveDoMacro('Instagram_Feed'), 'instagram:feed');
assert.equal(chaveDoMacro('Facebook_Mobile_Feed'), 'facebook:feed');
assert.equal(chaveDoMacro('Facebook_Desktop_Feed'), 'facebook:feed');
assert.equal(chaveDoMacro('ig'), 'instagram:geral');
assert.equal(chaveDoMacro('fb'), 'facebook:geral');
assert.equal(chaveDoMacro(''), null);
// Lado do gasto: breakdown publisher_platform + platform_position.
assert.equal(chavePosicionamento('instagram', 'instagram_stories'), 'instagram:stories');
assert.equal(chavePosicionamento('instagram', 'feed'), 'instagram:feed');
assert.equal(chavePosicionamento('facebook', 'facebook_stories'), 'facebook:stories');
assert.equal(chavePosicionamento('facebook', 'feed'), 'facebook:feed');
assert.equal(chavePosicionamento('audience_network', 'an_classic'), 'audience_network:classic');
assert.equal(chavePosicionamento('', ''), 'desconhecido:geral');
console.log('✓ posicionamento');
```

- [ ] **Step 2: Run test to verify it fails** — `node scripts/test-posicionamento.js` → `Cannot find module`

- [ ] **Step 3: Write minimal implementation**

```js
// lib/posicionamento.js
'use strict';

/**
 * Chave comum de posicionamento entre o lado do lead — utm_source={{placement}}
 * ("Instagram_Stories") ou a coluna platform do export ("ig"/"fb") — e o lado
 * do gasto — breakdown publisher_platform + platform_position do Meta
 * ("instagram" + "instagram_stories"). Sem isto a tabela "Fonte" da aba Origem
 * teria gasto numa linha e lead em outra com o mesmo significado.
 *
 * ponytail: heurística por prefixo. Posição que o Meta nomeia diferente do
 * macro vira linha própria em vez de sumir; refinar o mapa quando aparecer.
 */

const { norm } = require('./texto');

const PLATAFORMAS = {
  instagram: 'instagram', ig: 'instagram',
  facebook: 'facebook', fb: 'facebook',
  messenger: 'messenger', msg: 'messenger',
  audience: 'audience_network', audience_network: 'audience_network', an: 'audience_network',
};
const RE_PREFIXO = /^(instagram|facebook|messenger|audience_network|an|ig|fb)_/;
const RE_DISPOSITIVO = /^(mobile|desktop)_/;

function chavePosicionamento(plataforma, posicao) {
  const p = norm(plataforma).replace(/[\s-]+/g, '_');
  const plat = PLATAFORMAS[p] || PLATAFORMAS[p.split('_')[0]] || (p || 'desconhecido');
  let pos = norm(posicao).replace(/[\s-]+/g, '_').replace(RE_PREFIXO, '').replace(RE_DISPOSITIVO, '');
  if (!pos) pos = 'geral';
  return `${plat}:${pos}`;
}

/** "Instagram_Stories" → 'instagram:stories'; "ig" → 'instagram:geral'; vazio → null. */
function chaveDoMacro(valor) {
  const s = String(valor || '').trim();
  if (!s) return null;
  const [plat, ...resto] = s.split('_');
  return chavePosicionamento(plat, resto.join('_'));
}

module.exports = { chavePosicionamento, chaveDoMacro };
```

- [ ] **Step 4: Run test** — Expected `✓ posicionamento`
- [ ] **Step 5: Commit** — `git add lib/posicionamento.js scripts/test-posicionamento.js && git commit -m "feat(lib): chave comum de posicionamento entre UTM e breakdown do Meta"`

---

### Task 3: `lib/planilha-leads.js` — extração movida para fora do handler

**Files:**
- Create: `lib/planilha-leads.js`
- Modify: `api/sheet-leads.js` (remove linhas 32-249: `toISODate`, `isTestLead`, `TAB_*`, `findLPHeaders`, `columnIndex`, `META_EXPORT_WIDTH`, `RE_*`, `extractForms`, `extractLP`, `labelCargo`, `labelColaboradores`; passa a importar)
- Modify: `api/eventos-qualificados.js:65-68` (`ehLeadDeTeste` local → import)
- Test: `scripts/test-planilha-leads.js`; regressão: `scripts/test-sheet-leads.js`, `scripts/test-eventos-qualificados.js`

**Interfaces:**
- Produces: `extractForms(rows) → [{fonte:'FORMS', id, data, formulario, campanha, adset, anuncio, plataforma, colaboradores, cargo, email, telefone}]`, `findLPHeaders(rows)`, `extractLP(rows, header) → [{fonte:'LP', id, data, formulario, campanha, adset:'', anuncio, plataforma, colaboradores, cargo, email, telefone}]`, `ehLeadDeTeste(celulas: string[]) → boolean`, `toISODate(raw)`, `labelCargo(v)`, `labelColaboradores(v)`, `TAB_FORMS`, `TAB_LP`.
- Consumed by T4/T5 e por `api/sheet-leads.js`.

- [ ] **Step 1: Registrar o resultado atual dos testes de regressão**

Run: `node scripts/test-sheet-leads.js && node scripts/test-eventos-qualificados.js` — anote a saída (deve terminar verde). Se algum já falha antes da mudança, anote e siga.

- [ ] **Step 2: Write the failing test**

```js
// scripts/test-planilha-leads.js
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
```

- [ ] **Step 3: Run test to verify it fails** — `node scripts/test-planilha-leads.js` → `Cannot find module`

- [ ] **Step 4: Create `lib/planilha-leads.js`**

Mova, byte a byte, de `api/sheet-leads.js` para o novo arquivo: o comentário e a função `toISODate` (linhas 32-62), `TAB_FORMS`/`TAB_LP`, `findLPHeaders`, `columnIndex`, `META_EXPORT_WIDTH`, `RE_CARGO`, `extractForms`, `extractLP`, `labelCargo`, `labelColaboradores`. Comece o arquivo com `'use strict';`, um cabeçalho de duas linhas ("Extração de leads das planilhas — export do Meta (FORMS) e formulário do Respondi (LP). Só leitura; a agregação fica em quem chama.") e `const { norm } = require('./texto');`. Faça estas três mudanças ao mover:

```js
// (a) regra única de lead de teste — substitui isTestLead daqui e ehLeadDeTeste de api/eventos-qualificados.js
function ehLeadDeTeste(celulas) {
  const blob = norm(celulas.map(v => String(v ?? '')).join(' '));
  return blob.includes('<test lead') || blob.includes('test@meta.com');
}

// (b) a forma mais ampla das duas regexes que existiam ("10 a 19" digitado entra)
const RE_COLABORADORES = /^(de\s+\d+\s+a\s+\d+|\d+\s*(a|à)\s*\d+|mais de\s+\d+|acima de\s+\d+.*)$/i;
const RE_EMAIL    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TELEFONE = /^\+?[\d\s().-]{8,}$/;

// (c) dentro de extractForms, logo após `const cargo = ...`:
      const email    = respostas.find(v => RE_EMAIL.test(v)) || '';
      const telefone = respostas.find(v => RE_TELEFONE.test(v)) || '';
// e no objeto empurrado para `out`, acrescente `email, telefone,`.
// Em extractLP, o objeto já tem `email`/`telefone` calculados: acrescente-os ao objeto também.
```

Troque `isTestLead(` por `ehLeadDeTeste(` nas duas chamadas movidas. Termine com:

```js
module.exports = {
  TAB_FORMS, TAB_LP, toISODate, ehLeadDeTeste, findLPHeaders, columnIndex,
  extractForms, extractLP, labelCargo, labelColaboradores,
};
```

- [ ] **Step 5: Apontar `api/sheet-leads.js` e `api/eventos-qualificados.js` para a lib**

Em `api/sheet-leads.js`, apague o que foi movido e troque os requires do topo por:

```js
const { readAllTabs, readLPTabs } = require('../lib/sheets');
const { classificarPorte, PORTE_MAIOR, PORTE_MENOR, PORTE_INDEF } = require('../lib/porte');
const {
  TAB_FORMS, TAB_LP, findLPHeaders, extractForms, extractLP, labelCargo, labelColaboradores,
} = require('../lib/planilha-leads');
```

Em `api/eventos-qualificados.js`, apague a função `ehLeadDeTeste` (linhas 65-68) e adicione `const { ehLeadDeTeste } = require('../lib/planilha-leads');` junto aos requires.

- [ ] **Step 6: Run tests**

Run: `node scripts/test-planilha-leads.js && node scripts/test-sheet-leads.js && node scripts/test-eventos-qualificados.js && npx eslint api/sheet-leads.js api/eventos-qualificados.js lib/planilha-leads.js`
Expected: os três verdes com o mesmo resultado do Step 1; lint sem erro; `api/sheet-leads.js` agora abaixo de 350 linhas.

- [ ] **Step 7: Commit** — `git add lib/planilha-leads.js api/sheet-leads.js api/eventos-qualificados.js scripts/test-planilha-leads.js && git commit -m "refactor(leads): extração das planilhas em lib própria, regra de lead de teste única"`


---

### Task 4: `lib/leads-unificados.js` — normalização e agregação (puro)

**Files:**
- Create: `lib/leads-unificados.js`
- Modify: `lib/meta.js:104-118` (`classifyCampaign` ganha `CAFE` — feito aqui porque a classificação é pré-requisito; T6 não a repete)
- Test: `scripts/test-leads-unificados.js`

**Interfaces:**
- Consumes: T1 `diaDe`, `cadaDia`, `FUSO`; T2 `chaveDoMacro`; `lib/porte.js` `classificarPorte`, `ehQualificado`, `PORTE_*`; `lib/meta.js` `classifyCampaign`; T3 `labelCargo`, `labelColaboradores`.
- Produces: `unificar({ forms, respondi, supabase }, since, until) → payload` (formato abaixo), `normalizar(bruto, fonte) → lead`, `SEM_ETIQUETA`, `ETIQUETA_QUEBRADA`, `FONTES = ['FORMS','RESPONDI','SUPABASE','CAFE']`.

Payload de `unificar` (todo bloco de contagem é `{ leads, mql }`):

```
{ periodo:{since,until,fuso}, total, por_dia:[{dia,leads,mql,fontes:{FORMS,RESPONDI,SUPABASE,CAFE}}],
  por_grupo:{SE,CAFE,CP,OUTROS}, por_formato:{FORMS,LP},
  por_campanha:[{campanha,grupo,formato,leads,mql}], por_conjunto:[{conjunto,campanha,leads,mql}],
  por_anuncio:[{anuncio,conjunto,campanha,leads,mql}], por_fonte:[{fonte,leads,mql}], por_pagina:[{pagina,leads,mql}],
  porte:{MAIOR_10,MENOR_10,INDEFINIDO}, qualificacao:{cargo:{},colaboradores:{}},
  fontes:[{nome,total_no_periodo,ultimo_lead,dias_sem_lead}] }
```

- [ ] **Step 1: Write the failing test**

```js
// scripts/test-leads-unificados.js
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
```

- [ ] **Step 2: Run test to verify it fails** — `node scripts/test-leads-unificados.js` → falha em `classifyCampaign(...).grupo === 'CAFE'` ou `Cannot find module`.

- [ ] **Step 3: `CAFE` em `lib/meta.js`**

Em `classifyCampaign`, troque o cálculo de `grupo` por:

```js
  const grupo = upper.includes('[CP]') ? 'CP'
              : upper.includes('[SE]') ? 'SE'
              : /CAF[EÉ]/.test(upper)  ? 'CAFE'
              : 'OUTROS';
```

e atualize o comentário da função: `[CAFÉ] → Café com Sevilha (landing page do RD Marketing)`.

- [ ] **Step 4: Write `lib/leads-unificados.js`**

```js
'use strict';

/**
 * Uma regra só para "o que é um lead" — a mesma para as quatro fontes:
 * export do Meta (FORMS), formulário do Respondi (LP antiga), Supabase (páginas
 * deste site) e Café com Sevilha (webhook do RD Marketing, gravado no Supabase
 * com pagina "rd:<identificador>"). Aqui não há rede: recebe registros brutos e
 * devolve agregados. Quem lê as fontes é lib/leads-fontes.js.
 */

const { norm } = require('./texto');
const { classificarPorte, ehQualificado, PORTE_MAIOR, PORTE_MENOR, PORTE_INDEF } = require('./porte');
const { classifyCampaign } = require('./meta');
const { chaveDoMacro } = require('./posicionamento');
const { diaDe, cadaDia, FUSO } = require('./fuso');
const { labelCargo, labelColaboradores } = require('./planilha-leads');

const FONTES = ['FORMS', 'RESPONDI', 'SUPABASE', 'CAFE'];
const SEM_ETIQUETA = 'Sem etiqueta';
const ETIQUETA_QUEBRADA = 'Etiqueta quebrada';
// Página do site diz a oferta quando a UTM não diz.
const GRUPO_POR_PAGINA = {
  '/mentoria': 'SE', '/mentoria-2': 'SE',
  '/': 'CP', '/pre-inscricao-2': 'CP', '/pre-inscricao-3': 'CP',
};

/** Macro gravada literal ({{campaign.name}}, __CID_NAME__) é etiqueta quebrada, não origem nova. */
function etiqueta(valor) {
  const s = String(valor || '').trim();
  if (!s) return SEM_ETIQUETA;
  if (s.includes('{{') || s.includes('__')) return ETIQUETA_QUEBRADA;
  return s;
}

function normalizarEmail(e) { return norm(e).replace(/\s+/g, ''); }
/** Só dígitos; os 11 finais ignoram +55 e zero de operadora. */
function normalizarTelefone(t) {
  const d = String(t || '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-11) : '';
}
function chaveContato(l) {
  const e = normalizarEmail(l.email);
  if (e.includes('@')) return `e:${e}`;
  const t = normalizarTelefone(l.telefone);
  return t ? `t:${t}` : null;
}

function grupoDe(lead) {
  const { grupo } = classifyCampaign(lead.campanha);
  if (grupo !== 'OUTROS') return grupo;
  if (lead.fonte === 'CAFE') return 'CAFE';
  return GRUPO_POR_PAGINA[lead.pagina] || 'OUTROS';
}

/** Registro bruto de qualquer fonte → lead com as mesmas chaves. */
function normalizar(bruto, fonte) {
  const pos = etiqueta(bruto.posicionamento);
  const lead = {
    fonte,
    id: bruto.id ?? null,
    dia: bruto.dia,
    email: bruto.email || '',
    telefone: bruto.telefone || '',
    campanha: etiqueta(bruto.campanha),
    conjunto: etiqueta(bruto.conjunto),
    anuncio: etiqueta(bruto.anuncio),
    posicionamento: (pos === SEM_ETIQUETA || pos === ETIQUETA_QUEBRADA) ? pos : chaveDoMacro(pos),
    pagina: bruto.pagina || null,
    colaboradores: bruto.colaboradores || '',
    cargo: bruto.cargo || '',
  };
  lead.grupo = grupoDe(lead);
  lead.formato = fonte === 'FORMS' ? 'FORMS' : 'LP';
  lead.mql = ehQualificado(lead.colaboradores);
  return lead;
}

const dePlanilha = r => ({
  id: r.id, dia: r.data, email: r.email, telefone: r.telefone, campanha: r.campanha,
  conjunto: r.adset, anuncio: r.anuncio, posicionamento: r.plataforma,
  colaboradores: r.colaboradores, cargo: r.cargo,
});
const deSupabase = r => ({
  id: r.id, dia: diaDe(r.created_at), email: r.email, telefone: r.telefone,
  campanha: r.utm_campaign, conjunto: r.utm_medium, anuncio: r.utm_content,
  posicionamento: r.utm_source, pagina: r.pagina, colaboradores: r.colaboradores, cargo: r.cargo,
});
const fonteSupabase = r => (String(r.pagina || '').startsWith('rd:') ? 'CAFE' : 'SUPABASE');

const par = () => ({ leads: 0, mql: 0 });
function somar(acc, l) { acc.leads++; if (l.mql) acc.mql++; return acc; }

/** Agrupa por chave, devolve lista ordenada por leads, com colunas extras da primeira ocorrência. */
function agrupar(itens, chaveFn, campo, extras = () => ({})) {
  const mapa = new Map();
  for (const l of itens) {
    const k = chaveFn(l);
    if (!mapa.has(k)) mapa.set(k, { [campo]: k, ...extras(l), ...par() });
    somar(mapa.get(k), l);
  }
  return [...mapa.values()].sort((a, b) => b.leads - a.leads || b.mql - a.mql);
}

function contarPor(itens, fn) {
  const m = {};
  for (const l of itens) { const k = fn(l); if (k) m[k] = (m[k] || 0) + 1; }
  return m;
}

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 864e5);
}

function unificar({ forms = [], respondi = [], supabase = [] }, since, until) {
  const todos = [
    ...forms.map(r => normalizar(dePlanilha(r), 'FORMS')),
    ...respondi.map(r => normalizar(dePlanilha(r), 'RESPONDI')),
    ...supabase.map(r => normalizar(deSupabase(r), fonteSupabase(r))),
  ].filter(l => l.dia).sort((a, b) => a.dia.localeCompare(b.dia));

  // Dedupe sobre tudo o que foi lido, antes do recorte: quem reenvia o
  // formulário dentro do período mas já era lead antes não vira lead novo.
  // Sem contato, o id da fonte segura repetição dentro da própria fonte.
  const vistos = new Set();
  const unicos = todos.filter(l => {
    const chave = chaveContato(l) || (l.id !== null ? `${l.fonte}|${l.id}` : null);
    if (!chave) return true;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
  const noPeriodo = unicos.filter(l => l.dia >= since && l.dia <= until);

  const porDia = cadaDia(since, until).map(dia => {
    const doDia = noPeriodo.filter(l => l.dia === dia);
    const fontes = Object.fromEntries(FONTES.map(f => [f, doDia.filter(l => l.fonte === f).length]));
    return { dia, ...doDia.reduce(somar, par()), fontes };
  });

  const porGrupo = Object.fromEntries(['SE', 'CAFE', 'CP', 'OUTROS'].map(g =>
    [g, noPeriodo.filter(l => l.grupo === g).reduce(somar, par())]));
  const porFormato = Object.fromEntries(['FORMS', 'LP'].map(f =>
    [f, noPeriodo.filter(l => l.formato === f).reduce(somar, par())]));

  const fontes = FONTES.map(nome => {
    const todasDaFonte = unicos.filter(l => l.fonte === nome);
    const ultimo = todasDaFonte.length ? todasDaFonte[todasDaFonte.length - 1].dia : null;
    return {
      nome,
      total_no_periodo: noPeriodo.filter(l => l.fonte === nome).length,
      ultimo_lead: ultimo,
      dias_sem_lead: ultimo ? Math.max(0, diasEntre(ultimo, until)) : null,
    };
  });

  return {
    periodo: { since, until, fuso: FUSO },
    total: noPeriodo.reduce(somar, par()),
    por_dia: porDia,
    por_grupo: porGrupo,
    por_formato: porFormato,
    por_campanha: agrupar(noPeriodo, l => l.campanha, 'campanha', l => ({ grupo: l.grupo, formato: l.formato })),
    por_conjunto: agrupar(noPeriodo, l => l.conjunto, 'conjunto', l => ({ campanha: l.campanha })),
    por_anuncio:  agrupar(noPeriodo, l => l.anuncio, 'anuncio', l => ({ conjunto: l.conjunto, campanha: l.campanha })),
    por_fonte:    agrupar(noPeriodo, l => l.posicionamento, 'fonte'),
    por_pagina:   agrupar(noPeriodo.filter(l => l.pagina), l => l.pagina, 'pagina'),
    porte: {
      MAIOR_10:   noPeriodo.filter(l => classificarPorte(l.colaboradores) === PORTE_MAIOR).length,
      MENOR_10:   noPeriodo.filter(l => classificarPorte(l.colaboradores) === PORTE_MENOR).length,
      INDEFINIDO: noPeriodo.filter(l => classificarPorte(l.colaboradores) === PORTE_INDEF).length,
    },
    qualificacao: {
      cargo:         contarPor(noPeriodo, l => labelCargo(l.cargo)),
      colaboradores: contarPor(noPeriodo, l => labelColaboradores(l.colaboradores)),
    },
    fontes,
  };
}

module.exports = { unificar, normalizar, chaveContato, etiqueta, FONTES, SEM_ETIQUETA, ETIQUETA_QUEBRADA };
```

- [ ] **Step 5: Run tests** — `node scripts/test-leads-unificados.js && node scripts/test-meta-leads.js` → `✓ leads-unificados` e o teste do Meta continua verde.

- [ ] **Step 6: Commit** — `git add lib/leads-unificados.js lib/meta.js scripts/test-leads-unificados.js && git commit -m "feat(leads): regra única de lead e MQL unificando planilha, Supabase e Café"`

---

### Task 5: `lib/leads-fontes.js` + modo `unificados` em `api/sheet-leads.js` + rewrite

**Files:**
- Modify: `lib/supabase.js` (+ `lerTudo`)
- Create: `lib/leads-fontes.js`
- Modify: `api/sheet-leads.js` (handler), `vercel.json` (rewrite antes de `/api/(.*)`)
- Test: `scripts/test-leads-fontes.js`

**Interfaces:**
- Consumes: T3 `extractForms`, `findLPHeaders`, `extractLP`; T4 `unificar`; `lib/sheets.js` `readAllTabs()`/`readLPTabs()` (cada uma devolve `[{ rows, modo }]`); T1 `inicioDoDia`, `fimDoDia`.
- Produces: `lerTudo(url) → rows[]` em `lib/supabase.js`; `montarUnificados(since, until) → payload` (o de T4 mais `fontes[].modo`, `fontes[].erro` e `gerado_em`); `responderUnificados(req, res)`; rota `GET /api/leads-unificados?since&until`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test-leads-fontes.js
'use strict';
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';

// Planilhas em memória: a Central com um registro FORMS; o Respondi vazio.
const sheets = require('../lib/sheets');
sheets.readAllTabs = async () => [{ modo: 'stub', rows: [
  ['l:1', '2026-09-10T10:00:00-03:00', '1', 'AD 07', '2', 'HOT', '3', '[SE] [FORMS] [LEAD] [HOT]', '4', 'F', 'false', 'ig',
   'Maria', 'maria@x.com', '', 'De 10 a 19', 'dono/sócio', '', '', '', '', '', ''],
] }];
sheets.readLPTabs = async () => { throw new Error('planilha do Respondi indisponível'); };

// Supabase paginado: 1000 linhas na primeira página, 1 na segunda.
const linha = i => ({ id: i, created_at: '2026-09-11T12:00:00+00:00', pagina: '/mentoria', email: `u${i}@x.com`,
  telefone: '', utm_source: 'Instagram_Feed', utm_medium: 'HOT', utm_campaign: '[SE] [PÁGINA NOVA]', utm_content: 'AD 1',
  colaboradores: 'de_0_a_4', cargo: '' });
const pedidos = [];
global.fetch = async (url, opts = {}) => {
  pedidos.push({ url: String(url), range: opts.headers && opts.headers.Range });
  const ini = Number((opts.headers.Range || '0-').split('-')[0]);
  const lote = ini === 0 ? Array.from({ length: 1000 }, (_, i) => linha(i)) : [linha(1000)];
  return { ok: true, status: 206, json: async () => lote, text: async () => '' };
};

const { montarUnificados } = require('../lib/leads-fontes');

(async () => {
  const r = await montarUnificados('2026-09-10', '2026-09-13');
  assert.equal(r.total.leads, 1002, '1 FORMS + 1001 Supabase');
  assert.equal(pedidos.length, 2, 'duas páginas de 1000');
  assert.ok(pedidos[0].url.includes('created_at=gte.2026-09-10T00:00:00-03:00'));
  assert.ok(pedidos[0].url.includes('order=created_at.asc'));
  assert.equal(pedidos[1].range, '1000-1999');
  const resp = r.fontes.find(f => f.nome === 'RESPONDI');
  assert.equal(resp.erro, 'planilha do Respondi indisponível', 'fonte que falha vira erro na resposta, não 502');
  assert.equal(r.fontes.find(f => f.nome === 'FORMS').modo, 'stub');
  assert.ok(r.gerado_em);
  console.log('✓ leads-fontes');
})();
```

- [ ] **Step 2: Run test to verify it fails** — `node scripts/test-leads-fontes.js` → `Cannot find module '../lib/leads-fontes'`

- [ ] **Step 3: `lerTudo` em `lib/supabase.js`**

Acrescente antes do `module.exports`:

```js
/**
 * GET paginado no PostgREST. O `fetchAll` antigo pedia uma página só: acima do
 * max-rows do servidor as contagens ficavam silenciosamente menores. A URL
 * precisa de `order=` para a paginação ser estável.
 */
async function lerTudo(url, headersExtra = {}) {
  const c = conexao();
  if (!c) throw new Error('Supabase não configurado');
  const PAG = 1000;
  const linhas = [];
  for (let ini = 0; ; ini += PAG) {
    const r = await fetch(url, { headers: { ...c.headers, ...headersExtra, Range: `${ini}-${ini + PAG - 1}`, 'Range-Unit': 'items' } });
    if (r.status === 416) break; // pedimos além do fim: total era múltiplo exato da página
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const lote = await r.json();
    linhas.push(...lote);
    if (lote.length < PAG) break;
  }
  return linhas;
}
```

e exporte: `module.exports = { TABELAS, conexao, rest, lerTudo };`

- [ ] **Step 4: Write `lib/leads-fontes.js`**

```js
'use strict';

/**
 * Lê as fontes de lead e entrega o payload unificado (regra em
 * lib/leads-unificados.js). Servido como GET /api/leads-unificados — rewrite
 * para api/sheet-leads.js?modo=unificados, porque o plano Hobby limita o deploy
 * a 12 funções e elas já existem.
 *
 * Uma fonte que falha não derruba a resposta: vira `fontes[].erro`, e o painel
 * mostra. Só quando TODAS falham o endpoint responde 502.
 */

const { readAllTabs, readLPTabs } = require('./sheets');
const { TABELAS, rest, lerTudo } = require('./supabase');
const { extractForms, findLPHeaders, extractLP } = require('./planilha-leads');
const { unificar } = require('./leads-unificados');
const { inicioDoDia, fimDoDia } = require('./fuso');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SELECT = 'id,created_at,pagina,email,telefone,utm_source,utm_medium,utm_campaign,utm_content,colaboradores,cargo';

async function lerForms() {
  const tabs = await readAllTabs();
  return { modo: tabs[0]?.modo || 'sem aba', registros: tabs.flatMap(t => extractForms(t.rows)) };
}
async function lerRespondi() {
  const tabs = await readLPTabs();
  return { modo: tabs[0]?.modo || 'sem aba',
           registros: tabs.flatMap(t => findLPHeaders(t.rows).flatMap(h => extractLP(t.rows, h))) };
}
async function lerSupabase(since, until) {
  const url = rest(TABELAS.leads,
    `select=${SELECT}&created_at=gte.${inicioDoDia(since)}&created_at=lte.${fimDoDia(until)}&order=created_at.asc`);
  if (!url) throw new Error('Supabase não configurado');
  return { modo: 'postgrest', registros: await lerTudo(url) };
}

const tolerante = p => p.then(r => ({ ...r, erro: null }), e => ({ modo: null, registros: [], erro: e.message }));

async function montarUnificados(since, until) {
  const [forms, respondi, supabase] = await Promise.all([
    tolerante(lerForms()), tolerante(lerRespondi()), tolerante(lerSupabase(since, until)),
  ]);
  if (forms.erro && respondi.erro && supabase.erro) {
    throw new Error(`todas as fontes falharam — FORMS: ${forms.erro}; Respondi: ${respondi.erro}; Supabase: ${supabase.erro}`);
  }
  const payload = unificar(
    { forms: forms.registros, respondi: respondi.registros, supabase: supabase.registros }, since, until);
  const info = { FORMS: forms, RESPONDI: respondi, SUPABASE: supabase, CAFE: supabase };
  payload.fontes = payload.fontes.map(f => ({ ...f, modo: info[f.nome].modo, erro: info[f.nome].erro }));
  payload.gerado_em = new Date().toISOString();
  return payload;
}

async function responderUnificados(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
  const params = new URL(req.url, 'http://localhost').searchParams;
  const since = params.get('since');
  const until = params.get('until');
  if (!DATE_RE.test(since || '') || !DATE_RE.test(until || '') || since > until) {
    return res.status(400).json({ error: 'Informe since e until no formato YYYY-MM-DD, com since <= until' });
  }
  try {
    return res.status(200).json(await montarUnificados(since, until));
  } catch (err) {
    console.error('[leads-unificados]', err.message);
    return res.status(502).json({ error: err.message });
  }
}

module.exports = { montarUnificados, responderUnificados };
```

- [ ] **Step 5: Modo em `api/sheet-leads.js` e rewrite**

No handler de `api/sheet-leads.js`, logo depois das checagens de método (`if (req.method !== 'GET') ...`), insira:

```js
  // /api/leads-unificados chega aqui por rewrite (limite de 12 funções do plano).
  const url = new URL(req.url, 'http://localhost');
  if (url.searchParams.get('modo') === 'unificados' || url.pathname.includes('leads-unificados')) {
    return responderUnificados(req, res);
  }
```

com `const { responderUnificados } = require('../lib/leads-fontes');` no topo. Em `vercel.json`, dentro de `rewrites`, antes do item `"/api/(.*)"`:

```json
    {
      "source": "/api/leads-unificados",
      "destination": "/api/sheet-leads?modo=unificados"
    },
```

- [ ] **Step 6: Run tests** — `node scripts/test-leads-fontes.js && node scripts/test-sheet-leads.js && npx eslint lib/leads-fontes.js lib/supabase.js api/sheet-leads.js`
Expected: `✓ leads-fontes`, regressão verde, lint sem erro.

- [ ] **Step 7: Commit** — `git add lib/supabase.js lib/leads-fontes.js api/sheet-leads.js vercel.json scripts/test-leads-fontes.js && git commit -m "feat(api): GET /api/leads-unificados com Supabase paginado e fontes tolerantes a falha"`

---

### Task 6: Meta — fuso, `CAFE` nos agregados, níveis adset / anúncio / posicionamento

**Files:**
- Modify: `lib/meta.js` (novas `fetchAdsetInsights`, `fetchPlacementInsights`; exportar)
- Modify: `api/meta.js` (substitui `eachDay`; `CAFE` em grupos e série; `conjuntos`, `anuncios`, `posicionamentos`)
- Test: `scripts/test-meta-agregados.js` (novo); regressão `scripts/test-meta-leads.js`

**Interfaces:**
- Consumes: T1 `cadaDia`; T2 `chavePosicionamento`; `classifyCampaign` já com `CAFE` (T4).
- Produces em `GET /api/meta`: `grupos.CAFE`, `serie[].CAFE`, e três listas com a mesma forma de `campanhas[]`: `conjuntos[{id,nome,campanha,grupo,formato,spend,leads,leads_onsite,leads_pixel,impressions,clicks,cpl,ctr,cpm}]`, `anuncios[{id,nome,conjunto,campanha,grupo,…}]`, `posicionamentos[{nome:'instagram:stories',spend,leads,…}]`. `montarMeta(since, until)` continua exportado.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test-meta-agregados.js
'use strict';
const assert = require('node:assert/strict');
process.env.META_ACCESS_TOKEN = 'x';

const acao = (tipo, v) => ({ action_type: tipo, value: String(v) });
const CAMP = [
  { campaign_id: '1', campaign_name: '[SE] [FORMS] [LEAD] [HOT]', spend: '100', impressions: '1000', clicks: '50', actions: [acao('onsite_conversion.lead_grouped', 4), acao('lead', 9)] },
  { campaign_id: '2', campaign_name: '[CAFÉ COM SEVILHA] COLD', spend: '50', impressions: '500', clicks: '10', actions: [acao('lead', 3)] },
];
const DIA = [{ campaign_name: '[CAFÉ COM SEVILHA] COLD', spend: '50', date_start: '2026-09-11', actions: [acao('lead', 3)] }];
const ADSET = [{ adset_id: 'a1', adset_name: 'HOT', campaign_name: '[SE] [FORMS] [LEAD] [HOT]', spend: '100', impressions: '1000', clicks: '50', actions: [acao('onsite_conversion.lead_grouped', 4)] }];
const AD = [{ ad_id: 'x1', ad_name: 'AD 07', adset_name: 'HOT', campaign_name: '[SE] [FORMS] [LEAD] [HOT]', spend: '100', impressions: '1000', clicks: '50', actions: [] }];
const PLAC = [
  { campaign_name: '[SE] [FORMS] [LEAD] [HOT]', publisher_platform: 'instagram', platform_position: 'instagram_stories', spend: '60', impressions: '600', clicks: '30', actions: [] },
  { campaign_name: '[CAFÉ COM SEVILHA] COLD', publisher_platform: 'instagram', platform_position: 'instagram_stories', spend: '20', impressions: '200', clicks: '5', actions: [] },
  { campaign_name: '[SE] [FORMS] [LEAD] [HOT]', publisher_platform: 'facebook', platform_position: 'feed', spend: '40', impressions: '400', clicks: '20', actions: [] },
];
global.fetch = async (url) => {
  const u = String(url);
  const dados = u.includes('breakdowns=') ? PLAC : u.includes('level=ad&') ? AD : u.includes('level=adset') ? ADSET
              : u.includes('time_increment') ? DIA : CAMP;
  return { json: async () => ({ data: dados }) };
};

const { montarMeta } = require('../api/meta');
(async () => {
  const m = await montarMeta('2026-09-10', '2026-09-12');
  assert.equal(m.grupos.CAFE.spend, 50);
  assert.equal(m.grupos.CAFE.leads, 3);
  assert.equal(m.grupos.SE.leads, 4, 'FORMS usa onsite');
  assert.deepEqual(m.serie.map(d => d.data), ['2026-09-10', '2026-09-11', '2026-09-12']);
  assert.equal(m.serie[1].CAFE.spend, 50);
  assert.equal(m.serie[1].LP.leads, 3, 'Café é LP e entra no formato');
  assert.equal(m.conjuntos[0].nome, 'HOT'); assert.equal(m.conjuntos[0].grupo, 'SE'); assert.equal(m.conjuntos[0].leads, 4);
  assert.equal(m.anuncios[0].nome, 'AD 07'); assert.equal(m.anuncios[0].conjunto, 'HOT');
  const st = m.posicionamentos.find(p => p.nome === 'instagram:stories');
  assert.equal(st.spend, 80, 'duas campanhas somadas no mesmo posicionamento');
  assert.equal(m.posicionamentos.find(p => p.nome === 'facebook:feed').spend, 40);
  console.log('✓ meta-agregados');
})();
```

- [ ] **Step 2: Run test to verify it fails** — `node scripts/test-meta-agregados.js` → falha em `grupos.CAFE` (undefined).

- [ ] **Step 3: Novas leituras em `lib/meta.js`**

Depois de `fetchAdInsights`:

```js
/** Insights por conjunto de anúncios — o "público" da aba Origem (utm_medium={{adset.name}}). */
async function fetchAdsetInsights(since, until) {
  const { account } = getConfig();
  return graphGetAll(`act_${account}/insights`, {
    fields: 'adset_id,adset_name,campaign_name,spend,impressions,clicks,actions',
    level: 'adset',
    time_range: JSON.stringify({ since, until }),
    limit: '200',
  });
}

/** Gasto por posicionamento — casa com utm_source={{placement}} via lib/posicionamento.js. */
async function fetchPlacementInsights(since, until) {
  const { account } = getConfig();
  return graphGetAll(`act_${account}/insights`, {
    fields: 'campaign_name,spend,impressions,clicks,actions',
    breakdowns: 'publisher_platform,platform_position',
    level: 'campaign',
    time_range: JSON.stringify({ since, until }),
    limit: '500',
  });
}
```

Adicione `fetchAdsetInsights, fetchPlacementInsights` ao `module.exports`.

- [ ] **Step 4: `api/meta.js`**

1. Requires: acrescente `fetchAdInsights, fetchAdsetInsights, fetchPlacementInsights` ao destructuring de `../lib/meta`; `const { cadaDia } = require('../lib/fuso');` e `const { chavePosicionamento } = require('../lib/posicionamento');`. Apague a função `eachDay` e troque `eachDay(since, until)` por `cadaDia(since, until)`.
2. Substitua o `rows.map(...)` de campanhas por um helper reutilizável, colocado acima de `montarMeta`:

```js
/** Uma linha de insights (campanha, conjunto, anúncio) no formato que o painel consome. */
function linha(r, nome, extras) {
  const spend = parseFloat(r.spend || 0);
  const leads = extractLeads(r);
  const impressions = parseFloat(r.impressions || 0);
  const clicks = parseFloat(r.clicks || 0);
  return {
    nome, ...extras,
    spend: round2(spend), leads,
    leads_onsite: extractOnsiteLeads(r), leads_pixel: extractPixelLeads(r),
    impressions, clicks,
    cpl: leads > 0       ? round2(spend / leads)                : null,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : null,
    cpm: impressions > 0 ? round2((spend / impressions) * 1000) : null,
  };
}
const porGasto = (a, b) => b.spend - a.spend;
```

e em `montarMeta`:

```js
    const opcional = (p, rotulo) => p.catch(e => { console.warn(`[meta] ${rotulo} indisponível:`, e.message); return []; });
    const [rows, dailyRows, adsetRows, adRows, placementRows] = await Promise.all([
      fetchCampaignInsights(since, until),
      fetchDailyInsights(since, until),
      opcional(fetchAdsetInsights(since, until), 'conjuntos'),
      opcional(fetchAdInsights(since, until), 'anúncios'),
      opcional(fetchPlacementInsights(since, until), 'posicionamentos'),
    ]);

    const campanhas = rows
      .map(r => linha(r, r.campaign_name, { id: r.campaign_id, ...classifyCampaign(r.campaign_name) }))
      .sort(porGasto);
    const conjuntos = adsetRows
      .map(r => linha(r, r.adset_name, { id: r.adset_id, campanha: r.campaign_name, ...classifyCampaign(r.campaign_name) }))
      .sort(porGasto);
    const anuncios = adRows
      .map(r => linha(r, r.ad_name, { id: r.ad_id, conjunto: r.adset_name, campanha: r.campaign_name, grupo: classifyCampaign(r.campaign_name).grupo }))
      .sort(porGasto);
    const porPos = {};
    for (const r of placementRows) {
      const k = chavePosicionamento(r.publisher_platform, r.platform_position);
      addToBucket(porPos[k] || (porPos[k] = emptyBucket()), r);
    }
    const posicionamentos = Object.entries(porPos)
      .map(([nome, b]) => ({ nome, ...withDerived(b) })).sort(porGasto);
```

3. Grupos: `const grupos = { CP: emptyBucket(), SE: emptyBucket(), CAFE: emptyBucket(), OUTROS: emptyBucket() };` e na saída `grupos: { CP: …, SE: …, CAFE: withDerived(grupos.CAFE), OUTROS: … }`. A condição `if (grupo !== 'OUTROS') addToBucket(formatos[formato], r);` fica como está (Café é LP e entra).
4. Série: em `diaVazio` acrescente `CAFE: { spend: 0, leads: 0 },`; no laço troque `if (grupo === 'CP' || grupo === 'SE')` por `if (grupo !== 'OUTROS')`; no `map` final acrescente `CAFE: { spend: round2(d.CAFE.spend), leads: d.CAFE.leads },`.
5. Retorno: acrescente `conjuntos, anuncios, posicionamentos,` depois de `campanhas,`. Mantenha `campanhas[].nome` (o front usa `nome`).

- [ ] **Step 5: Run tests** — `node scripts/test-meta-agregados.js && node scripts/test-meta-leads.js && npx eslint api/meta.js lib/meta.js` → verdes, `api/meta.js` abaixo de 350 linhas.

- [ ] **Step 6: Commit** — `git add lib/meta.js api/meta.js scripts/test-meta-agregados.js && git commit -m "feat(meta): grupo Café, série no fuso do painel e gasto por conjunto, anúncio e posicionamento"`

---

### Task 7: `api/rd-stats.js` — deals por campanha

**Files:**
- Modify: `api/rd-stats.js`
- Test: `scripts/test-rd-stats-campanha.js`

**Interfaces:**
- Produces: `por_campanha: [{ campanha, deals, ganhos, perdidos, valor }]` e `total_deals` no JSON; `module.exports.agruparPorCampanha(deals)` exportado para teste. Campo custom lido de `deal_custom_fields[]` com id `RD_CRM_CF_UTM_CAMPAIGN` (padrão `68e6669152f4a7001f8d9f8f`, o mesmo que `api/leads.js:278` grava).

- [ ] **Step 1: Write the failing test**

```js
// scripts/test-rd-stats-campanha.js
'use strict';
const assert = require('node:assert/strict');
const { agruparPorCampanha } = require('../api/rd-stats');
const CF = '68e6669152f4a7001f8d9f8f';
const deals = [
  { win: null,  amount_total: 0,    deal_custom_fields: [{ custom_field_id: CF, value: '[SE] [FORMS] [LEAD] [HOT]' }] },
  { win: true,  amount_total: 1500, deal_custom_fields: [{ custom_field: { _id: CF }, value: '[SE] [FORMS] [LEAD] [HOT]' }] },
  { win: false, amount_unique: 0,   deal_custom_fields: [{ custom_field: { _id: 'outro' }, value: 'x' }] },
  { win: null,  deal_custom_fields: [] },
  { win: null },
];
const r = agruparPorCampanha(deals);
assert.deepEqual(r[0], { campanha: 'Sem campanha', deals: 3, ganhos: 0, perdidos: 1, valor: 0 });
assert.deepEqual(r[1], { campanha: '[SE] [FORMS] [LEAD] [HOT]', deals: 2, ganhos: 1, perdidos: 0, valor: 1500 });
console.log('✓ rd-stats por campanha');
```

- [ ] **Step 2: Run test to verify it fails** — `node scripts/test-rd-stats-campanha.js` → `agruparPorCampanha is not a function`

- [ ] **Step 3: Implementation**

Acima do handler em `api/rd-stats.js`:

```js
// Campo custom do deal que api/leads.js preenche com utm_campaign. É o que
// permite dizer "esta campanha virou N deals" sem depender de e-mail.
const CF_UTM_CAMPAIGN = process.env.RD_CRM_CF_UTM_CAMPAIGN || '68e6669152f4a7001f8d9f8f';
const SEM_CAMPANHA = 'Sem campanha';

function campanhaDoDeal(d) {
  const cfs = d.deal_custom_fields || d.custom_fields || [];
  const cf = cfs.find(c => (c.custom_field_id || c.custom_field?._id || c.custom_field?.id) === CF_UTM_CAMPAIGN);
  const v = cf ? cf.value : null;
  return typeof v === 'string' && v.trim() ? v.trim() : SEM_CAMPANHA;
}

function agruparPorCampanha(deals) {
  const mapa = {};
  for (const d of deals) {
    const k = campanhaDoDeal(d);
    const m = mapa[k] || (mapa[k] = { campanha: k, deals: 0, ganhos: 0, perdidos: 0, valor: 0 });
    m.deals++;
    if (d.win === true)  m.ganhos++;
    if (d.win === false) m.perdidos++;
    m.valor += parseFloat(d.amount_total || d.amount_unique || 0) || 0;
  }
  return Object.values(mapa)
    .map(m => ({ ...m, valor: Math.round(m.valor * 100) / 100 }))
    .sort((a, b) => b.deals - a.deals);
}
```

No handler: declare `const todosDeals = [];` antes do `Promise.all` dos funis, faça `todosDeals.push(...deals);` logo após `const deals = await fetchDeals(...)`, e no JSON de resposta acrescente `total_deals: todosDeals.length, por_campanha: agruparPorCampanha(todosDeals),`. No fim do arquivo: `module.exports.agruparPorCampanha = agruparPorCampanha;`.

- [ ] **Step 4: Run test** — `node scripts/test-rd-stats-campanha.js && npx eslint api/rd-stats.js` → verde.
- [ ] **Step 5: Commit** — `git add api/rd-stats.js scripts/test-rd-stats-campanha.js && git commit -m "feat(rd): deals agrupados por utm_campaign para o cruzamento lead → deal"`

---

### Task 8: Webhook do RD Marketing (`lib/rd-webhook.js` + modo em `api/respondi.js`)

**Files:**
- Create: `lib/rd-webhook.js`
- Modify: `api/respondi.js` (handler, antes de `segredoConfere`), `.env.example` (após `RD_CRM_TOKEN=`)
- Test: `scripts/test-rd-webhook.js`

**Interfaces:**
- Produces: `POST /api/respondi?fonte=rd-marketing&token=<RD_MARKETING_WEBHOOK_SECRET>` → grava em `sevilha_leads` (`pagina = rd:<identificador>`, `event_id = rd:<uuid>`), responde `{ ok, recebidos, gravados, ignorados }`. `leadDe(contato) → payload` exportado para teste.
- Depois do deploy, passo manual do dono da conta: RD Marketing → Integrações → Webhooks → evento **Conversão** → URL acima.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test-rd-webhook.js
'use strict';
const assert = require('node:assert/strict');
process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'chave';
process.env.RD_MARKETING_WEBHOOK_SECRET = 'segredo';
process.env.RESPONDI_WEBHOOK_SECRET = 'outro';

const { leadDe, responder } = require('../lib/rd-webhook');

const contato = {
  uuid: 'abc-123', name: 'Maria', email: 'maria@x.com', mobile_phone: '+55 11 99999-0000',
  last_conversion: {
    content: { identificador: 'cafe-com-sevilha', traffic_source: 'Instagram_Feed', traffic_campaign: '[CAFÉ COM SEVILHA] COLD',
               traffic_content: 'AD 02', cf_numero_de_colaboradores: 'De 10 a 19', cf_cargo: 'Sócio' },
  },
};
const lead = leadDe(contato);
assert.equal(lead.pagina, 'rd:cafe-com-sevilha');
assert.equal(lead.event_id, 'rd:abc-123');
assert.equal(lead.utm_source, 'Instagram_Feed');
assert.equal(lead.utm_campaign, '[CAFÉ COM SEVILHA] COLD');
assert.equal(lead.colaboradores, 'De 10 a 19');
assert.equal(lead.cargo, 'Sócio');
assert.equal(lead.telefone, '+55 11 99999-0000');
assert.equal(leadDe({ email: 'x@x.com', last_conversion: { content: { identificador: 'a' } } }).event_id.startsWith('rd:'), true, 'sem uuid deriva do e-mail');

function resFalso() { const r = { statusCode: null, corpo: null }; r.status = c => { r.statusCode = c; return r; }; r.json = b => { r.corpo = b; return r; }; r.end = () => r; return r; }
const chamadas = [];
let existente = false;
global.fetch = async (url, opts = {}) => {
  chamadas.push({ url: String(url), metodo: opts.method || 'GET', corpo: opts.body });
  if (!opts.method) return { ok: true, json: async () => (existente ? [{ id: 1 }] : []) };
  return { ok: true, status: 201, text: async () => '' };
};

(async () => {
  let res = resFalso();
  await responder({ method: 'POST', url: '/api/respondi?fonte=rd-marketing&token=errado', body: { leads: [contato] } }, res);
  assert.equal(res.statusCode, 401);

  res = resFalso();
  await responder({ method: 'POST', url: '/api/respondi?fonte=rd-marketing&token=segredo', body: JSON.stringify({ leads: [contato] }) }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.corpo, { ok: true, recebidos: 1, gravados: 1, ignorados: 0 });
  assert.equal(chamadas.filter(c => c.metodo === 'POST').length, 1);
  assert.ok(chamadas[0].url.includes('event_id=eq.rd%3Aabc-123'));
  assert.equal(JSON.parse(chamadas[1].corpo).pagina, 'rd:cafe-com-sevilha');

  existente = true; res = resFalso();
  await responder({ method: 'POST', url: '/api/respondi?fonte=rd-marketing&token=segredo', body: { leads: [contato] } }, res);
  assert.deepEqual(res.corpo, { ok: true, recebidos: 1, gravados: 0, ignorados: 1 }, 'reenvio do RD não duplica');
  console.log('✓ rd-webhook');
})();
```

- [ ] **Step 2: Run test to verify it fails** — `node scripts/test-rd-webhook.js` → `Cannot find module`

- [ ] **Step 3: Write `lib/rd-webhook.js`**

```js
'use strict';

/**
 * Webhook de conversão do RD Station Marketing → Supabase.
 *
 * A campanha [CAFÉ COM SEVILHA] leva para uma landing page do RD, então o lead
 * nasce lá e nenhuma fonte do painel o via. Ler a API do RD Marketing exigiria
 * OAuth; o webhook é configurado na interface do RD (Integrações → Webhooks,
 * evento "Conversão") e só precisa de um segredo na URL:
 *
 *   POST https://sevilha-perfomance.vercel.app/api/respondi?fonte=rd-marketing&token=<RD_MARKETING_WEBHOOK_SECRET>
 *
 * Servido por api/respondi.js (limite de 12 funções do plano). Só registra:
 * CRM, CAPI e planilha do Café continuam sendo feitos pelo próprio RD.
 *
 * Idempotência: event_id = rd:<uuid do contato>; antes de inserir, consulta.
 * Reenvio do RD (ele repete quando não recebe 200) não vira lead duplicado.
 */

const crypto = require('crypto');
const { TABELAS, conexao } = require('./supabase');

function segredoConfere(req) {
  const esperado = process.env.RD_MARKETING_WEBHOOK_SECRET || '';
  if (!esperado) return false;
  const daQuery = new URL(req.url || '/', 'http://localhost').searchParams.get('token') || '';
  const a = Buffer.from(esperado), b = Buffer.from(daQuery);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function corpoComoObjeto(body) {
  if (!body) return null;
  if (typeof body === 'string') { try { return JSON.parse(body); } catch { return null; } }
  return typeof body === 'object' ? body : null;
}

/** O RD manda { leads: [...] }; aceita também um contato solto ou uma lista. */
function contatosDe(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.leads)) return payload.leads;
  if (payload.lead && typeof payload.lead === 'object') return [payload.lead];
  return [payload];
}

/** Primeiro valor não vazio cuja chave passa no teste (campos custom do RD são cf_<nome>). */
function achar(obj, teste) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (teste(k.toLowerCase()) && v !== null && v !== undefined && String(v).trim()) return String(v).trim();
  }
  return '';
}

function leadDe(c) {
  const conv = c.last_conversion || c.conversion || {};
  const conteudo = conv.content || conv;
  const origem = conv.conversion_origin || c.conversion_origin || {};
  const identificador = conteudo.identificador || conteudo.conversion_identifier || 'rd';
  const email = c.email || conteudo.email_lead || conteudo.email || null;
  const uuid = c.uuid || c.id || conteudo.uuid
    || crypto.createHash('sha256').update(`${email}|${identificador}`).digest('hex').slice(0, 32);
  return {
    nome:         c.name || conteudo.name || conteudo.nome || null,
    email,
    telefone:     c.mobile_phone || c.personal_phone || conteudo.mobile_phone || conteudo.personal_phone || null,
    pagina:       `rd:${identificador}`,
    utm_source:   conteudo.traffic_source   || origem.source   || null,
    utm_medium:   conteudo.traffic_medium   || origem.medium   || null,
    utm_campaign: conteudo.traffic_campaign || origem.campaign || null,
    utm_content:  conteudo.traffic_content  || origem.content  || null,
    utm_term:     conteudo.traffic_value    || origem.value    || null,
    colaboradores: achar(conteudo, k => k.includes('colaborador')) || achar(c, k => k.includes('colaborador')) || null,
    cargo:        achar(conteudo, k => k.includes('cargo') || k.includes('posicao')) || null,
    event_id:     `rd:${uuid}`,
  };
}

async function gravarSeNovo(lead) {
  const c = conexao();
  if (!c) throw new Error('Supabase não configurado');
  const ja = await fetch(`${c.url}/rest/v1/${TABELAS.leads}?select=id&event_id=eq.${encodeURIComponent(lead.event_id)}&limit=1`,
    { headers: c.headers });
  if (!ja.ok) throw new Error(`Supabase ${ja.status} ao consultar`);
  if ((await ja.json()).length) return false;
  const r = await fetch(`${c.url}/rest/v1/${TABELAS.leads}`, {
    method: 'POST', headers: { ...c.headers, Prefer: 'return=minimal' }, body: JSON.stringify(lead),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return true;
}

async function responder(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!segredoConfere(req)) {
    console.warn('[rd-webhook] rejeitado: segredo ausente ou inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const payload = corpoComoObjeto(req.body);
  if (!payload) return res.status(400).json({ error: 'Corpo não é JSON válido' });

  const leads = contatosDe(payload).map(leadDe).filter(l => l.email || l.telefone);
  let gravados = 0, ignorados = 0;
  try {
    for (const l of leads) { if (await gravarSeNovo(l)) gravados++; else ignorados++; }
  } catch (e) {
    // 500 faz o RD reenviar mais tarde — o que queremos quando o banco falhou.
    console.error('[rd-webhook]', e.message);
    return res.status(500).json({ error: e.message });
  }
  console.log(`[rd-webhook] recebidos=${leads.length} gravados=${gravados} ignorados=${ignorados}`);
  return res.status(200).json({ ok: true, recebidos: leads.length, gravados, ignorados });
}

module.exports = { responder, leadDe };
```

- [ ] **Step 4: Modo em `api/respondi.js` e `.env.example`**

No início do handler de `api/respondi.js` (antes de `if (req.method === 'OPTIONS')`):

```js
  // Webhook do RD Marketing (Café com Sevilha) divide esta função — ver lib/rd-webhook.js.
  const fonte = new URL(req.url || '/', 'http://localhost').searchParams.get('fonte');
  if (fonte === 'rd-marketing') return responderRdWebhook(req, res);
```

com `const { responder: responderRdWebhook } = require('../lib/rd-webhook');` nos requires. Em `.env.example`, depois de `RD_CRM_TOKEN=`:

```
# Segredo do webhook de conversão do RD Marketing (Café com Sevilha). Gere com
# `openssl rand -hex 24`, ponha aqui e na Vercel, e cadastre no RD: Integrações →
# Webhooks → evento "Conversão" → URL
# https://sevilha-perfomance.vercel.app/api/respondi?fonte=rd-marketing&token=<este valor>
RD_MARKETING_WEBHOOK_SECRET=
```

- [ ] **Step 5: Run tests** — `node scripts/test-rd-webhook.js && node scripts/test-respondi-webhook.js && npx eslint lib/rd-webhook.js api/respondi.js` → verdes.
- [ ] **Step 6: Commit** — `git add lib/rd-webhook.js api/respondi.js .env.example scripts/test-rd-webhook.js && git commit -m "feat(rd): webhook de conversão do RD Marketing grava o lead do Café no Supabase"`

---

### Task 9: `api/stats.js` — fuso único, paginação, visitantes distintos

**Files:**
- Modify: `api/stats.js`
- Modify: `scripts/test-stats-paginas.js` (stub ganha a tabela de eventos e `Range`)

**Interfaces:**
- Consumes: T1 `inicioDoDia`, `fimDoDia`; T5 `lerTudo`.
- Produces: `paginas[].visitantes` (distintos, de `sevilha_eventos_pagina` com `evento=eq.pageview`, coluna de data `criado_em`) e `paginas[].conversao_visitantes` (leads ÷ visitantes, null sem visitante). Demais campos inalterados.

- [ ] **Step 1: Ajustar o teste**

Em `scripts/test-stats-paginas.js`, troque o `global.fetch` por:

```js
const EVENTOS = [
  { pagina: '/mentoria', visitante: 'v1' }, { pagina: '/mentoria', visitante: 'v1' }, { pagina: '/mentoria', visitante: 'v2' },
  { pagina: '/mentoria-2', visitante: 'v3' },
];
global.fetch = async (url) => {
  const u = String(url);
  const dados = u.includes('eventos_pagina') ? EVENTOS : u.includes('page_views') ? VIEWS : LEADS;
  return { ok: true, status: 200, json: async () => dados, text: async () => '' };
};
```

e acrescente, antes de `console.log('✓ ...')`:

```js
  assert.strictEqual(por['/mentoria'].visitantes, 2, 'v1 carregou duas vezes e conta uma');
  assert.strictEqual(por['/mentoria'].conversao_visitantes, 100, '2 leads em 2 visitantes');
  assert.strictEqual(por['/pagina-sem-beacon'].visitantes, 0);
  assert.strictEqual(por['/pagina-sem-beacon'].conversao_visitantes, null);
  assert.ok(urlsPedidas.some(u => u.includes('eventos_pagina') && u.includes('evento=eq.pageview') && u.includes('criado_em=gte.')));
```

Troque também a asserção de fuso para aceitar as duas colunas: `assert.ok(urlsPedidas.every(u => /T23:59:59-03:00/.test(u)), ...)` já cobre; mantenha.

- [ ] **Step 2: Run test to verify it fails** — `node scripts/test-stats-paginas.js` → falha em `visitantes`.

- [ ] **Step 3: Implementation**

Em `api/stats.js`:
1. Requires: `const { TABELAS, lerTudo } = require('../lib/supabase');` e `const { inicioDoDia, fimDoDia } = require('../lib/fuso');`. Apague `const FUSO = '-03:00';` e o comentário acima dele (a explicação mora em `lib/fuso.js`).
2. `buildFilter` passa a aceitar a coluna de data e a ordenar:

```js
  function buildFilter(table, select, colunaData = 'created_at') {
    let url = `${supabaseUrl}/rest/v1/${table}?select=${select}&order=${colunaData}.asc`;
    if (from) url += `&${colunaData}=gte.${inicioDoDia(from)}`;
    if (to)   url += `&${colunaData}=lte.${fimDoDia(to)}`;
    return url;
  }
```

3. Leitura: troque o `Promise.all` por

```js
    const [viewsData, leadsData, eventosData] = await Promise.all([
      lerTudo(buildFilter(TABELAS.pageViews, 'pagina')),
      lerTudo(buildFilter(TABELAS.leads,     'pagina,colaboradores')),
      // Visitante distinto: o beacon grava uma linha por carregamento, e recarga
      // dividia a conversão. Falha aqui não derruba o A/B — vira lista vazia.
      lerTudo(`${buildFilter(TABELAS.eventosPagina, 'pagina,visitante', 'criado_em')}&evento=eq.pageview`)
        .catch(e => { console.warn('[stats] visitantes indisponíveis:', e.message); return []; }),
    ]);
    const visitantesPor = {};
    for (const e of eventosData) {
      if (!e.pagina || !e.visitante) continue;
      (visitantesPor[e.pagina] || (visitantesPor[e.pagina] = new Set())).add(e.visitante);
    }
```

Apague a função `fetchAll` e o `headers` local (o `lerTudo` monta os cabeçalhos). Em `paginas`, inclua as chaves de `visitantesPor` na união de páginas e acrescente ao objeto:

```js
          visitantes:            visitantesPor[pagina] ? visitantesPor[pagina].size : 0,
          conversao_visitantes:  visitantesPor[pagina] && visitantesPor[pagina].size > 0
            ? parseFloat(((l / visitantesPor[pagina].size) * 100).toFixed(2)) : null,
```

- [ ] **Step 4: Run tests** — `node scripts/test-stats-paginas.js && node scripts/test-sessao-estrategica.js && npx eslint api/stats.js` → verdes.
- [ ] **Step 5: Commit** — `git add api/stats.js scripts/test-stats-paginas.js && git commit -m "fix(stats): fuso único, leitura paginada do Supabase e visitantes distintos por página"`

---

### Task 10: `scripts/conferir-dados.js` — a conferência entre fontes

**Files:**
- Create: `scripts/conferir-dados.js`

**Interfaces:**
- Consumes: `GET /api/meta`, `/api/leads-unificados`, `/api/stats`, `/api/rd-stats` (formatos de T5, T6, T7, T9).
- Uso: `node scripts/conferir-dados.js --since 2026-09-01 --until 2026-09-13 [--base https://sevilha-perfomance.vercel.app]`. Sai com 1 se alguma invariante falhar.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
'use strict';

/**
 * Confere se os números do painel batem entre si e entre as fontes.
 *
 *   node scripts/conferir-dados.js --since 2026-09-01 --until 2026-09-13
 *   node scripts/conferir-dados.js --base http://localhost:3000   (vercel dev)
 *
 * Imprime, por dia e por campanha, o que o Meta reporta (onsite e pixel), o
 * lead real, o MQL e a divergência; depois checa invariantes que, quebradas,
 * significam bug e não "dado ruim". Sai com código 1 nesse caso.
 */

const args = process.argv.slice(2);
const arg = (nome, padrao) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args[i + 1] : padrao; };
const BASE  = arg('base', 'https://sevilha-perfomance.vercel.app');
const hoje  = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const UNTIL = arg('until', hoje);
const SINCE = arg('since', new Date(new Date(`${UNTIL}T00:00:00Z`) - 13 * 864e5).toISOString().slice(0, 10));

const chave = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const num = (v, casas = 0) => (v === null || v === undefined) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const pad = (v, n) => String(v).padStart(n);
const linha = cols => console.log(cols.map(([v, n]) => pad(v, n)).join('  '));

async function get(p) {
  const r = await fetch(`${BASE}${p}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p} → HTTP ${r.status} ${j.error || ''}`);
  return j;
}

const falhas = [];
const invariante = (cond, msg) => { console.log(`${cond ? '  ok  ' : ' FALHA'} ${msg}`); if (!cond) falhas.push(msg); };

(async () => {
  const qs = `since=${SINCE}&until=${UNTIL}`;
  console.log(`\nConferência ${SINCE} → ${UNTIL} em ${BASE}\n`);
  const [meta, leads, stats, rd] = await Promise.all([
    get(`/api/meta?${qs}`), get(`/api/leads-unificados?${qs}`), get(`/api/stats?${qs}`),
    get(`/api/rd-stats?from=${SINCE}&to=${UNTIL}`),
  ]);

  console.log('— por dia —');
  linha([['dia', 10], ['gasto', 10], ['meta', 6], ['onsite', 6], ['pixel', 6], ['real', 6], ['mql', 5], ['diverg.', 8]]);
  const realPorDia = new Map(leads.por_dia.map(d => [d.dia, d]));
  let onsite = 0, pixel = 0;
  for (const d of meta.serie) {
    const r = realPorDia.get(d.data) || { leads: 0, mql: 0 };
    linha([[d.data, 10], [num(d.spend, 2), 10], [num(d.leads), 6], ['', 6], ['', 6], [num(r.leads), 6], [num(r.mql), 5], [num(d.leads - r.leads), 8]]);
  }
  for (const c of meta.campanhas) { onsite += c.leads_onsite; pixel += c.leads_pixel; }
  console.log(`\nconta: gasto ${num(meta.conta.spend, 2)} · Meta reporta ${num(meta.conta.leads)} (onsite ${num(onsite)}, pixel ${num(pixel)}) · real ${num(leads.total.leads)} · MQL ${num(leads.total.mql)}\n`);

  console.log('— por campanha —');
  linha([['campanha', 52], ['gasto', 10], ['meta', 6], ['real', 6], ['mql', 5], ['cpl', 8], ['cpmql', 8], ['deals', 6]]);
  const realPorCamp = new Map(leads.por_campanha.map(c => [chave(c.campanha), c]));
  const dealsPorCamp = new Map((rd.por_campanha || []).map(c => [chave(c.campanha), c.deals]));
  const vistas = new Set();
  for (const c of meta.campanhas) {
    const k = chave(c.nome); vistas.add(k);
    const r = realPorCamp.get(k) || { leads: 0, mql: 0 };
    linha([[c.nome.slice(0, 52), 52], [num(c.spend, 2), 10], [num(c.leads), 6], [num(r.leads), 6], [num(r.mql), 5],
      [r.leads ? num(c.spend / r.leads, 2) : '—', 8], [r.mql ? num(c.spend / r.mql, 2) : '—', 8], [num(dealsPorCamp.get(k) || 0), 6]]);
  }
  for (const c of leads.por_campanha) {
    if (vistas.has(chave(c.campanha))) continue;
    linha([[`(sem gasto no Meta) ${c.campanha}`.slice(0, 52), 52], ['—', 10], ['—', 6], [num(c.leads), 6], [num(c.mql), 5], ['—', 8], ['—', 8], [num(dealsPorCamp.get(chave(c.campanha)) || 0), 6]]);
  }

  console.log('\n— fontes —');
  for (const f of leads.fontes) console.log(`  ${f.nome.padEnd(9)} ${f.modo || '-'}  período=${f.total_no_periodo}  último=${f.ultimo_lead || '—'}  sem lead há ${f.dias_sem_lead ?? '—'} dias${f.erro ? `  ERRO: ${f.erro}` : ''}`);

  console.log('\n— invariantes —');
  const soma = (xs, k) => xs.reduce((s, x) => s + (x[k] || 0), 0);
  invariante(soma(leads.por_dia, 'leads') === leads.total.leads, 'soma de por_dia = total (leads)');
  invariante(soma(leads.por_dia, 'mql') === leads.total.mql, 'soma de por_dia = total (mql)');
  invariante(soma(Object.values(leads.por_grupo), 'leads') === leads.total.leads, 'soma de por_grupo = total');
  invariante(soma(leads.por_campanha, 'leads') === leads.total.leads, 'soma de por_campanha = total');
  invariante(Math.abs(soma(meta.campanhas, 'spend') - meta.conta.spend) < 0.05, 'soma das campanhas do Meta = conta');
  invariante(leads.por_dia.every(d => d.dia >= SINCE && d.dia <= UNTIL), 'nenhum dia fora do período');
  invariante(meta.serie.length === leads.por_dia.length, 'Meta e leads têm o mesmo número de dias');
  invariante(leads.fontes.every(f => !f.erro), 'nenhuma fonte com erro');
  invariante(rd.acumulado === false, 'RD respondeu o período, não o acumulado');
  invariante(Array.isArray(stats.paginas), 'stats devolveu páginas');

  console.log(falhas.length ? `\n${falhas.length} invariante(s) quebrada(s)` : '\ntudo consistente');
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
```

- [ ] **Step 2: Rodar contra a produção ATUAL (linha de base, antes do deploy)**

Run: `node scripts/conferir-dados.js --since 2026-08-31 --until 2026-09-13`
Expected: `/api/leads-unificados → HTTP 404` (ainda não deployado). Guarde a saída. Rode de novo depois do deploy de T5-T9 (Task 16): aí o esperado é `tudo consistente`.

- [ ] **Step 3: Lint e commit** — `npx eslint scripts/conferir-dados.js && git add scripts/conferir-dados.js && git commit -m "feat(scripts): conferência de dados entre Meta, leads unificados, stats e RD"`

---

### Task 11: Front puro — `assets/js/dash/formato.js` e `cruzamento.js` (testáveis em Node)

**Files:**
- Create: `assets/js/dash/formato.js`, `assets/js/dash/cruzamento.js`
- Test: `scripts/test-dash-cruzamento.js`

**Interfaces:**
- Convenção de todos os módulos do front: `(function (D) { … })(window.SPD = window.SPD || {});` — namespace único `window.SPD`, sem `import`/`export`, sem bundler. Ordem de carga no HTML = ordem de dependência.
- `formato.js` produz: `fmtR`, `fmtN`, `fmtP`, `orDash(v, fn)`, `esc`, `razao(num, den) → number|null`, `pct(num, den) → number|null`, `fmtDia('2026-09-13') → '13/09/2026'`, `diaCurto → '13/09'`, `nomeChave(s)`, `delta(atual, anterior) → %|null`.
- `cruzamento.js` produz: `cruzar(leadsRows, metaRows, campoLead, { rd, filtroGrupo }) → [{ nome, grupo, campanha, spend, leads, mql, meta_reporta, deals, mql_pct, cpl, cpmql, lead_deal }]`, `totalizar(rows) → linha 'Total'`, `resumo({ meta, leads, rd }) → { spend, leads, mql, mql_pct, cpl, cpmql, deals }`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/test-dash-cruzamento.js
'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Os módulos do painel são scripts de navegador: aqui rodam num contexto com `window` falso.
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const m of ['formato', 'cruzamento']) {
  vm.runInContext(readFileSync(path.join(__dirname, `../assets/js/dash/${m}.js`), 'utf8'), ctx, { filename: m });
}
const D = ctx.window.SPD;

assert.equal(D.nomeChave('  [SE]  Café  '), '[se] cafe');
assert.equal(D.razao(10, 0), null); assert.equal(D.pct(1, 4), 25);
assert.equal(D.delta(120, 100), 20); assert.equal(D.delta(5, 0), null);
assert.equal(D.esc('<b>'), '&lt;b&gt;');
assert.equal(D.orDash(null, D.fmtN), '—');

const meta = [
  { nome: '[SE] X', spend: 100, leads: 10, grupo: 'SE' },
  { nome: '[CAFÉ] Y', spend: 50, leads: 8, grupo: 'CAFE' },
];
const leads = [
  { campanha: '[se] x', leads: 5, mql: 2, grupo: 'SE' },
  { campanha: 'Sem etiqueta', leads: 3, mql: 1, grupo: 'CAFE' },
];
const rd = [{ campanha: '[SE] X', deals: 2 }];
const rows = D.cruzar(leads, meta, 'campanha', { rd });
assert.equal(rows.length, 3);
const x = rows.find(r => r.nome === '[SE] X');
assert.deepEqual([x.spend, x.leads, x.mql, x.meta_reporta, x.deals], [100, 5, 2, 10, 2]);
assert.equal(x.cpl, 20); assert.equal(x.cpmql, 50); assert.equal(x.mql_pct, 40); assert.equal(x.lead_deal, 40);
const semEtq = rows.find(r => r.nome === 'Sem etiqueta');
assert.equal(semEtq.spend, 0); assert.equal(semEtq.cpl, null); assert.equal(semEtq.grupo, 'CAFE');
assert.equal(rows[0].nome, '[SE] X', 'ordenado por gasto');
assert.equal(D.cruzar(leads, meta, 'campanha', { filtroGrupo: 'CAFE' }).length, 2);
const t = D.totalizar(rows);
assert.deepEqual([t.nome, t.spend, t.leads, t.mql, t.meta_reporta], ['Total', 150, 8, 3, 18]);

const r = D.resumo({
  meta: { conta: { spend: 150 } },
  leads: { total: { leads: 8, mql: 3 } },
  rd: { por_campanha: [{ campanha: 'Sem campanha', deals: 50 }, { campanha: '[SE] X', deals: 2 }] },
});
assert.deepEqual(r, { spend: 150, leads: 8, mql: 3, mql_pct: 37.5, cpl: 18.75, cpmql: 50, deals: 2 });
assert.equal(D.resumo({ meta: null, leads: null, rd: null }).cpl, null);
console.log('✓ dash cruzamento');
```

- [ ] **Step 2: Run test to verify it fails** — `node scripts/test-dash-cruzamento.js` → `ENOENT … formato.js`

- [ ] **Step 3: Write `assets/js/dash/formato.js`**

```js
'use strict';
/* Formatação e utilidades puras do painel. Sem DOM: roda também em Node (scripts/test-dash-cruzamento.js). */
(function (D) {
  D.fmtR = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  D.fmtN = v => Math.round(Number(v) || 0).toLocaleString('pt-BR');
  D.fmtP = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  // Divisão por zero e dado ausente são "—", nunca "0%": zero e não-sei são respostas diferentes.
  D.orDash = (v, fn) => (v === null || v === undefined || Number.isNaN(v)) ? '—' : fn(v);
  D.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  D.razao = (num, den) => (den > 0 ? num / den : null);
  D.pct = (num, den) => (den > 0 ? (num / den) * 100 : null);
  D.fmtDia = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
  D.diaCurto = s => { const [, m, d] = String(s).split('-'); return `${d}/${m}`; };
  /** Nome comparável entre fontes: minúsculo, sem acento, espaços colapsados. */
  D.nomeChave = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  /** Variação percentual contra o período anterior; null sem base. */
  D.delta = (atual, anterior) => (anterior > 0 && atual !== null && atual !== undefined ? ((atual - anterior) / anterior) * 100 : null);
})(window.SPD = window.SPD || {});
```

- [ ] **Step 4: Write `assets/js/dash/cruzamento.js`**

```js
'use strict';
/* Junção lead real × gasto do Meta × deals do RD por nome normalizado. Puro, sem DOM. */
(function (D) {
  const nova = nome => ({ nome, grupo: null, campanha: null, spend: 0, leads: 0, mql: 0, meta_reporta: 0, deals: 0 });
  const derivar = l => ({
    ...l,
    mql_pct: D.pct(l.mql, l.leads),
    cpl: D.razao(l.spend, l.leads),
    cpmql: D.razao(l.spend, l.mql),
    lead_deal: D.pct(l.deals, l.leads),
  });

  /**
   * leadsRows: itens de por_campanha/por_conjunto/por_anuncio/por_fonte (campo em `campoLead`).
   * metaRows: itens de meta.campanhas/conjuntos/anuncios/posicionamentos (campo `nome`).
   * rd: itens de rd.por_campanha (só faz sentido quando a dimensão é campanha).
   */
  D.cruzar = function (leadsRows, metaRows, campoLead, { rd = [], filtroGrupo = null } = {}) {
    const mapa = new Map();
    const linha = nome => { const k = D.nomeChave(nome); if (!mapa.has(k)) mapa.set(k, nova(nome)); return mapa.get(k); };
    for (const m of metaRows || []) {
      const l = linha(m.nome);
      l.spend += m.spend || 0; l.meta_reporta += m.leads || 0;
      l.grupo = l.grupo || m.grupo || null; l.campanha = l.campanha || m.campanha || null;
    }
    for (const r of leadsRows || []) {
      const l = linha(r[campoLead]);
      l.leads += r.leads || 0; l.mql += r.mql || 0;
      l.grupo = l.grupo || r.grupo || null; l.campanha = l.campanha || r.campanha || null;
    }
    for (const d of rd || []) { const k = D.nomeChave(d.campanha); if (mapa.has(k)) mapa.get(k).deals += d.deals || 0; }
    let rows = [...mapa.values()].map(derivar);
    if (filtroGrupo) rows = rows.filter(r => r.grupo === filtroGrupo);
    return rows.sort((a, b) => b.spend - a.spend || b.leads - a.leads);
  };

  D.totalizar = rows => derivar(rows.reduce((t, r) => {
    t.spend += r.spend; t.leads += r.leads; t.mql += r.mql; t.meta_reporta += r.meta_reporta; t.deals += r.deals; return t;
  }, nova('Total')));

  /** Números da faixa executiva. Deals: só os que têm campanha (o funil do CRM tem deals de outras origens). */
  D.resumo = function ({ meta, leads, rd }) {
    const spend = meta ? meta.conta.spend : null;
    const L = leads ? leads.total.leads : null;
    const M = leads ? leads.total.mql : null;
    const deals = rd ? (rd.por_campanha || []).filter(c => c.campanha !== 'Sem campanha').reduce((s, c) => s + c.deals, 0) : null;
    return {
      spend, leads: L, mql: M,
      mql_pct: L === null ? null : D.pct(M, L),
      cpl: spend === null || L === null ? null : D.razao(spend, L),
      cpmql: spend === null || M === null ? null : D.razao(spend, M),
      deals,
    };
  };
})(window.SPD = window.SPD || {});
```

- [ ] **Step 5: Run test** — `node scripts/test-dash-cruzamento.js && npx eslint assets/js/dash/` → `✓ dash cruzamento`, lint sem erro.
- [ ] **Step 6: Commit** — `git add assets/js/dash/formato.js assets/js/dash/cruzamento.js scripts/test-dash-cruzamento.js && git commit -m "feat(dash): formatação e cruzamento lead × Meta × RD como módulos puros"`

---

### Task 12: CSS consolidado + `api.js`, `graficos.js`, `tabelas.js`

**Files:**
- Modify: `assets/css/admin-dashboard.css` (recebe o `<style>` inline de `dashboard.html:11-233` e as classes novas abaixo)
- Create: `assets/js/dash/api.js`, `assets/js/dash/graficos.js`, `assets/js/dash/tabelas.js`

**Interfaces:**
- `api.js`: `carregarTudo(since, until) → { meta, leads, rd, stats }` (`meta` obrigatório, demais `null` em falha), `carregarResumo(since, until) → { meta, leads, rd }` (todos opcionais), `periodoAnterior(since, until) → { since, until }`.
- `graficos.js`: `cores()`, `redimensionarGraficos()`, `graficoLeadsDia(canvasId, dias, { mql, outros, spend })`, `graficoCusto(canvasId, rows)`, `graficoMetaVsReal(canvasId, rows)`, `renderFunil(containerId, [{ rotulo, valor }])`.
- `tabelas.js`: `COLUNAS_CRUZAMENTO` (lista padrão de colunas), `faixaCusto(v)`, `tabela(tableId, rows, colunas, { total, vazio })` (gera thead/tbody/tfoot dentro da `<table id>`; cabeçalho clicável ordena), `baixarCsv(tableId, nomeArquivo)`.

- [ ] **Step 1: CSS**

Mova o conteúdo do `<style>` de `dashboard.html` (linhas 11-233) para o INÍCIO de `assets/css/admin-dashboard.css`, e nele apague os dois blocos `:root { … }` e `:root[data-theme="dark"] { … }` recém-movidos (o mapa de tokens que já existe no arquivo os substitui). Apague também a regra `body { font-family:'Inter'… }` (a fonte vem do DS). Acrescente ao FIM do arquivo:

```css
/* ── Faixa executiva, alertas, cruzamento (dashboard 2026-09) ── */
.admin-dashboard .exec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--grid-gap); padding: var(--space-6) var(--gutter-x) 0; }
.admin-dashboard .exec-grid .kpi-card { border-left-color: var(--lm-blue-700); }
.admin-dashboard .kpi-sub.delta-bom { color: var(--status-success-text); }
.admin-dashboard .kpi-sub.delta-ruim { color: var(--status-danger-text); }
.admin-dashboard .kpi-sub.delta-neutro { color: var(--text-muted); }
.admin-dashboard .alertas { display: none; margin: var(--space-6) var(--gutter-x) 0; padding: var(--space-5) var(--space-6); border: 1px solid var(--lm-warning); border-radius: var(--radius-md); background: var(--lm-warning-bg); color: var(--status-warning-text); font-size: var(--type-body-sm-size); }
.admin-dashboard .alertas.show { display: block; }
.admin-dashboard .alertas ul { margin: 0; padding-left: var(--space-7); }
.admin-dashboard .badge { display: inline-block; padding: 2px 8px; border-radius: var(--radius-pill); font-size: var(--type-caption-size); font-weight: var(--fw-semibold); letter-spacing: .02em; background: var(--surface-sunken); color: var(--text-body); }
.admin-dashboard .badge-se { background: var(--lm-teal-100); color: var(--lm-teal-700); }
.admin-dashboard .badge-cafe { background: var(--lm-amber-50); color: var(--status-warning-text); }
.admin-dashboard .badge-cp { background: var(--lm-indigo-100); color: var(--lm-indigo-600); }
.admin-dashboard .custo-bom { color: var(--status-success-text); font-weight: var(--fw-semibold); }
.admin-dashboard .custo-ok { color: var(--status-warning-text); font-weight: var(--fw-semibold); }
.admin-dashboard .custo-ruim { color: var(--status-danger-text); font-weight: var(--fw-semibold); }
.admin-dashboard th[data-col] { cursor: pointer; user-select: none; white-space: nowrap; }
.admin-dashboard th.ord-desc::after { content: ' ▼'; font-size: 9px; }
.admin-dashboard th.ord-asc::after { content: ' ▲'; font-size: 9px; }
.admin-dashboard tfoot td { font-weight: var(--fw-semibold); border-top: 2px solid var(--border-strong); }
.admin-dashboard td.vazio { text-align: center; padding: var(--space-7); color: var(--text-muted); }
.admin-dashboard .chart-falha { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: var(--type-body-sm-size); text-align: center; }
.admin-dashboard .fn-count small { display: block; font-size: var(--type-caption-size); color: var(--text-muted); }
.admin-dashboard .fn-bar-fill { background: var(--chart-series-1); }
.admin-dashboard .funis-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--grid-gap); }
.admin-dashboard .funil-titulo { font-size: var(--type-label-size); font-weight: var(--fw-semibold); text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); margin-bottom: var(--space-4); }
.admin-dashboard .section-tools { display: flex; align-items: center; gap: var(--space-4); margin-left: auto; }
.admin-dashboard .btn-csv, .admin-dashboard .select-grupo { min-height: var(--control-h-sm); padding: 0 var(--space-5); border: 1px solid var(--border-field); border-radius: var(--radius-pill); background: var(--surface-card); color: var(--text-body); font-size: var(--type-body-sm-size); }
.admin-dashboard .nota-fonte { font-size: var(--type-body-sm-size); color: var(--text-muted); margin: 0 0 var(--space-5); }
@media (max-width: 720px) { .admin-dashboard .exec-grid { grid-template-columns: repeat(2, 1fr); } }
```

- [ ] **Step 2: `assets/js/dash/api.js`**

```js
'use strict';
/* Chamadas aos endpoints e cálculo do período anterior. */
(function (D) {
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `${url} → HTTP ${r.status}`);
    return j;
  }
  const opcional = (p, rotulo) => p.catch(e => { console.warn(`${rotulo}:`, e.message); return null; });

  /** O Meta é obrigatório; as outras fontes degradam para null e o painel avisa. */
  D.carregarTudo = async function (since, until) {
    const qs = `since=${since}&until=${until}`;
    const [meta, leads, rd, stats] = await Promise.all([
      getJSON(`/api/meta?${qs}`),
      opcional(getJSON(`/api/leads-unificados?${qs}`), 'leads unificados'),
      opcional(getJSON(`/api/rd-stats?from=${since}&to=${until}`), 'rd'),
      opcional(getJSON(`/api/stats?${qs}`), 'stats'),
    ]);
    return { meta, leads, rd, stats };
  };

  /** Período anterior: tudo opcional — sem base de comparação o card só diz "sem base". */
  D.carregarResumo = async function (since, until) {
    const qs = `since=${since}&until=${until}`;
    const [meta, leads, rd] = await Promise.all([
      opcional(getJSON(`/api/meta?${qs}`), 'meta anterior'),
      opcional(getJSON(`/api/leads-unificados?${qs}`), 'leads anterior'),
      opcional(getJSON(`/api/rd-stats?from=${since}&to=${until}`), 'rd anterior'),
    ]);
    return { meta, leads, rd };
  };

  D.periodoAnterior = function (since, until) {
    const ms = 864e5;
    const a = new Date(`${since}T00:00:00Z`), b = new Date(`${until}T00:00:00Z`);
    const n = Math.round((b - a) / ms) + 1;
    const iso = d => d.toISOString().slice(0, 10);
    return { since: iso(new Date(a - n * ms)), until: iso(new Date(a - ms)) };
  };
})(window.SPD = window.SPD || {});
```

- [ ] **Step 3: `assets/js/dash/graficos.js`**

```js
'use strict';
/* Chart.js 4 (CDN) e funil em HTML. Cores só de tokens do lm-ds.css. */
(function (D) {
  const charts = {};
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  D.cores = () => ({
    s1: cssVar('--chart-series-1'), s2: cssVar('--chart-series-2'), s3: cssVar('--chart-series-3'), s4: cssVar('--chart-series-4'),
    grid: cssVar('--chart-grid'), ink: cssVar('--text-muted'), texto: cssVar('--text-display'), card: cssVar('--surface-card'),
  });
  function destruir(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
  D.redimensionarGraficos = () => Object.values(charts).forEach(c => { try { c.resize(); } catch { /* canvas oculto */ } });
  function indisponivel(el) {
    const w = el.closest('.chart-wrap');
    if (w && !w.dataset.falhou) { w.dataset.falhou = '1'; w.innerHTML = '<p class="chart-falha">Biblioteca de gráficos indisponível. As tabelas seguem válidas.</p>'; }
  }
  function base(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (typeof Chart === 'undefined') { indisponivel(el); return null; }
    destruir(id);
    return el;
  }
  const legenda = c => ({ labels: { color: c.ink, font: { size: 12, weight: '600' }, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded' } });
  const tooltip = c => ({ backgroundColor: c.card, titleColor: c.texto, bodyColor: c.texto, borderColor: c.grid, borderWidth: 1, padding: 10, cornerRadius: 8, usePointStyle: true });
  const eixoX = c => ({ grid: { color: c.grid, drawTicks: false }, border: { display: false }, ticks: { color: c.ink, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 16 } });
  const eixoY = (c, extra = {}) => ({ beginAtZero: true, grid: { color: c.grid, drawTicks: false }, border: { display: false }, ticks: { color: c.ink, font: { size: 11 } }, ...extra });
  const corta = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

  /** Leads por dia: MQL empilhado sobre o restante; gasto em linha no eixo direito. */
  D.graficoLeadsDia = function (id, dias, { mql, outros, spend }) {
    const el = base(id); if (!el) return;
    const c = D.cores();
    charts[id] = new Chart(el.getContext('2d'), {
      data: { labels: dias.map(D.diaCurto), datasets: [
        { type: 'bar', label: 'MQL (10+)', data: mql, backgroundColor: c.s1, stack: 'leads', borderRadius: 3 },
        { type: 'bar', label: 'Demais leads', data: outros, backgroundColor: c.s3, stack: 'leads', borderRadius: 3 },
        { type: 'line', label: 'Investido', data: spend, yAxisID: 'y1', borderColor: c.s2, backgroundColor: 'transparent', borderWidth: 2, tension: .3, pointRadius: 0 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: legenda(c), tooltip: { ...tooltip(c), callbacks: { label: t => ` ${t.dataset.label}: ${t.dataset.yAxisID === 'y1' ? D.fmtR(t.parsed.y) : D.fmtN(t.parsed.y)}` } } },
        scales: { x: eixoX(c), y: eixoY(c, { stacked: true }),
          y1: { position: 'right', beginAtZero: true, grid: { display: false }, border: { display: false }, ticks: { color: c.ink, font: { size: 11 }, callback: v => 'R$ ' + v.toLocaleString('pt-BR') } } } },
    });
  };

  /** Barras horizontais: CPMQL (grossa) e CPL (fina) por linha, só linhas com lead. */
  D.graficoCusto = function (id, rows) {
    const el = base(id); if (!el) return;
    const c = D.cores();
    const top = rows.filter(r => r.leads > 0).slice(0, 12);
    el.parentElement.style.height = Math.max(180, top.length * 34 + 60) + 'px';
    charts[id] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: { labels: top.map(r => corta(r.nome, 40)), datasets: [
        { label: 'CPMQL', data: top.map(r => r.cpmql), backgroundColor: c.s1, barPercentage: .7 },
        { label: 'CPL', data: top.map(r => r.cpl), backgroundColor: c.s3, barPercentage: .35 },
      ] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: legenda(c), tooltip: { ...tooltip(c), callbacks: { label: t => ` ${t.dataset.label}: ${D.orDash(t.parsed.x, D.fmtR)}` } } },
        scales: { x: eixoY(c, { ticks: { color: c.ink, callback: v => 'R$ ' + v } }), y: { grid: { display: false }, ticks: { color: c.ink, font: { size: 11 } } } } },
    });
  };

  /** Barras agrupadas: o que o Meta reporta × leads reais × MQL, por campanha. */
  D.graficoMetaVsReal = function (id, rows) {
    const el = base(id); if (!el) return;
    const c = D.cores();
    const top = rows.filter(r => r.meta_reporta > 0 || r.leads > 0).slice(0, 10);
    charts[id] = new Chart(el.getContext('2d'), {
      type: 'bar',
      data: { labels: top.map(r => corta(r.nome, 28)), datasets: [
        { label: 'Meta reporta', data: top.map(r => r.meta_reporta), backgroundColor: c.s2 },
        { label: 'Leads reais', data: top.map(r => r.leads), backgroundColor: c.s1 },
        { label: 'MQL (10+)', data: top.map(r => r.mql), backgroundColor: c.s4 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: legenda(c), tooltip: tooltip(c) },
        scales: { x: { grid: { display: false }, ticks: { color: c.ink, font: { size: 10 }, maxRotation: 0 } }, y: eixoY(c) } },
    });
  };

  /** Funil em HTML: cada passo mostra o valor e a taxa sobre o passo anterior. */
  D.renderFunil = function (id, passos) {
    const el = document.getElementById(id); if (!el) return;
    const max = Math.max(...passos.map(p => p.valor || 0), 1);
    el.innerHTML = passos.map((p, i) => {
      const ant = i > 0 ? passos[i - 1].valor : null;
      const taxa = ant ? D.pct(p.valor || 0, ant) : null;
      return `<div class="fn-step"><div class="fn-label">${D.esc(p.rotulo)}</div>`
        + `<div class="fn-bar-wrap"><div class="fn-bar-fill" style="width:${Math.max(((p.valor || 0) / max) * 100, 2)}%"></div></div>`
        + `<div class="fn-count">${p.valor === null || p.valor === undefined ? '—' : D.fmtN(p.valor)}${taxa !== null ? `<small>${D.fmtP(taxa)}</small>` : ''}</div></div>`;
    }).join('');
  };
})(window.SPD = window.SPD || {});
```

- [ ] **Step 4: `assets/js/dash/tabelas.js`**

```js
'use strict';
/* Tabela ordenável a partir de linhas cruzadas (D.cruzar) e exportação CSV. */
(function (D) {
  // Faixas de CPMQL: abaixo de R$ 150 está no patamar histórico do FORMS; acima de R$ 250 pede ação.
  D.faixaCusto = v => (v === null ? '' : v <= 150 ? 'custo-bom' : v <= 250 ? 'custo-ok' : 'custo-ruim');
  const NOMES_GRUPO = { SE: 'Sessão Estratégica', CAFE: 'Café com Sevilha', CP: 'Clube', OUTROS: 'Outros' };
  D.badgeGrupo = g => (g ? `<span class="badge badge-${g.toLowerCase()}">${NOMES_GRUPO[g] || g}</span>` : '');

  const COLS = {
    nome:         { titulo: 'Nome',         fmt: r => `<span title="${D.esc(r.nome)}">${D.esc(r.nome)}</span>` },
    grupo:        { titulo: 'Grupo',        fmt: r => D.badgeGrupo(r.grupo) },
    campanha:     { titulo: 'Campanha',     fmt: r => D.esc(r.campanha || '') },
    spend:        { titulo: 'Gasto',        fmt: r => D.fmtR(r.spend), num: true },
    leads:        { titulo: 'Leads',        fmt: r => D.fmtN(r.leads), num: true },
    mql:          { titulo: 'MQL (10+)',    fmt: r => D.fmtN(r.mql), num: true },
    mql_pct:      { titulo: '% MQL',        fmt: r => D.orDash(r.mql_pct, D.fmtP), num: true },
    cpl:          { titulo: 'CPL',          fmt: r => D.orDash(r.cpl, D.fmtR), num: true },
    cpmql:        { titulo: 'CPMQL',        fmt: r => (r.cpmql === null ? '—' : `<span class="${D.faixaCusto(r.cpmql)}">${D.fmtR(r.cpmql)}</span>`), num: true },
    meta_reporta: { titulo: 'Meta reporta', fmt: r => D.fmtN(r.meta_reporta), num: true },
    deals:        { titulo: 'Deals',        fmt: r => D.fmtN(r.deals), num: true },
    lead_deal:    { titulo: 'Lead → Deal',  fmt: r => D.orDash(r.lead_deal, D.fmtP), num: true },
  };
  D.COLUNAS_CRUZAMENTO = ['nome', 'spend', 'leads', 'mql', 'mql_pct', 'cpl', 'cpmql', 'meta_reporta'];

  function ordenar(rows, col, desc) {
    return [...rows].sort((a, b) => {
      const x = a[col], y = b[col];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x > y ? 1 : -1) * (desc ? -1 : 1);
    });
  }

  /** Gera thead/tbody/tfoot dentro de <table id>. Clique no cabeçalho reordena; estado fica no elemento. */
  D.tabela = function (tableId, rows, colunas, { total = true, vazio = 'Sem dados no período' } = {}) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const ord = table._ord || (table._ord = { col: colunas.includes('spend') ? 'spend' : colunas[1], desc: true });
    table._rows = rows; table._cols = colunas;
    const tr = r => `<tr>${colunas.map(c => `<td class="${COLS[c].num ? 'num' : ''}">${COLS[c].fmt(r)}</td>`).join('')}</tr>`;
    const th = colunas.map(c => `<th class="${COLS[c].num ? 'num' : ''} ${ord.col === c ? (ord.desc ? 'ord-desc' : 'ord-asc') : ''}" data-col="${c}">${COLS[c].titulo}</th>`).join('');
    const ordenadas = ordenar(rows, ord.col, ord.desc);
    const corpo = ordenadas.length ? ordenadas.map(tr).join('') : `<tr><td colspan="${colunas.length}" class="vazio">${D.esc(vazio)}</td></tr>`;
    const rodape = total && ordenadas.length ? `<tfoot>${tr(D.totalizar(rows))}</tfoot>` : '';
    table.innerHTML = `<thead><tr>${th}</tr></thead><tbody>${corpo}</tbody>${rodape}`;
    table.querySelectorAll('th[data-col]').forEach(h => h.addEventListener('click', () => {
      const col = h.dataset.col;
      if (ord.col === col) ord.desc = !ord.desc; else { ord.col = col; ord.desc = true; }
      D.tabela(tableId, table._rows, table._cols, { total, vazio });
    }));
  };

  /** CSV com ; e BOM: o Excel em português abre direto, com decimal em vírgula. */
  D.csvDe = function (rows, colunas) {
    const cel = v => (v === null || v === undefined ? '' : typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v));
    const linhas = rows.map(r => colunas.map(c => `"${cel(r[c]).replace(/"/g, '""')}"`).join(';'));
    return '﻿' + [colunas.map(c => COLS[c].titulo).join(';'), ...linhas].join('\r\n');
  };
  D.baixarCsv = function (tableId, nomeArquivo) {
    const t = document.getElementById(tableId);
    if (!t || !t._rows) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([D.csvDe(t._rows, t._cols)], { type: 'text/csv;charset=utf-8' }));
    a.download = nomeArquivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
})(window.SPD = window.SPD || {});
```

- [ ] **Step 5: Lint** — `npx eslint assets/js/dash/` → sem erro. (A checagem visual acontece em T13, quando o HTML passa a carregar estes módulos.)
- [ ] **Step 6: Commit** — `git add assets/css/admin-dashboard.css assets/js/dash/api.js assets/js/dash/graficos.js assets/js/dash/tabelas.js && git commit -m "feat(dash): CSS consolidado, chamadas de API, gráficos e tabelas ordenáveis com CSV"`

---

### Task 13: `dashboard.html` novo + `main.js`, `executivo.js`, `geral.js`

**Files:**
- Rewrite: `dashboard.html`
- Create: `assets/js/dash/main.js`, `assets/js/dash/executivo.js`, `assets/js/dash/geral.js`

**Interfaces:**
- Consumes: T11 (`D.fmt*`, `D.cruzar`, `D.resumo`, `D.delta`), T12 (`D.carregarTudo`, `D.carregarResumo`, `D.periodoAnterior`, `D.grafico*`, `D.renderFunil`, `D.tabela`, `D.baixarCsv`).
- Produces: `D.abrirAba(nome)`, `D.banner(id, html)`, `D.setK(id, texto)`, `D.linhasCampanha(dados, grupo|null)`, `D.renderExecutivo(dados, anterior)`, `D.renderAlertas(dados)`, `D.renderGeral(dados)`. `main.js` chama, em `render()`, também `D.renderFormatos`, `D.renderGrupo`, `D.renderOrigem`, `D.renderAb` — definidas em T14/T15; até lá `main.js` as protege com `if (typeof D.x === 'function')`.
- IDs do DOM que os módulos usam: faixa `ex-spend, ex-leads, ex-mql, ex-mql-pct, ex-cpl, ex-cpmql, ex-deals` (+ sufixo `-sub`); `alertas`, `errorBanner`; aba Geral `g-spend, g-spend-capt, g-ctr, g-cpm, chartLeadsDia, chartCustoCampanha, funilSE, funilCAFE, funilCP, tblCampanhas, tblPaginas`.

- [ ] **Step 1: Escrever `dashboard.html`**

Recupere o menu lateral atual (é o mesmo do raio-x) com `git show HEAD:dashboard.html | sed -n '240,250p'` e use-o como `<aside>`; dentro dele, substitua o bloco `<div class="tab-nav lm-menu-group">…</div>` e o `<p class="lm-menu-label">Relatórios</p><a href="/relatorio" …>…</a>` pelo grupo abaixo (mantenha o link do raio-x). Os `<svg>` são os mesmos ícones já usados no arquivo (grade, barras, pessoas, lupa); copie-os de lá.

```html
<div class="tab-nav lm-menu-group">
  <button class="tab-btn active lm-menu-item" data-tab="geral" aria-current="page"><!-- svg grade --><span><strong>Visão geral</strong><small>Resultados da operação</small></span></button>
  <button class="tab-btn lm-menu-item" data-tab="formatos"><!-- svg barras --><span><strong>Formatos de campanha</strong><small>Formulário × landing page</small></span></button>
  <button class="tab-btn lm-menu-item" data-tab="se"><!-- svg pessoas --><span><strong>Sessão Estratégica</strong><small>[SE]</small></span></button>
  <button class="tab-btn lm-menu-item" data-tab="cafe"><!-- svg pessoas --><span><strong>Café com Sevilha</strong><small>[CAFÉ]</small></span></button>
  <button class="tab-btn lm-menu-item" data-tab="cp"><!-- svg pessoas --><span><strong>Clube da Performance</strong><small>[CP]</small></span></button>
  <button class="tab-btn lm-menu-item" data-tab="origem"><!-- svg barras --><span><strong>Origem</strong><small>Campanha, público, anúncio, fonte</small></span></button>
  <button class="tab-btn lm-menu-item" data-tab="ab"><!-- svg barras --><span><strong>Comparativo A/B</strong><small>Páginas de captura</small></span></button>
</div>
```

O arquivo completo (fora o `<aside>`):

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard — Sevilha Performance</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<link rel="stylesheet" href="/assets/css/admin-dashboard.css?v=dash-1">
<link rel="stylesheet" href="/assets/css/admin-sidebar.css">
<link rel="stylesheet" href="/assets/css/lm-ds.css?v=lm-ds-2">
<script src="/assets/admin-sidebar.js" defer></script>
</head>
<body class="admin-dashboard admin-side-layout">
<!-- ASIDE: ver instrução acima -->

<div class="header" role="banner">
  <div class="header-top">
    <div class="header-logo">
      <div class="brand-mark" aria-hidden="true">SP</div>
      <div class="header-text">
        <h1>Dashboard — Sevilha Performance</h1>
        <div class="sub">Meta Ads (investimento) · Leads reais unificados (planilha, site e Café) · RD CRM</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn-hdr" id="btnTheme" type="button" aria-label="Alternar tema claro e escuro">🌙</button>
      <button class="btn-hdr" id="btnRefresh" type="button">⟳ Atualizar</button>
    </div>
  </div>
  <div class="header-meta">
    <div class="header-badge"><div class="status-dot loading" id="statusDot"></div><span id="statusText">Carregando...</span></div>
    <div class="header-badge" id="lastUpdate">—</div>
    <div class="header-badge" id="periodBadge">📅 Últimos 30 dias</div>
  </div>
</div>

<div class="filter-bar" role="region" aria-label="Filtros de período">
  <span class="filter-label">Período:</span>
  <button class="preset-btn" type="button" data-preset="today">Hoje</button>
  <button class="preset-btn" type="button" data-preset="last_7d">7 dias</button>
  <button class="preset-btn" type="button" data-preset="last_14d">14 dias</button>
  <button class="preset-btn active" type="button" data-preset="last_30d">30 dias</button>
  <button class="preset-btn" type="button" data-preset="last_90d">90 dias</button>
  <button class="preset-btn" type="button" data-preset="this_month">Este mês</button>
  <button class="preset-btn" type="button" data-preset="last_month">Mês anterior</button>
  <div class="filter-sep"></div>
  <button class="preset-btn" type="button" data-preset="custom">Personalizado</button>
  <div class="custom-dates" id="customDates">
    <label for="dateSince">De</label><input type="date" class="date-input" id="dateSince">
    <label for="dateUntil">até</label><input type="date" class="date-input" id="dateUntil">
    <button class="btn-apply" type="button" id="btnApply">Aplicar</button>
  </div>
</div>

<div class="banner banner-error" id="errorBanner"></div>

<section class="exec-grid" aria-label="Resumo executivo">
  <div class="kpi-card"><div class="kpi-label">Investido</div><div class="kpi-value skeleton kpi-skel" id="ex-spend"></div><div class="kpi-sub" id="ex-spend-sub"></div></div>
  <div class="kpi-card"><div class="kpi-label">Leads</div><div class="kpi-value skeleton kpi-skel" id="ex-leads"></div><div class="kpi-sub" id="ex-leads-sub"></div></div>
  <div class="kpi-card"><div class="kpi-label">MQL (10+)</div><div class="kpi-value skeleton kpi-skel" id="ex-mql"></div><div class="kpi-sub" id="ex-mql-sub"></div></div>
  <div class="kpi-card"><div class="kpi-label">% MQL</div><div class="kpi-value skeleton kpi-skel" id="ex-mql-pct"></div><div class="kpi-sub" id="ex-mql-pct-sub"></div></div>
  <div class="kpi-card"><div class="kpi-label">CPL</div><div class="kpi-value skeleton kpi-skel" id="ex-cpl"></div><div class="kpi-sub" id="ex-cpl-sub"></div></div>
  <div class="kpi-card"><div class="kpi-label">CPMQL</div><div class="kpi-value skeleton kpi-skel" id="ex-cpmql"></div><div class="kpi-sub" id="ex-cpmql-sub"></div></div>
  <div class="kpi-card"><div class="kpi-label">Deals (com campanha)</div><div class="kpi-value skeleton kpi-skel" id="ex-deals"></div><div class="kpi-sub" id="ex-deals-sub"></div></div>
</section>
<div class="alertas" id="alertas" role="status"></div>

<main>
<div class="tab-panel active" id="tab-geral"><div class="container">
  <div class="kpi-groups"><div class="kpi-group">
    <div class="kpi-group-label">Meta Ads — investimento e entrega</div>
    <div class="kpi-card blue"><div class="kpi-label">Investido total</div><div class="kpi-value skeleton kpi-skel" id="g-spend"></div></div>
    <div class="kpi-card blue"><div class="kpi-label">Investido em captação</div><div class="kpi-value skeleton kpi-skel" id="g-spend-capt"></div><div class="kpi-sub">[SE] + [CAFÉ] + [CP]</div></div>
    <div class="kpi-card"><div class="kpi-label">CTR</div><div class="kpi-value skeleton kpi-skel" id="g-ctr"></div></div>
    <div class="kpi-card orange"><div class="kpi-label">CPM</div><div class="kpi-value skeleton kpi-skel" id="g-cpm"></div></div>
  </div></div>
  <div class="section">
    <div class="section-title">📈 Leads reais por dia — MQL (10+) sobre os demais, com investimento</div>
    <div class="chart-wrap" style="height:300px"><canvas id="chartLeadsDia"></canvas></div>
  </div>
  <div class="section">
    <div class="section-title">💸 Custo por MQL e por lead, por campanha</div>
    <p class="nota-fonte">Gasto do Meta dividido pelos leads reais da mesma campanha. Só campanhas com lead no período.</p>
    <div class="chart-wrap" style="height:320px"><canvas id="chartCustoCampanha"></canvas></div>
  </div>
  <div class="section">
    <div class="section-title">🔻 Funil por grupo — visitantes → leads → MQL → deals</div>
    <div class="funis-grid">
      <div><div class="funil-titulo">Sessão Estratégica</div><div class="funnel" id="funilSE"></div></div>
      <div><div class="funil-titulo">Café com Sevilha</div><div class="funnel" id="funilCAFE"></div></div>
      <div><div class="funil-titulo">Clube da Performance</div><div class="funnel" id="funilCP"></div></div>
    </div>
    <p class="nota-fonte">Visitantes só para as páginas deste site (/mentoria). Deals: RD CRM com utm_campaign gravada.</p>
  </div>
  <div class="section">
    <div class="section-title">🎯 Campanhas no período <div class="section-tools"><button class="btn-csv" type="button" data-csv="tblCampanhas">Exportar CSV</button></div></div>
    <div class="table-wrap"><table id="tblCampanhas"></table></div>
  </div>
  <div class="section">
    <div class="section-title">🧭 Páginas de captura deste site</div>
    <div class="table-wrap"><table><thead><tr><th>Página</th><th class="num">Visitantes</th><th class="num">Leads</th><th class="num">MQL (10+)</th><th class="num">% MQL</th><th class="num">Conversão</th></tr></thead><tbody id="tblPaginas"></tbody></table></div>
    <p class="nota-fonte">Conversão = leads ÷ visitantes distintos (evento pageview). Sem visitante medido, "—".</p>
  </div>
</div></div>

<div class="tab-panel" id="tab-formatos"><div class="container" id="painelFormatos"></div></div>
<div class="tab-panel" id="tab-se"><div class="container" id="painelSE"></div></div>
<div class="tab-panel" id="tab-cafe"><div class="container" id="painelCAFE"></div></div>
<div class="tab-panel" id="tab-cp"><div class="container" id="painelCP"></div></div>
<div class="tab-panel" id="tab-origem"><div class="container" id="painelOrigem"></div></div>
<div class="tab-panel" id="tab-ab"><div class="container" id="painelAb"></div></div>
</main>

<script src="/assets/js/dash/formato.js?v=dash-1"></script>
<script src="/assets/js/dash/cruzamento.js?v=dash-1"></script>
<script src="/assets/js/dash/api.js?v=dash-1"></script>
<script src="/assets/js/dash/graficos.js?v=dash-1"></script>
<script src="/assets/js/dash/tabelas.js?v=dash-1"></script>
<script src="/assets/js/dash/executivo.js?v=dash-1"></script>
<script src="/assets/js/dash/geral.js?v=dash-1"></script>
<script src="/assets/js/dash/formatos.js?v=dash-1"></script>
<script src="/assets/js/dash/grupo.js?v=dash-1"></script>
<script src="/assets/js/dash/origem.js?v=dash-1"></script>
<script src="/assets/js/dash/ab.js?v=dash-1"></script>
<script src="/assets/js/dash/main.js?v=dash-1"></script>
</body>
</html>
```

Os painéis `painelFormatos`, `painelSE/CAFE/CP`, `painelOrigem`, `painelAb` são preenchidos pelos módulos de T14/T15 (eles montam o próprio markup na primeira renderização). Até T14/T15 existirem, as tags `<script>` deles dão 404 no console — esperado nesta task, some na seguinte.

- [ ] **Step 2: `assets/js/dash/executivo.js`**

```js
'use strict';
/* Faixa executiva (com delta contra o período anterior) e alertas. */
(function (D) {
  D.setK = (id, texto) => { const el = document.getElementById(id); if (el) { el.classList.remove('skeleton', 'kpi-skel'); el.textContent = texto; } };

  // `invertido`: cair é bom (custo). `neutro`: gasto não é bom nem ruim por si.
  const CARTOES = [
    { id: 'ex-spend',   chave: 'spend',   fmt: D.fmtR, neutro: true },
    { id: 'ex-leads',   chave: 'leads',   fmt: D.fmtN },
    { id: 'ex-mql',     chave: 'mql',     fmt: D.fmtN },
    { id: 'ex-mql-pct', chave: 'mql_pct', fmt: D.fmtP },
    { id: 'ex-cpl',     chave: 'cpl',     fmt: D.fmtR, invertido: true },
    { id: 'ex-cpmql',   chave: 'cpmql',   fmt: D.fmtR, invertido: true },
    { id: 'ex-deals',   chave: 'deals',   fmt: D.fmtN },
  ];

  D.renderExecutivo = function (dados, anterior) {
    const atual = D.resumo(dados);
    const ant = anterior ? D.resumo(anterior) : {};
    for (const c of CARTOES) {
      D.setK(c.id, D.orDash(atual[c.chave], c.fmt));
      const sub = document.getElementById(c.id + '-sub');
      if (!sub) continue;
      const dl = D.delta(atual[c.chave], ant[c.chave]);
      if (dl === null) { sub.className = 'kpi-sub'; sub.textContent = 'sem base no período anterior'; continue; }
      const bom = c.invertido ? dl <= 0 : dl >= 0;
      sub.className = 'kpi-sub ' + (c.neutro ? 'delta-neutro' : bom ? 'delta-bom' : 'delta-ruim');
      sub.textContent = `${dl >= 0 ? '▲' : '▼'} ${D.fmtP(Math.abs(dl))} vs. anterior (${D.orDash(ant[c.chave], c.fmt)})`;
    }
  };

  D.renderAlertas = function ({ meta, leads }) {
    const avisos = [];
    if (!leads) avisos.push('Leads unificados indisponíveis: leads, MQL, CPL e cruzamentos ficam sem número.');
    for (const f of (leads && leads.fontes) || []) {
      if (f.erro) avisos.push(`Fonte <strong>${D.esc(f.nome)}</strong> falhou: ${D.esc(f.erro)}`);
      // O Respondi parou de propósito em 27/08/2026 (a página nova substituiu a LP antiga): não é alerta.
      else if (f.nome !== 'RESPONDI' && f.dias_sem_lead !== null && f.dias_sem_lead > 3) {
        avisos.push(`Fonte <strong>${D.esc(f.nome)}</strong> sem lead há ${f.dias_sem_lead} dias (último em ${D.fmtDia(f.ultimo_lead)}).`);
      }
    }
    const quebradas = leads ? (leads.por_campanha.find(c => c.campanha === 'Etiqueta quebrada') || { leads: 0 }).leads : 0;
    if (quebradas) avisos.push(`${quebradas} lead(s) com <strong>etiqueta quebrada</strong>: macro de UTM gravada literal — conferir a URL do anúncio.`);
    if (meta && meta.grupos.CAFE && meta.grupos.CAFE.spend > 0 && leads && leads.por_grupo.CAFE.leads === 0) {
      avisos.push('Café com Sevilha tem gasto no Meta e nenhum lead real: o webhook do RD Marketing não está ativo ou não recebeu conversão no período.');
    }
    D.banner('alertas', avisos.length ? '<ul>' + avisos.map(a => `<li>${a}</li>`).join('') + '</ul>' : '');
  };
})(window.SPD = window.SPD || {});
```

- [ ] **Step 3: `assets/js/dash/geral.js`**

```js
'use strict';
/* Aba Visão geral. */
(function (D) {
  const PAGINAS_SE = ['/mentoria', '/mentoria-2'];

  /** Linhas cruzadas por campanha (opcionalmente só de um grupo). Usada por várias abas. */
  D.linhasCampanha = (d, grupo = null) => D.cruzar(
    d.leads ? d.leads.por_campanha : [],
    d.meta.campanhas.map(c => ({ nome: c.nome, spend: c.spend, leads: c.leads, grupo: c.grupo })),
    'campanha', { rd: d.rd ? d.rd.por_campanha : [], filtroGrupo: grupo });

  D.renderGeral = function (d) {
    const { meta, leads, stats, rd } = d;
    const capt = ['SE', 'CAFE', 'CP'].reduce((s, g) => s + (meta.grupos[g] ? meta.grupos[g].spend : 0), 0);
    D.setK('g-spend', D.fmtR(meta.conta.spend));
    D.setK('g-spend-capt', D.fmtR(capt));
    D.setK('g-ctr', D.orDash(meta.conta.ctr, D.fmtP));
    D.setK('g-cpm', D.orDash(meta.conta.cpm, D.fmtR));

    const dias = meta.serie.map(s => s.data);
    const porDia = new Map((leads ? leads.por_dia : []).map(x => [x.dia, x]));
    D.graficoLeadsDia('chartLeadsDia', dias, {
      mql: dias.map(x => (porDia.get(x) || { mql: 0 }).mql),
      outros: dias.map(x => { const r = porDia.get(x); return r ? r.leads - r.mql : 0; }),
      spend: meta.serie.map(s => s.spend),
    });

    const rows = D.linhasCampanha(d);
    D.graficoCusto('chartCustoCampanha', rows);
    D.tabela('tblCampanhas', rows, ['nome', 'grupo', 'spend', 'leads', 'mql', 'mql_pct', 'cpl', 'cpmql', 'meta_reporta', 'deals', 'lead_deal']);

    const visitantesSE = stats ? stats.paginas.filter(p => PAGINAS_SE.includes(p.pagina)).reduce((s, p) => s + (p.visitantes || 0), 0) : null;
    for (const g of ['SE', 'CAFE', 'CP']) {
      const pg = leads ? leads.por_grupo[g] : { leads: null, mql: null };
      const deals = rd ? D.linhasCampanha(d, g).reduce((s, r) => s + r.deals, 0) : null;
      D.renderFunil('funil' + g, [
        { rotulo: 'Visitantes', valor: g === 'SE' ? visitantesSE : null },
        { rotulo: 'Leads', valor: pg.leads }, { rotulo: 'MQL (10+)', valor: pg.mql }, { rotulo: 'Deals', valor: deals },
      ]);
    }
    D.renderPaginas(stats, leads);
  };

  D.renderPaginas = function (stats, leads) {
    const tbody = document.getElementById('tblPaginas');
    if (!tbody) return;
    const mqlPor = new Map((leads ? leads.por_pagina : []).map(p => [p.pagina, p]));
    const rows = (stats ? stats.paginas : []).filter(p => p.visitantes || p.leads);
    tbody.innerHTML = rows.length ? rows.map(p => {
      const u = mqlPor.get(p.pagina) || { mql: null };
      return `<tr><td>${D.esc(p.pagina)}</td><td class="num">${D.fmtN(p.visitantes)}</td><td class="num">${D.fmtN(p.leads)}</td>`
        + `<td class="num">${D.orDash(u.mql, D.fmtN)}</td><td class="num">${D.orDash(u.mql === null ? null : D.pct(u.mql, p.leads), D.fmtP)}</td>`
        + `<td class="num">${D.orDash(p.conversao_visitantes, D.fmtP)}</td></tr>`;
    }).join('') : '<tr><td colspan="6" class="vazio">Sem visita medida no período</td></tr>';
  };
})(window.SPD = window.SPD || {});
```

- [ ] **Step 4: `assets/js/dash/main.js`**

```js
'use strict';
/* Estado, período, abas, tema e o ciclo carregar → render → auto-refresh. */
(function (D) {
  const estado = { since: '', until: '', preset: 'last_30d', dados: null, anterior: null, timer: null };
  const p2 = n => String(n).padStart(2, '0');
  // Datas sempre em horário local: toISOString() é UTC e, depois das 21h, "hoje" já seria amanhã.
  const isoLocal = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const hoje = () => isoLocal(new Date());
  const diasAtras = n => { const d = new Date(); d.setDate(d.getDate() - n); return isoLocal(d); };

  function intervalo(preset) {
    switch (preset) {
      case 'today': return [hoje(), hoje()];
      case 'last_7d': return [diasAtras(6), hoje()];
      case 'last_14d': return [diasAtras(13), hoje()];
      case 'last_90d': return [diasAtras(89), hoje()];
      case 'this_month': { const d = new Date(); d.setDate(1); return [isoLocal(d), hoje()]; }
      case 'last_month': { const ini = new Date(); ini.setDate(1); ini.setMonth(ini.getMonth() - 1); const fim = new Date(); fim.setDate(0); return [isoLocal(ini), isoLocal(fim)]; }
      default: return [diasAtras(29), hoje()];
    }
  }
  const ROTULO = { today: 'Hoje', last_7d: 'Últimos 7 dias', last_14d: 'Últimos 14 dias', last_30d: 'Últimos 30 dias', last_90d: 'Últimos 90 dias', this_month: 'Este mês', last_month: 'Mês anterior' };

  function aplicarPeriodo(preset, since, until) {
    estado.preset = preset; estado.since = since; estado.until = until;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
    document.getElementById('customDates').classList.toggle('show', preset === 'custom');
    document.getElementById('periodBadge').textContent = '📅 ' + (ROTULO[preset] || `${D.fmtDia(since)} → ${D.fmtDia(until)}`);
    carregar();
  }

  D.banner = (id, html) => { const el = document.getElementById(id); if (!el) return; el.innerHTML = html || ''; el.classList.toggle('show', !!html); };
  D.abrirAba = function (nome) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      const on = b.dataset.tab === nome; b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.querySelectorAll('.tab-panel').forEach(pn => pn.classList.toggle('active', pn.id === 'tab-' + nome));
    if (location.hash !== '#' + nome) history.replaceState(null, '', '#' + nome);
    D.redimensionarGraficos();
  };

  function status(classe, texto) { document.getElementById('statusDot').className = 'status-dot ' + classe; document.getElementById('statusText').textContent = texto; }
  const seExiste = (fn, ...args) => { if (typeof fn === 'function') fn(...args); };

  function render() {
    const d = estado.dados;
    D.renderExecutivo(d, estado.anterior);
    D.renderAlertas(d);
    D.renderGeral(d);
    seExiste(D.renderFormatos, d);
    for (const g of ['SE', 'CAFE', 'CP']) seExiste(D.renderGrupo, g, d);
    seExiste(D.renderOrigem, d);
    seExiste(D.renderAb, d);
  }

  async function carregar() {
    const btn = document.getElementById('btnRefresh');
    btn.disabled = true; status('loading', 'Carregando…'); D.banner('errorBanner', '');
    try {
      const ant = D.periodoAnterior(estado.since, estado.until);
      const [dados, anterior] = await Promise.all([D.carregarTudo(estado.since, estado.until), D.carregarResumo(ant.since, ant.until)]);
      estado.dados = dados; estado.anterior = anterior;
      render();
      status('', dados.leads ? 'Dados atualizados' : 'Meta ok · leads unificados indisponíveis');
      document.getElementById('lastUpdate').textContent = '🕐 ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error(e);
      status('error', 'Erro ao carregar');
      D.banner('errorBanner', `⚠️ <strong>Erro ao carregar o Meta Ads:</strong> ${D.esc(e.message)}`);
    }
    btn.disabled = false;
    clearTimeout(estado.timer);
    estado.timer = setTimeout(carregar, 60000);
  }

  // Tema: persistido por navegador; ao trocar, redesenha para os gráficos lerem as cores novas.
  function aplicarTema(escuro) {
    document.documentElement.setAttribute('data-theme', escuro ? 'dark' : '');
    document.getElementById('btnTheme').textContent = escuro ? '☀️' : '🌙';
    try { localStorage.setItem('sp-theme', escuro ? 'dark' : ''); } catch { /* armazenamento bloqueado */ }
    if (estado.dados) render();
  }

  document.addEventListener('DOMContentLoaded', () => {
    let escuro = false;
    try { escuro = localStorage.getItem('sp-theme') === 'dark'; } catch { /* idem */ }
    if (escuro) aplicarTema(true);
    document.getElementById('btnTheme').addEventListener('click', () => aplicarTema(document.documentElement.getAttribute('data-theme') !== 'dark'));
    document.getElementById('btnRefresh').addEventListener('click', carregar);
    document.querySelectorAll('.preset-btn').forEach(b => b.addEventListener('click', () => {
      const p = b.dataset.preset;
      if (p === 'custom') { document.querySelectorAll('.preset-btn').forEach(x => x.classList.toggle('active', x === b)); document.getElementById('customDates').classList.add('show'); return; }
      const [s, u] = intervalo(p); aplicarPeriodo(p, s, u);
    }));
    document.getElementById('btnApply').addEventListener('click', () => {
      const s = document.getElementById('dateSince').value, u = document.getElementById('dateUntil').value;
      if (!s || !u || s > u) { alert('Informe um intervalo válido (início ≤ fim).'); return; }
      aplicarPeriodo('custom', s, u);
    });
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => D.abrirAba(b.dataset.tab)));
    document.addEventListener('click', e => { const b = e.target.closest('[data-csv]'); if (b) D.baixarCsv(b.dataset.csv, `${b.dataset.csv}-${estado.since}-${estado.until}.csv`); });
    const aba = location.hash.replace('#', '');
    if (aba && document.getElementById('tab-' + aba)) D.abrirAba(aba);
    const [s, u] = intervalo('last_30d'); aplicarPeriodo('last_30d', s, u);
  });
})(window.SPD = window.SPD || {});
```

- [ ] **Step 5: Verificar no navegador (agent-browser, sessão nomeada)**

```bash
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix task)"
vercel dev --listen 3000 &   # ou o dev server já em uso
agent-browser open http://localhost:3000/dashboard
agent-browser wait --text "Dados atualizados"
agent-browser screenshot geral.png
agent-browser console
```

Expected: faixa executiva com 7 valores e deltas; gráfico de leads/dia; tabela de campanhas com badge de grupo; console só com 404 dos módulos de T14/T15. Se `vercel dev` não tiver as credenciais (`.env.local` com token inválido, ver memória do projeto), abra contra produção após o deploy de T16 e registre aqui que a checagem local foi pulada.

- [ ] **Step 6: Lint e commit** — `npx eslint dashboard.html assets/js/dash/ && git add dashboard.html assets/js/dash/main.js assets/js/dash/executivo.js assets/js/dash/geral.js && git commit -m "feat(dash): faixa executiva com período anterior, alertas e visão geral em módulos"`

---

### Task 14: `formatos.js` e `grupo.js` (abas Formatos, [SE], [CAFÉ], [CP])

**Files:**
- Create: `assets/js/dash/formatos.js`, `assets/js/dash/grupo.js`

**Interfaces:**
- Consumes: T13 `D.linhasCampanha`, `D.setK`, `D.banner`; T12 `D.tabela`, `D.graficoCusto`; T11 `D.cruzar`, `D.totalizar`.
- Produces: `D.renderFormatos(dados)`, `D.renderGrupo(grupo, dados)` com `grupo ∈ {'SE','CAFE','CP'}`. Cada um monta o próprio markup dentro de `#painelFormatos` / `#painel<GRUPO>` na primeira chamada.

- [ ] **Step 1: `assets/js/dash/formatos.js`**

```js
'use strict';
/* Aba Formatos: formulário instantâneo (FORMS) × landing page (LP), dentro da captação. */
(function (D) {
  const MARKUP = `
  <div class="section">
    <div class="section-title">⚔️ FORMS × LP — leads reais e custo</div>
    <p class="nota-fonte">Campanhas [SE], [CAFÉ] e [CP]. FORMS = formulário dentro do Meta; LP = landing page (site, Respondi ou RD).</p>
    <div class="table-wrap"><table id="tblFormatos"></table></div>
  </div>
  <div class="two-col">
    <div class="section"><div class="section-title">👔 Cargo declarado</div><div class="table-wrap"><table><thead><tr><th>Cargo</th><th class="num">Leads</th><th class="num">%</th></tr></thead><tbody id="tblCargo"></tbody></table></div></div>
    <div class="section"><div class="section-title">🏢 Colaboradores declarados</div><div class="table-wrap"><table><thead><tr><th>Faixa</th><th class="num">Leads</th><th class="num">%</th></tr></thead><tbody id="tblColab"></tbody></table></div></div>
  </div>`;

  function distribuicao(tbodyId, mapa, total) {
    const tbody = document.getElementById(tbodyId);
    const itens = Object.entries(mapa || {}).sort((a, b) => b[1] - a[1]);
    const semResposta = total - itens.reduce((s, [, v]) => s + v, 0);
    if (semResposta > 0) itens.push(['Sem resposta', semResposta]);
    tbody.innerHTML = itens.length ? itens.map(([k, v]) => `<tr><td>${D.esc(k)}</td><td class="num">${D.fmtN(v)}</td><td class="num">${D.orDash(D.pct(v, total), D.fmtP)}</td></tr>`).join('')
      : '<tr><td colspan="3" class="vazio">Sem dados</td></tr>';
  }

  D.renderFormatos = function (d) {
    const el = document.getElementById('painelFormatos');
    if (!el.dataset.pronto) { el.innerHTML = MARKUP; el.dataset.pronto = '1'; }
    const { meta, leads } = d;
    // Por formato: gasto e "Meta reporta" vêm das campanhas de captação; leads e MQL, dos leads unificados.
    const metaRows = ['FORMS', 'LP'].map(f => ({
      nome: f,
      spend: meta.campanhas.filter(c => c.grupo !== 'OUTROS' && c.formato === f).reduce((s, c) => s + c.spend, 0),
      leads: meta.campanhas.filter(c => c.grupo !== 'OUTROS' && c.formato === f).reduce((s, c) => s + c.leads, 0),
    }));
    const leadRows = leads ? ['FORMS', 'LP'].map(f => ({ formato: f, leads: leads.por_formato[f].leads, mql: leads.por_formato[f].mql })) : [];
    D.tabela('tblFormatos', D.cruzar(leadRows, metaRows, 'formato'), D.COLUNAS_CRUZAMENTO);
    const total = leads ? leads.total.leads : 0;
    distribuicao('tblCargo', leads && leads.qualificacao.cargo, total);
    distribuicao('tblColab', leads && leads.qualificacao.colaboradores, total);
  };
})(window.SPD = window.SPD || {});
```

- [ ] **Step 2: `assets/js/dash/grupo.js`**

```js
'use strict';
/* Abas [SE], [CAFÉ] e [CP]: mesma composição, filtrada pelo grupo. */
(function (D) {
  const NOME = { SE: 'Sessão Estratégica', CAFE: 'Café com Sevilha', CP: 'Clube da Performance' };
  const FUNIL_RD = { SE: 'SE', CP: 'CP' }; // chave em rd.funis; o Café não tem funil próprio no CRM

  const markup = g => `
  <div class="banner banner-warn" id="aviso${g}"></div>
  <div class="kpi-groups"><div class="kpi-group">
    <div class="kpi-group-label">${NOME[g]} — período</div>
    <div class="kpi-card blue"><div class="kpi-label">Investido</div><div class="kpi-value" id="${g}-spend"></div></div>
    <div class="kpi-card green"><div class="kpi-label">Leads</div><div class="kpi-value" id="${g}-leads"></div><div class="kpi-sub" id="${g}-leads-sub"></div></div>
    <div class="kpi-card purple"><div class="kpi-label">MQL (10+)</div><div class="kpi-value" id="${g}-mql"></div><div class="kpi-sub" id="${g}-mql-sub"></div></div>
    <div class="kpi-card green"><div class="kpi-label">CPL</div><div class="kpi-value" id="${g}-cpl"></div></div>
    <div class="kpi-card purple"><div class="kpi-label">CPMQL</div><div class="kpi-value" id="${g}-cpmql"></div></div>
    <div class="kpi-card teal"><div class="kpi-label">Deals</div><div class="kpi-value" id="${g}-deals"></div><div class="kpi-sub" id="${g}-deals-sub"></div></div>
  </div></div>
  <div class="section"><div class="section-title">💸 Custo por MQL e por lead, por campanha</div><div class="chart-wrap" style="height:260px"><canvas id="chartCusto${g}"></canvas></div></div>
  <div class="section"><div class="section-title">🎯 Campanhas <div class="section-tools"><button class="btn-csv" type="button" data-csv="tblCamp${g}">Exportar CSV</button></div></div><div class="table-wrap"><table id="tblCamp${g}"></table></div></div>
  <div class="section"><div class="section-title">👥 Públicos (conjuntos de anúncios) <div class="section-tools"><button class="btn-csv" type="button" data-csv="tblConj${g}">Exportar CSV</button></div></div><div class="table-wrap"><table id="tblConj${g}"></table></div></div>
  <div class="section"><div class="section-title">🖼️ Anúncios <div class="section-tools"><button class="btn-csv" type="button" data-csv="tblAnun${g}">Exportar CSV</button></div></div><div class="table-wrap"><table id="tblAnun${g}"></table></div></div>
  <div class="section" id="secRd${g}"><div class="section-title">🗂️ RD CRM — etapas do funil</div><div class="table-wrap"><table><thead><tr><th>Etapa</th><th class="num">Deals</th></tr></thead><tbody id="tblEtapas${g}"></tbody></table></div><p class="nota-fonte" id="notaRd${g}"></p></div>`;

  function aviso(g, d) {
    const { meta, leads } = d;
    if (g === 'CP' && meta.grupos.CP.spend === 0) return '⏸️ Campanhas [CP] sem investimento no período (pausadas). O funil do CRM continua recebendo deals de outras origens.';
    if (g === 'CAFE') {
      const cafe = leads && leads.por_pagina.filter(p => String(p.pagina).startsWith('rd:'));
      if (!leads || !cafe.length) return '☕ Leads reais do Café dependem do webhook do RD Marketing (Integrações → Webhooks → Conversão). Sem ele, só o número que o Meta reporta aparece.';
      return `☕ Leads reais do Café chegam pelo webhook do RD Marketing (${cafe.map(p => D.esc(p.pagina.slice(3))).join(', ')}). Leads anteriores à ativação do webhook não entram.`;
    }
    return '';
  }

  D.renderGrupo = function (g, d) {
    const el = document.getElementById('painel' + g);
    if (!el.dataset.pronto) { el.innerHTML = markup(g); el.dataset.pronto = '1'; }
    const { meta, leads, rd } = d;
    D.banner('aviso' + g, aviso(g, d));

    const rows = D.linhasCampanha(d, g);
    const t = D.totalizar(rows);
    const pg = leads ? leads.por_grupo[g] : null;
    D.setK(`${g}-spend`, D.fmtR(meta.grupos[g] ? meta.grupos[g].spend : 0));
    D.setK(`${g}-leads`, pg ? D.fmtN(pg.leads) : '—');
    document.getElementById(`${g}-leads-sub`).textContent = `Meta reporta ${D.fmtN(t.meta_reporta)}`;
    D.setK(`${g}-mql`, pg ? D.fmtN(pg.mql) : '—');
    document.getElementById(`${g}-mql-sub`).textContent = pg ? `${D.orDash(D.pct(pg.mql, pg.leads), D.fmtP)} dos leads` : '';
    D.setK(`${g}-cpl`, D.orDash(t.cpl, D.fmtR));
    D.setK(`${g}-cpmql`, D.orDash(t.cpmql, D.fmtR));
    D.setK(`${g}-deals`, rd ? D.fmtN(t.deals) : '—');
    document.getElementById(`${g}-deals-sub`).textContent = rd ? `Lead → deal ${D.orDash(t.lead_deal, D.fmtP)}` : 'RD indisponível';

    D.graficoCusto('chartCusto' + g, rows);
    D.tabela('tblCamp' + g, rows, [...D.COLUNAS_CRUZAMENTO, 'deals', 'lead_deal']);
    D.tabela('tblConj' + g, D.cruzar(leads ? leads.por_conjunto : [], meta.conjuntos || [], 'conjunto', { filtroGrupo: g }), D.COLUNAS_CRUZAMENTO);
    D.tabela('tblAnun' + g, D.cruzar(leads ? leads.por_anuncio : [], meta.anuncios || [], 'anuncio', { filtroGrupo: g }), D.COLUNAS_CRUZAMENTO);

    const sec = document.getElementById('secRd' + g);
    const funil = rd && FUNIL_RD[g] ? rd.funis[FUNIL_RD[g]] : null;
    sec.hidden = !funil;
    if (funil) {
      document.getElementById('tblEtapas' + g).innerHTML = funil.etapas.map(e => `<tr><td>${D.esc(e.nome)}</td><td class="num">${D.fmtN(e.deals)}</td></tr>`).join('') || '<tr><td colspan="2" class="vazio">Sem deals</td></tr>';
      document.getElementById('notaRd' + g).textContent = `${D.fmtN(funil.total)} deals no funil "${funil.nome}" no período · ${D.fmtN(funil.ganhos)} ganhos · ${D.fmtN(funil.perdidos)} perdidos` + (rd.acumulado ? ' · ATENÇÃO: RD respondeu o acumulado, não o período' : '');
    }
  };
})(window.SPD = window.SPD || {});
```

- [ ] **Step 3: Navegador** — recarregue `/dashboard`, clique nas abas Formatos, Sessão Estratégica, Café, Clube (`agent-browser snapshot -i` → `click @ref` → `screenshot`). Expected: KPIs em pares Leads/MQL e CPL/CPMQL, três tabelas por aba com totais, aviso no Café e no CP, console sem erro além do 404 de `origem.js`/`ab.js`.
- [ ] **Step 4: Lint e commit** — `npx eslint assets/js/dash/ && git add assets/js/dash/formatos.js assets/js/dash/grupo.js && git commit -m "feat(dash): abas de formato e de grupo com Lead/MQL, CPL/CPMQL e públicos e anúncios"`

---

### Task 15: `origem.js`, `ab.js` e o fim de `/relatorio`

**Files:**
- Create: `assets/js/dash/origem.js`, `assets/js/dash/ab.js`
- Modify: `vercel.json` (remove o rewrite de `/relatorio`; adiciona `redirects`), `docs/raio-x-meta-2026-09-03.html` (link do menu `/relatorio` → `/dashboard#ab`)
- Delete: `relatorio.html`, `assets/css/admin-report.css`

**Interfaces:**
- Produces: `D.renderOrigem(dados)`, `D.renderAb(dados)`. Consome `meta.campanhas/conjuntos/anuncios/posicionamentos`, `leads.por_campanha/por_conjunto/por_anuncio/por_fonte`, `rd.por_campanha`, `stats.variants`.

- [ ] **Step 1: `assets/js/dash/origem.js`**

```js
'use strict';
/* Aba Origem: cruzamento por campanha, público, anúncio e posicionamento, com filtro de grupo e CSV. */
(function (D) {
  const MARKUP = `
  <div class="section">
    <div class="section-title">🔎 Origem dos leads — cruzamento UTM × gasto
      <div class="section-tools"><label for="filtroGrupo" class="nota-fonte" style="margin:0">Grupo</label>
        <select id="filtroGrupo" class="select-grupo"><option value="">Todos</option><option value="SE">Sessão Estratégica</option><option value="CAFE">Café com Sevilha</option><option value="CP">Clube</option></select></div>
    </div>
    <p class="nota-fonte">Lead real de qualquer fonte cruzado pelo nome: utm_campaign × campanha, utm_medium × conjunto, utm_content × anúncio, utm_source × posicionamento. "Sem etiqueta" = lead sem UTM; "Etiqueta quebrada" = macro gravada literal.</p>
    <div class="chart-wrap" style="height:280px"><canvas id="chartMetaVsReal"></canvas></div>
  </div>
  ${[['Campanhas', 'tblOrigCamp'], ['Públicos (conjuntos)', 'tblOrigConj'], ['Anúncios', 'tblOrigAnun'], ['Fonte / posicionamento', 'tblOrigFonte']]
    .map(([t, id]) => `<div class="section"><div class="section-title">${t} <div class="section-tools"><button class="btn-csv" type="button" data-csv="${id}">Exportar CSV</button></div></div><div class="table-wrap"><table id="${id}"></table></div></div>`).join('')}`;

  D.renderOrigem = function (d) {
    const el = document.getElementById('painelOrigem');
    if (!el.dataset.pronto) {
      el.innerHTML = MARKUP; el.dataset.pronto = '1';
      document.getElementById('filtroGrupo').addEventListener('change', () => D.renderOrigem(d));
    }
    const grupo = document.getElementById('filtroGrupo').value || null;
    const { meta, leads } = d;
    const L = k => (leads ? leads[k] : []);
    const camp = D.linhasCampanha(d, grupo);
    D.graficoMetaVsReal('chartMetaVsReal', camp);
    D.tabela('tblOrigCamp', camp, [...D.COLUNAS_CRUZAMENTO, 'deals', 'lead_deal']);
    D.tabela('tblOrigConj', D.cruzar(L('por_conjunto'), meta.conjuntos || [], 'conjunto', { filtroGrupo: grupo }), ['nome', 'campanha', ...D.COLUNAS_CRUZAMENTO.slice(1)]);
    D.tabela('tblOrigAnun', D.cruzar(L('por_anuncio'), meta.anuncios || [], 'anuncio', { filtroGrupo: grupo }), ['nome', 'campanha', ...D.COLUNAS_CRUZAMENTO.slice(1)]);
    // Posicionamento não tem grupo no lado do gasto (breakdown por conta): sem filtro.
    D.tabela('tblOrigFonte', D.cruzar(L('por_fonte'), meta.posicionamentos || [], 'fonte'), D.COLUNAS_CRUZAMENTO);
  };
})(window.SPD = window.SPD || {});
```

Nota: em `renderOrigem`, o `addEventListener` captura o `d` da primeira chamada; como `main.js` chama `renderOrigem` a cada carga com o `d` novo, troque o listener para ler o dado atual: guarde `D._ultimoDado = d;` no início da função e use `() => D.renderOrigem(D._ultimoDado)` no listener.

- [ ] **Step 2: `assets/js/dash/ab.js`**

```js
'use strict';
/* Aba A/B: o antigo /relatorio — variantes das páginas de captura, do /api/stats. */
(function (D) {
  const ROTULO = { '/': 'Página 1 (principal)', '/pre-inscricao-2': 'Página 2', '/pre-inscricao-3': 'Página 3' };
  D.renderAb = function ({ stats }) {
    const el = document.getElementById('painelAb');
    if (!stats) { el.innerHTML = '<div class="section"><p class="nota-fonte">/api/stats indisponível.</p></div>'; return; }
    const vs = stats.variants || [];
    const melhor = Math.max(...vs.map(v => v.conversion_rate || 0));
    el.innerHTML = `
    <div class="section"><div class="section-title">🧪 Teste A/B — páginas de captura</div>
      <p class="nota-fonte">Totais: ${D.fmtN(stats.totals.visits)} visitas · ${D.fmtN(stats.totals.leads)} leads · conversão ${D.orDash(stats.totals.visits ? stats.totals.conversion_rate : null, D.fmtP)}. Só as três páginas do teste; /mentoria está na aba Sessão Estratégica.</p>
      <div class="kpi-group">${vs.map(v => `
        <div class="kpi-card ${v.conversion_rate === melhor && melhor > 0 ? 'green' : ''}"><div class="kpi-label">${D.esc(ROTULO[v.pagina] || v.pagina)}</div>
          <div class="kpi-value">${D.orDash(v.visits ? v.conversion_rate : null, D.fmtP)}</div>
          <div class="kpi-sub">${D.fmtN(v.visits)} visitas · ${D.fmtN(v.leads)} leads${v.conversion_rate === melhor && melhor > 0 ? ' · melhor' : ''}</div></div>`).join('')}</div>
    </div>`;
  };
})(window.SPD = window.SPD || {});
```

- [ ] **Step 3: `/relatorio` vira redirecionamento**

Em `vercel.json`: remova o objeto `{ "source": "/relatorio", "destination": "/relatorio.html" }` de `rewrites` e acrescente, no nível raiz do JSON:

```json
  "redirects": [
    { "source": "/relatorio", "destination": "/dashboard#ab", "permanent": false }
  ],
```

`git rm relatorio.html assets/css/admin-report.css`. Em `docs/raio-x-meta-2026-09-03.html`, troque `href="/relatorio"` por `href="/dashboard#ab"`.

- [ ] **Step 4: Navegador** — abas Origem (troque o filtro de grupo, clique num cabeçalho para ordenar, clique em "Exportar CSV": o download aparece em `agent-browser` como requisição `blob:`) e A/B. Console limpo, `network requests` sem 404.
- [ ] **Step 5: Lint e commit** — `npm run lint` (zero erro) e `git add -A assets/js/dash/origem.js assets/js/dash/ab.js vercel.json docs/raio-x-meta-2026-09-03.html relatorio.html assets/css/admin-report.css && git commit -m "feat(dash): aba Origem com cruzamento por UTM e CSV; A/B absorve /relatorio"`

---

### Task 16: Validação final, deploy e conferência

**Files:** nenhum novo. Verifica tudo.

- [ ] **Step 1: Testes e lint**

```bash
for t in fuso posicionamento planilha-leads leads-unificados leads-fontes meta-agregados meta-leads rd-stats-campanha rd-webhook stats-paginas sheet-leads eventos-qualificados respondi-webhook sessao-estrategica dash-cruzamento porte; do node scripts/test-$t.js || echo "FALHOU: $t"; done
npm run lint
```

Expected: nenhum `FALHOU`; lint com 0 erros; contagem de avisos igual ou menor que antes (compare com `git stash; npm run lint; git stash pop` se precisar da base).

- [ ] **Step 2: Deploy** — `vercel --prod` (ou push na `main`, conforme o projeto está ligado). Anote a URL.

- [ ] **Step 3: Conferência em produção**

```bash
node scripts/conferir-dados.js --since 2026-08-31 --until 2026-09-13
```

Expected: `tudo consistente`. Se `RD respondeu o período` falhar, a query do RD não bateu o regex; se `nenhuma fonte com erro` falhar, a mensagem de `fontes[].erro` diz qual credencial faltou na Vercel. Se `por_campanha` do RD vier só com "Sem campanha", o `GET /deals` não devolve `deal_custom_fields`: abrir um deal em `GET /deals/{id}` e conferir o nome do campo — ajustar `campanhaDoDeal` (T7) e registrar.

- [ ] **Step 4: Navegador em produção**

```bash
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix task)"
agent-browser open https://sevilha-perfomance.vercel.app/dashboard
agent-browser wait --text "Dados atualizados"
agent-browser set viewport 1440 900 && agent-browser screenshot prod-desktop.png
agent-browser set viewport 390 844  && agent-browser screenshot prod-mobile.png
agent-browser console && agent-browser network requests && agent-browser a11y
agent-browser open https://sevilha-perfomance.vercel.app/relatorio && agent-browser get url   # → /dashboard#ab
agent-browser close
```

Leia os PNGs: sem sobreposição, sem texto cortado, tema escuro (clique em 🌙) legível. Corrija e redeploye o que aparecer.

- [ ] **Step 5: Webhook do RD (passo do dono da conta)**

Gerar `openssl rand -hex 24`, gravar em `.env.local` e na Vercel como `RD_MARKETING_WEBHOOK_SECRET`, redeployar, e cadastrar no RD Marketing (Integrações → Webhooks → Conversão) a URL `https://sevilha-perfomance.vercel.app/api/respondi?fonte=rd-marketing&token=<valor>`. Depois de uma conversão de teste, `/api/leads-unificados` deve mostrar `por_pagina` com `rd:<identificador>`.

- [ ] **Step 6: Memória e commit final** — atualizar `graphify update .`; registrar na memória do projeto o que não está no código (URL do webhook cadastrada, data de ativação do Café, resultado da conferência); `git commit` se algo mudou.

---

## Self-review

**Cobertura da spec:** §1 fontes/verdade → T3, T4, T5. §2 Meta → T4 (CAFE), T6. §3 Café → T8 (emenda: sem SQL). §4 front: faixa executiva, alertas, abas, gráficos 1-4, fórmulas, módulos, `data-tab`, hash → T12-T15. Lead/MQL em todo lugar → colunas de `tabelas.js`, KPIs de `grupo.js`, faixa executiva. Aba Origem com 4 tabelas, filtro, ordenação, CSV → T15/T12. Extra 3 (lead → deal) → T7 + coluna `deals`/`lead_deal`. Extra 4 (CSV) → T12. §5 conferência → T10. §6 validação → T16. Fora: micro-funil do /mentoria (emenda 4).

**Tipos e nomes:** `meta.campanhas[].nome` é o campo de nome em todas as listas do Meta (`linha()` em T6); `D.cruzar` lê `m.nome` — consistente. `leads.por_fonte[].fonte` é a chave de posicionamento e `meta.posicionamentos[].nome` também — mesma função `chavePosicionamento`/`chaveDoMacro` nos dois lados. `rd.por_campanha[].campanha` é lido por `D.cruzar` via `d.campanha` — consistente. `stats.paginas[].visitantes`/`conversao_visitantes` (T9) são os campos lidos em `geral.js`.

**Ordem de dependência dos scripts no HTML:** formato → cruzamento → api → graficos → tabelas → executivo → geral → formatos → grupo → origem → ab → main. `tabelas.js` usa `D.totalizar` (cruzamento) e `D.fmt*` (formato): carregados antes. `main.js` chama tudo: por último.
