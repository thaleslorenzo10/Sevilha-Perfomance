# Café com Sevilha — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `/cafe-com-sevilha` dentro do site — réplica visual da landing page do RD, com modal de dois passos, lead nascendo em `/api/leads` como oferta `[CAFÉ]` e contado no grupo `CAFE` do painel.

**Architecture:** Uma página estática nova (`cafe-com-sevilha/index.html` + `cafe.css`) que reaproveita `assets/tracking.js` e `assets/form-steps.js` como as irmãs; o comportamento do modal é parametrizado por `data-*` no `<form>` (mecanismo que a aula paga já usa). No servidor, a oferta entra no mapa `OFERTAS` de `api/leads.js` e a página no `GRUPO_POR_PAGINA` de `lib/leads-unificados.js`. Nenhuma função serverless nova.

**Tech Stack:** HTML/CSS estático · JS vanilla (`var`, sem módulos, como os assets existentes) · Node serverless na Vercel · testes = scripts avulsos `node scripts/test-*.js`, sem framework · agent-browser para conferência visual · ffmpeg para assets.

**Spec:** `docs/superpowers/specs/2026-09-15-cafe-com-sevilha-design.md` — leia antes de qualquer task.

## Global Constraints

- **Branch/worktree:** `feat/cafe-com-sevilha` em `/Users/thaleslorenzo/Documents/GitHub/Sevilha-Perfomance/.claude/worktrees/cafe-com-sevilha`. Todo comando roda daí.
- **Commits são do orquestrador.** O subagente NÃO roda `git commit`; termina a task com os arquivos salvos e reporta. (Um commit por task.)
- **Teto de 12 serverless functions** no Hobby — o projeto usa 11. Nenhum arquivo novo em `api/`.
- **`name=` dos campos é contrato com `/api/leads`:** `nome email telefone escritorio cargo colaboradores utm_source utm_medium utm_campaign utm_term utm_content fbclid gclid ttclid msclkid fbp fbc external_id event_id page_url user_agent pagina`. Não renomear.
- **Valores dos rádios são contrato com `lib/porte.js`:** `De 0 a 4 · De 5 a 9 · De 10 a 19 · De 20 a 29 · De 30 a 49 · Mais de 50` e `Dono/Sócio · Cargo Gerencial · Cargo Operacional`.
- **Ids do modal são contrato com `assets/form-steps.js`:** `modal-overlay form-wrapper sessao-form modal-foot passo-1 passo-2 passo-rotulo modal-title modal-sub route-porte clube-link route-continuar route-cargo grupo-cargo form-error err-wa form-success wa-link submit-btn voltar-passo-1 f-name f-phone`.
- **Regras de craft do projeto (DESIGN.md):** foco com `outline`, nunca `box-shadow`; animação de entrada só dentro de `@media (prefers-reduced-motion: no-preference)` e nunca `opacity: 0` por padrão; `<img>` com `width`/`height` e `height: auto` no CSS; cadeia flex do modal (`#form-wrapper → form → .modal-body/.modal-foot`) com `min-height: 0`; sem caixa alta fora dos kickers; nenhum rádio `required`; `#passo-2` e `#modal-foot` começam `hidden`.
- **Lint:** `npm run lint` e `npm run lint:biome` sem erro; nenhum aviso novo além da linha de base do CLAUDE.md. Arquivos JS ≤ 350 linhas (`index.html` é isento).
- **Copy da página é palavra por palavra a da LP do RD** (transcrita na Task 3). Português do Brasil, "você".
- **Pixel:** id `657178423444244`, snippet com guarda `localStorage.getItem('_sp_interno')` (copiado da aula).
- **Tokens do Café:** navy `#0a2033`, navy-deep `#07182b`, navy-card `#0b2239`, teal `#20a2a8`, teal-ink `#167f85`, teal-soft `#75d2d3`, cream `#f2ebdd`, light `#eef5f6`, ink `#0a2033`, muted `#5a6178`, erro `#c62828`.
- **WhatsApp do Café:** `https://wa.me/5531999491532?text=Ol%C3%A1!%20Quero%20manifestar%20interesse%20no%20Caf%C3%A9%20com%20Sevilha.`

## Ondas

| Onda | Tasks | Por quê |
|---|---|---|
| 1 | T1 · T2 · T3 em paralelo | arquivos disjuntos |
| 2 | T4 | integra, roda tudo, confere no navegador e ponta a ponta |

Arquivos por task (não se cruzam na onda 1):

| Task | Arquivos |
|---|---|
| T1 | `api/leads.js` · `lib/leads-unificados.js` · `.env.example` · `assets/js/dash/grupo.js` · `dashboard.html` · `scripts/test-leads-unificados.js` · **novo** `scripts/test-ofertas-cafe.js` |
| T2 | `assets/form-steps.js` · `assets/tracking.js` · `mentoria/index.html` · `mentoria-2/index.html` · `aula-gestao-operacional/index.html` · `scripts/test-form-passos.js` |
| T3 | **novos** `cafe-com-sevilha/index.html` · `cafe-com-sevilha/cafe.css` · `assets/cafe-socios.webp` · `assets/og-cafe.png` |
| T4 | `scripts/test-form-passos.js` (só `PAGINAS`) · `PRODUCT.md` · `DESIGN.md` · capturas em `.impeccable/review/` |

---

### Task 1: Oferta `[CAFÉ]` no backend e grupo `CAFE` no painel

**Files:**
- Modify: `api/leads.js:55-71` (bloco `AULA` + `OFERTAS`)
- Modify: `lib/leads-unificados.js:22-26` (`GRUPO_POR_PAGINA`)
- Modify: `.env.example:131` e `:148` (listas) + bloco novo de CRM do Café
- Modify: `assets/js/dash/grupo.js:26-31` (aviso do grupo CAFE) e `dashboard.html:138` (`?v=`)
- Modify: `scripts/test-leads-unificados.js`
- Create: `scripts/test-ofertas-cafe.js`

**Interfaces:**
- Consumes: `ofertaDe(pagina)` (interno a `api/leads.js`), `nomeDoDeal`, `sendToRDMarketing`, `sendToRDCRM` — já existem.
- Produces: `OFERTAS['/cafe-com-sevilha']` = `{ rotulo:'Café com Sevilha', marca:'[CAFÉ]', conversao:'cafe-com-sevilha-site', tags:['cafe-com-sevilha','evento'], stageEnv:'RD_CRM_STAGE_ID_CAFE', campaignEnv:'RD_CRM_CAMPAIGN_ID_CAFE' }`; `GRUPO_POR_PAGINA['/cafe-com-sevilha'] === 'CAFE'`. A página (Task 3) manda `pagina: '/cafe-com-sevilha'` no corpo.

- [ ] **Step 1: Teste de caracterização da oferta (falha primeiro)**

Crie `scripts/test-ofertas-cafe.js`:

```js
'use strict';

/**
 * A página do Café precisa cair na oferta [CAFÉ] em /api/leads
 * (node scripts/test-ofertas-cafe.js).
 *
 * Fora do mapa OFERTAS, o lead cai no padrão e entra no funil do Clube da
 * Performance — sem erro nenhum. Este teste posta um lead com
 * pagina='/cafe-com-sevilha' com os tokens do RD "ligados" (valor falso) e
 * confere, nos corpos que sairiam para o RD Marketing e para o RD CRM, o
 * identificador de conversão, a marca no nome do deal e a etapa vinda da
 * variável de ambiente própria do Café. Roda offline: o fetch é substituído.
 */

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_KEY;
delete process.env.META_CAPI_TOKEN;
process.env.RD_MARKETING_TOKEN   = 'rdm-teste';
process.env.RD_CRM_TOKEN         = 'crm-teste';
process.env.RD_CRM_STAGE_ID_CAFE    = 'stage-cafe-teste';
process.env.RD_CRM_CAMPAIGN_ID_CAFE = 'campanha-cafe-teste';

const handler = require('../api/leads');

const corpos = [];
global.fetch = async (url, opts) => {
  if (String(url).includes('geolite.info')) return { ok: false, status: 404, json: async () => ({}) };
  if (opts && opts.body) corpos.push({ url: String(url), body: String(opts.body) });
  return { ok: true, status: 200, json: async () => ({ id: 'deal-1', contacts: [] }), text: async () => '' };
};

function fakeRes() {
  const r = { statusCode: null, corpo: null };
  r.setHeader = () => r;
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.corpo = b; return r; };
  r.end = () => r;
  return r;
}

let falhas = 0;
function ok(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); return; }
  falhas++;
  console.error(`  ✗ ${msg}`);
}

async function postar(pagina) {
  corpos.length = 0;
  const res = fakeRes();
  await handler({
    method: 'POST',
    headers: { 'user-agent': 'teste', 'x-forwarded-for': '203.0.113.9' },
    socket: { remoteAddress: '203.0.113.9' },
    body: { nome: 'Maria Teste', email: 'maria@example.com', telefone: '(31) 99999-0000',
            cargo: 'Dono/Sócio', colaboradores: 'De 10 a 19', pagina, event_id: 'ev_cafe_1' },
  }, res);
  ok(res.statusCode === 200, `${pagina} → 200`);
  const todos = corpos.map(c => c.body).join('\n');
  return { todos, rdm: corpos.find(c => c.url.includes('api.rd.services/platform/conversions')) };
}

(async () => {
  console.log('\n/cafe-com-sevilha');
  const cafe = await postar('/cafe-com-sevilha');
  ok(!!cafe.rdm && cafe.rdm.body.includes('"conversion_identifier":"cafe-com-sevilha-site"'),
     'RD Marketing recebe o identificador cafe-com-sevilha-site (não o da LP antiga)');
  ok(cafe.todos.includes('"name":"[CAFÉ] Maria Teste"'), 'deal do CRM nasce marcado [CAFÉ]');
  ok(cafe.todos.includes('"deal_stage_id":"stage-cafe-teste"'), 'etapa vem de RD_CRM_STAGE_ID_CAFE');
  ok(cafe.todos.includes('"campaign_id":"campanha-cafe-teste"'), 'campanha vem de RD_CRM_CAMPAIGN_ID_CAFE');

  console.log('\n/mentoria (não pode mudar)');
  const se = await postar('/mentoria');
  ok(!!se.rdm && se.rdm.body.includes('"conversion_identifier":"sessao-estrategica-consultoria"'), 'Sessão Estratégica continua na conversão dela');
  ok(se.todos.includes('"name":"[SE] Maria Teste"'), 'deal [SE] intacto');

  console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo verde');
  process.exit(falhas ? 1 : 0);
})();
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-ofertas-cafe.js`
Expected: `✗ RD Marketing recebe o identificador cafe-com-sevilha-site` (hoje vai `pre-inscricao-clube-da-performance`) e `✗ deal do CRM nasce marcado [CAFÉ]`. Os dois casos de `/mentoria` passam.

- [ ] **Step 3: Oferta em `api/leads.js`**

Logo abaixo do bloco `const AULA = { … };` (termina na linha 63) e antes do comentário `// Toda página nova da Sessão Estratégica…`, insira:

```js
// Café com Sevilha: encontro presencial, 6/10, para escritórios 10+. A página
// era uma LP do RD (identificador `cafe-com-sevilha`); o `-site` separa a
// conversão nova da automação que o RD ainda tem sobre a antiga.
const CAFE_COM_SEVILHA = {
  rotulo:      'Café com Sevilha',
  marca:       '[CAFÉ]',
  conversao:   'cafe-com-sevilha-site',
  tags:        ['cafe-com-sevilha', 'evento'],
  stageEnv:    'RD_CRM_STAGE_ID_CAFE',
  campaignEnv: 'RD_CRM_CAMPAIGN_ID_CAFE',
};
```

E no mapa `OFERTAS` acrescente a linha `'/cafe-com-sevilha': CAFE_COM_SEVILHA,` depois de `'/aula-gestao-operacional': AULA,`. Troque o comentário acima do mapa de "Toda página nova da Sessão Estratégica precisa entrar aqui." para "Toda página nova com oferta própria precisa entrar aqui."

- [ ] **Step 4: Rodar e ver passar**

Run: `node scripts/test-ofertas-cafe.js`
Expected: `tudo verde`. Rode também `node scripts/test-leads-capi.js` → `tudo verde` (caracterização do CAPI não muda).

- [ ] **Step 5: Grupo no painel (teste primeiro)**

Em `scripts/test-leads-unificados.js`, no array `supabase`, acrescente depois do item `id: 13`:

```js
  { id: 14, created_at: '2026-09-12T18:00:00+00:00', pagina: '/cafe-com-sevilha', email: 'e@x.com', telefone: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', colaboradores: 'De 20 a 29', cargo: 'Dono/Sócio' },
```

E ajuste as asserções que o lead novo muda — todas elas, para o teste continuar descrevendo a fixture:

- `assert.equal(r.total.leads, 4, 'a, b, c, d');` → `assert.equal(r.total.leads, 5, 'a, b, c, d, e');`
- `assert.equal(r.total.mql, 3, 'a (10-19), c (10-19), d (30-49)');` → `assert.equal(r.total.mql, 4, 'a (10-19), c (10-19), d (30-49), e (20-29)');`
- `assert.equal(dia12.leads, 1, 'c@x.com; …')` → `assert.equal(dia12.leads, 2, 'c@x.com e e@x.com (Café pela página); o Respondi do dia 12 era repetição de a@x.com');`
- `assert.equal(r.por_grupo.CAFE.leads, 1); assert.equal(r.por_grupo.CAFE.mql, 1);` → `assert.equal(r.por_grupo.CAFE.leads, 2, 'd pelo webhook, e pela página'); assert.equal(r.por_grupo.CAFE.mql, 2);`
- `assert.equal(r.por_formato.LP.leads, 2);` → confira o valor novo rodando o teste; a página é formato LP, então vira `3`.
- `assert.equal(r.qualificacao.cargo['Dono / Sócio'], 2);` → `3`.

E acrescente, logo depois da linha `assert.equal(cafe.grupo, 'CAFE', 'Café sem UTM cai no grupo pela fonte');`:

```js
assert.equal(r.por_pagina.find(p => p.pagina === '/cafe-com-sevilha').leads, 1, 'a página nova aparece por página');
```

(Um lead da página sem UTM só conta em `por_grupo.CAFE` se `GRUPO_POR_PAGINA` mapear — é isso que a asserção de `por_grupo.CAFE.leads` cobre.)

- [ ] **Step 6: Rodar e ver falhar**

Run: `node scripts/test-leads-unificados.js`
Expected: falha em `por_grupo.CAFE.leads` (hoje o lead `e@x.com` cai em `OUTROS`).

- [ ] **Step 7: Mapear a página**

Em `lib/leads-unificados.js`, no objeto `GRUPO_POR_PAGINA`, acrescente `'/cafe-com-sevilha': 'CAFE',` depois de `'/aula-gestao-operacional': 'AULA',`.

- [ ] **Step 8: Rodar e ver passar**

Run: `node scripts/test-leads-unificados.js`
Expected: `✓ leads-unificados`. Se alguma asserção numérica do Step 5 ainda divergir, corrija o número esperado para o que a fixture produz — e só esse número.

- [ ] **Step 9: Aviso do grupo no dashboard**

Em `assets/js/dash/grupo.js`, substitua o bloco `if (g === 'CAFE') { … }` inteiro por:

```js
    if (g === 'CAFE') {
      const pagina = leads && leads.por_pagina.find(p => p.pagina === '/cafe-com-sevilha');
      if (!leads || !pagina) return '☕ Leads do Café nascem em /cafe-com-sevilha (formulário do site, desde 15/09/2026). Antes disso a página era do RD e o webhook nunca entregou lead nenhum.';
      return `☕ Leads do Café vêm do formulário do site (/cafe-com-sevilha): ${D.fmtN(pagina.leads)} no período. Antes de 15/09/2026 a página era do RD e não entrava no painel.`;
    }
```

Em `dashboard.html`, troque `/assets/js/dash/grupo.js?v=dash-3` por `/assets/js/dash/grupo.js?v=dash-4` (só essa tag; `/assets` é servido como `immutable`).

- [ ] **Step 10: Ambiente documentado**

Em `.env.example`:

- linha `LEADS_SHEET_WRITE_PAGES=/mentoria,/mentoria-2` → `LEADS_SHEET_WRITE_PAGES=/mentoria,/mentoria-2,/cafe-com-sevilha`
- linha `PAGEVIEW_BEACON_PAGES=/mentoria,/mentoria-2` → `PAGEVIEW_BEACON_PAGES=/mentoria,/mentoria-2,/cafe-com-sevilha`
- ao final do bloco `# ── RD Station CRM por oferta ──…` (depois de `# RD_CRM_SOURCE_ID=`), acrescente:

```
# Café com Sevilha (/cafe-com-sevilha). Sem estes dois, o deal "[CAFÉ] Nome"
# cai na etapa padrão do Clube da Performance — distinguível, funil errado.
# RD CRM → Funis → funil do Café → id da etapa de entrada na URL.
# RD_CRM_STAGE_ID_CAFE=
# RD CRM → Campanhas → campanha do Café → id.
# RD_CRM_CAMPAIGN_ID_CAFE=
```

- [ ] **Step 11: Lint**

Run: `npm run lint 2>&1 | tail -15`
Expected: `0 errors`; contagem de avisos igual à que `npm run lint` mostrava antes da task (rode e anote no Step 1). Se `scripts/test-ofertas-cafe.js` disparar `quality/no-direct-console` como aviso, é o padrão dos outros testes — aceitável; erro não.

- [ ] **Step 12: Reportar** — arquivos tocados e saída dos três testes. Não commitar.

---

### Task 2: `form-steps.js` com destino `inline`, textos `cafe` e WhatsApp por `data-*`; beacon da página nova

**Files:**
- Modify: `assets/form-steps.js:44-65` (config), `:94-108` (`TEXTOS_POR_OFERTA`), `:310-324` (`mostrarSucesso`)
- Modify: `assets/tracking.js:323` (`PAGEVIEW_BEACON_PAGES`)
- Modify: `mentoria/index.html:72-73`, `mentoria-2/index.html:70-71`, `aula-gestao-operacional/index.html:342-343` (`?v=`)
- Modify: `scripts/test-form-passos.js:147-149` (Poppins condicional) e bloco final (checagens novas)

**Interfaces:**
- Produces: `<form id="sessao-form" data-destino="inline" data-textos="cafe" data-whatsapp="<url>">` → modal mostra `#form-success` sem redirecionar; textos do Café nos dois passos; `#wa-link` e `#err-wa` apontam para `data-whatsapp`. Sem atributos, comportamento idêntico ao de hoje.
- Produces: `PAGEVIEW_BEACON_PAGES` inclui `'/cafe-com-sevilha'` → `SP_marcar` e o beacon de visita funcionam na página nova.

- [ ] **Step 1: Checagens novas no teste (falham primeiro)**

Em `scripts/test-form-passos.js`, logo depois da linha `ok(/fora && !continuarLiberado/.test(js), …);` e antes de `console.log('\nassets/tracking.js — beacon');`, acrescente:

```js
/* ── Destino inline (Café): sucesso na tela, sem redirecionar ─────────── */
console.log('\nassets/form-steps.js — destino inline');
ok(/DESTINO === 'inline'/.test(js), "trata o destino 'inline'");
ok(/if \(DESTINO === 'inline'\) return;\n\s*setTimeout\(function \(\) \{ window\.location\.href = WHATSAPP_URL; \}/.test(js),
   "no destino inline, mostrarSucesso retorna ANTES do redirecionamento para o WhatsApp");
ok(/cafe: \{\n\s*1: \{/.test(js), 'TEXTOS_POR_OFERTA tem a entrada cafe');
ok(/form\.dataset\.whatsapp/.test(js), 'lê data-whatsapp do form (o link de erro e o de sucesso deixam de ser só da Sessão)');
```

E no bloco `assets/tracking.js — beacon`, depois de `ok(/PAGEVIEW_BEACON_PAGES = \[[^\]]*'\/aula-gestao-operacional'/.test(tr), 'página da aula no beacon');`:

```js
ok(/PAGEVIEW_BEACON_PAGES = \[[^\]]*'\/cafe-com-sevilha'/.test(tr), 'página do Café no beacon');
```

Troque também a checagem da Poppins (dentro do `for (const pagina of PAGINAS)`), de:

```js
  /* Poppins em dois pesos: cada peso a mais é um woff2 no caminho crítico. */
  const fonte = (html.match(/family=Poppins:wght@([\d;]+)/) || [])[1] || '';
  ok(fonte === '700;800', 'Poppins pedida em dois pesos', `pediu: ${fonte || '(nada)'}`);
```

para:

```js
  /* Poppins em dois pesos: cada peso a mais é um woff2 no caminho crítico.
     O Café não usa Poppins (título em Georgia, do sistema) — só as páginas
     que a pedem são policiadas. */
  if (html.includes('family=Poppins')) {
    const fonte = (html.match(/family=Poppins:wght@([\d;]+)/) || [])[1] || '';
    ok(fonte === '700;800', 'Poppins pedida em dois pesos', `pediu: ${fonte || '(nada)'}`);
  }
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-form-passos.js 2>&1 | tail -12`
Expected: as quatro checagens de `destino inline` e a do beacon do Café falham; o resto continua verde.

- [ ] **Step 3: `form-steps.js` — configuração por `data-*`**

Substitua o trecho (linhas 62-65):

```js
  /* Parametrização por data-* no <form>. Sem atributo, tudo se comporta como
     em /mentoria: WhatsApp no sucesso, textos da Sessão Estratégica. */
  var DESTINO = form.dataset.destino || 'whatsapp';   // 'whatsapp' | 'kiwify'
  var TEXTOS_ID = form.dataset.textos || 'sessao';
```

por:

```js
  /* Parametrização por data-* no <form>. Sem atributo, tudo se comporta como
     em /mentoria: WhatsApp no sucesso, textos da Sessão Estratégica.
       data-destino  'whatsapp' (padrão) | 'kiwify' | 'inline' (sucesso na tela, sem sair)
       data-textos   'sessao' (padrão) | 'aula' | 'cafe'
       data-whatsapp URL do WhatsApp da oferta (links de erro e de sucesso) */
  var DESTINO = form.dataset.destino || 'whatsapp';
  var TEXTOS_ID = form.dataset.textos || 'sessao';
  if (form.dataset.whatsapp) WHATSAPP_URL = form.dataset.whatsapp;
```

(`WHATSAPP_URL` é `var` declarado na linha 48 — reatribuir é válido.)

- [ ] **Step 4: `form-steps.js` — textos do Café**

Em `TEXTOS_POR_OFERTA`, depois da entrada `aula: { … },`, acrescente:

```js
    cafe: {
      1: { rotulo: 'Passo 1 de 2', titulo: 'Duas perguntas rápidas',
           sub: 'Elas definem se o Café com Sevilha é o formato certo para o seu escritório.' },
      2: { rotulo: 'Passo 2 de 2', titulo: 'Onde falamos com você',
           sub: 'Nossa equipe entra em contato com as próximas informações do encontro.' },
    },
```

- [ ] **Step 5: `form-steps.js` — destino inline**

Em `mostrarSucesso()`, entre o bloco `if (DESTINO === 'kiwify') { … return; }` e a linha `setTimeout(function () { window.location.href = WHATSAPP_URL; }, 2500);`, insira:

```js
    // Café: a confirmação fica na tela. Não há reunião para agendar nem
    // pagamento para abrir — o time é quem chama.
    if (DESTINO === 'inline') return;
```

A regex do teste exige exatamente `if (DESTINO === 'inline') return;` seguido, na linha seguinte, do `setTimeout(function () { window.location.href = WHATSAPP_URL; }` — o comentário vai ANTES do `if`, não entre ele e o `setTimeout`.

- [ ] **Step 6: `tracking.js` — beacon**

Linha 323: `var PAGEVIEW_BEACON_PAGES = ['/mentoria', '/mentoria-2', '/aula-gestao-operacional'];` → `var PAGEVIEW_BEACON_PAGES = ['/mentoria', '/mentoria-2', '/aula-gestao-operacional', '/cafe-com-sevilha'];`

- [ ] **Step 7: Subir o `?v=` nas páginas que carregam os dois arquivos**

Nos três arquivos — `mentoria/index.html` (linhas 72-73), `mentoria-2/index.html` (70-71), `aula-gestao-operacional/index.html` (342-343) — troque `tracking.js?v=6` por `tracking.js?v=7` e `form-steps.js?v=2` por `form-steps.js?v=3`. `index.html` e `pre-inscricao-*` ficam em `?v=4` (não estão no beacon; a aula também não os mexeu).

- [ ] **Step 8: Rodar e ver passar**

Run: `node scripts/test-form-passos.js 2>&1 | tail -12`
Expected: `OK — contrato do formulário de dois passos íntegro.`

- [ ] **Step 9: Lint**

Run: `npm run lint 2>&1 | tail -8`
Expected: `0 errors`, avisos sem crescer. `assets/form-steps.js` precisa continuar ≤ 350 linhas (`wc -l assets/form-steps.js`).

- [ ] **Step 10: Reportar** — diff resumido e saída do teste. Não commitar.

---

### Task 3: Página `/cafe-com-sevilha` e assets

**Files:**
- Create: `cafe-com-sevilha/index.html`
- Create: `cafe-com-sevilha/cafe.css`
- Create: `assets/cafe-socios.webp` (foto dos sócios, 1448×1086, alpha)
- Create: `assets/og-cafe.png` (1200×630)

**Interfaces:**
- Consumes (Task 2): `<form data-destino="inline" data-textos="cafe" data-whatsapp="…">`; `.open-modal` abre o modal; `class="btn open-modal"` precisa existir ao menos uma vez (o teste procura essa string).
- Consumes (Task 1): `pagina` = `/cafe-com-sevilha` no campo oculto.
- Produces: a página que a Task 4 põe em `PAGINAS` de `scripts/test-form-passos.js`.

Referência visual: screenshot da original em
`/private/tmp/claude-501/-Users-thaleslorenzo-Documents-GitHub-Sevilha-Perfomance/d5b47855-5249-4e12-ad84-6b281fb04823/scratchpad/original-desktop.png` (1440 de largura). Leia antes de escrever CSS. Fonte da foto: `…/scratchpad/socios.png`.

- [ ] **Step 1: Assets**

```bash
S=/private/tmp/claude-501/-Users-thaleslorenzo-Documents-GitHub-Sevilha-Perfomance/d5b47855-5249-4e12-ad84-6b281fb04823/scratchpad
ffmpeg -y -loglevel error -i "$S/socios.png" -c:v libwebp -quality 82 -pix_fmt yuva420p assets/cafe-socios.webp
ffmpeg -y -loglevel error -f lavfi -i color=c=0x0a2033:s=1200x630 -i "$S/socios.png" -i assets/logo-sevilha-performance.png \
  -filter_complex "[1]scale=-1:600[p];[2]scale=300:-1[l];[0][p]overlay=W-w-40:H-h[b];[b][l]overlay=60:60" \
  -frames:v 1 assets/og-cafe.png
ls -la assets/cafe-socios.webp assets/og-cafe.png
```

Expected: `cafe-socios.webp` bem menor que 1 MB (o PNG tem ~1.4 MB) e `og-cafe.png` 1200×630 (`sips -g pixelWidth -g pixelHeight assets/og-cafe.png`). Abra os dois com a ferramenta de leitura de imagem e confira: a foto manteve a transparência (fundo navy, sem quadrado branco) e o OG tem logo à esquerda e os três à direita. Se o libwebp não existir no ffmpeg, use `sips -s format webp "$S/socios.png" --out assets/cafe-socios.webp`.

- [ ] **Step 2: `cafe-com-sevilha/index.html` — head e Pixel**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Café com Sevilha — 6 de outubro, São Paulo | Sevilha Performance</title>
  <meta name="description" content="Encontro presencial de um dia entre donos e sócios de contabilidades com mais de 10 colaboradores. Estratégia, processos e pessoas com Vicente Sevilha, Bruno Silvestre e Rodrigo Pires. Sede da Sevilha Contabilidade, São Paulo.">
  <link rel="canonical" href="https://sevilha-perfomance.vercel.app/cafe-com-sevilha">
  <link rel="icon" href="/assets/logo-sevilha.svg" type="image/svg+xml">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Café com Sevilha — 6 de outubro, São Paulo">
  <meta property="og:description" content="Um dia entre líderes que estão construindo o futuro da contabilidade. Para donos e sócios de escritórios com mais de 10 colaboradores.">
  <meta property="og:image" content="https://sevilha-perfomance.vercel.app/assets/og-cafe.png">
  <meta property="og:url" content="https://sevilha-perfomance.vercel.app/cafe-com-sevilha">
  <meta property="og:locale" content="pt_BR">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="preload" as="image" href="/assets/cafe-socios.webp" fetchpriority="high">
  <link rel="stylesheet" href="/cafe-com-sevilha/cafe.css?v=1">
```

Depois disso, cole o bloco do Pixel **exatamente** como está em `aula-gestao-operacional/index.html` linhas 30-64 (do comentário `<!-- Meta Pixel Code` até `<!-- End Meta Pixel Code -->`), sem alterar o id `657178423444244` nem o guarda `_sp_interno`. Feche o `</head>`.

- [ ] **Step 3: `index.html` — corpo, com a copy exata**

Estrutura e textos. Tudo que está entre aspas é literal; classes são sugestão, mantenha as que os testes exigem (`btn open-modal`, `open-modal`).

```html
<body>
<header class="wrap topo">
  <a href="#topo" class="logo"><img src="/assets/logo-sevilha-performance.png" alt="Sevilha Performance" width="150" height="48"></a>
  <button type="button" class="btn btn-ghost open-modal">Manifestar interesse</button>
</header>

<main id="topo">

<!-- 1. Hero -->
<section class="hero"><div class="wrap hero-grid">
  <div class="hero-copy">
    <p class="kicker">Encontro presencial • São Paulo</p>
    <h1>Um dia entre líderes que estão construindo o futuro da contabilidade.</h1>
    <p class="lead">Estratégia, processos e pessoas debatidos com profundidade, proximidade e experiência prática por quem vive a gestão de escritórios contábeis.</p>
    <dl class="fatos">
      <div><dt>06 OUT</dt><dd>São Paulo, SP</dd></div>
      <div><dt>1 DIA</dt><dd>Sede da Sevilha Contabilidade</dd></div>
      <div><dt>+10</dt><dd>Colaboradores na equipe</dd></div>
    </dl>
    <button type="button" class="btn open-modal">Quero manifestar interesse <span aria-hidden="true">↗</span></button>
  </div>
  <figure class="hero-foto">
    <img src="/assets/cafe-socios.webp" alt="Bruno Silvestre, Vicente Sevilha e Rodrigo Pires" width="1448" height="1086" fetchpriority="high" decoding="async">
    <figcaption><span>Bruno Silvestre</span><span>Vicente Sevilha</span><span>Rodrigo Pires</span></figcaption>
  </figure>
</div></section>

<!-- 2. Uma mesa pequena -->
<section class="mesa light"><div class="wrap duas-colunas">
  <div>
    <p class="kicker">Café, conversa e gestão de verdade</p>
    <h2>Uma mesa pequena para conversas grandes.</h2>
  </div>
  <div class="prosa">
    <p>O Café com Sevilha reúne donos e sócios de contabilidades com mais de 10 colaboradores para um encontro presencial de troca, reflexão e aplicação.</p>
    <p>Na sede da Sevilha Contabilidade, você terá contato direto com experiências e métodos que conectam estratégia, processos e pessoas à realidade de uma empresa contábil.</p>
  </div>
</div></section>

<!-- 3. Três perspectivas -->
<section class="perspectivas navy"><div class="wrap">
  <div class="duas-colunas">
    <div>
      <p class="kicker">O que estará na mesa</p>
      <h2>Três perspectivas.<br>Uma gestão mais consistente.</h2>
    </div>
    <p class="prosa">Um dia para sair da rotina operacional, olhar o negócio com clareza e compartilhar decisões com líderes que enfrentam desafios semelhantes.</p>
  </div>
  <ol class="pilares">
    <li><span class="num">01</span><h3>Estratégia</h3><p>Direcionamento, posicionamento e escolhas que criam crescimento sustentável.</p><p class="com">com Vicente Sevilha</p></li>
    <li><span class="num">02</span><h3>Processos</h3><p>Ritmo de gestão, eficiência operacional e processos que sustentam a escala.</p><p class="com">com Bruno Silvestre</p></li>
    <li><span class="num">03</span><h3>Pessoas</h3><p>Liderança, estrutura e desenvolvimento de equipes que assumem responsabilidades.</p><p class="com">com Rodrigo Pires</p></li>
  </ol>
  <p class="cta-linha"><button type="button" class="btn open-modal">Quero manifestar interesse</button></p>
</div></section>

<!-- 4. Por que participar -->
<section class="porque cream"><div class="wrap">
  <p class="kicker">Por que participar</p>
  <h2>Um encontro desenhado para quem toma decisões.</h2>
  <ol class="motivos">
    <li><span class="num">01</span><p>Trocar experiências com outros donos e sócios de escritórios contábeis.</p></li>
    <li><span class="num">02</span><p>Discutir desafios reais de crescimento, estrutura e liderança.</p></li>
    <li><span class="num">03</span><p>Conhecer métodos aplicados em estratégia, processos e pessoas.</p></li>
    <li><span class="num">04</span><p>Construir novas referências para as próximas decisões do seu negócio.</p></li>
  </ol>
  <p class="cta-linha"><button type="button" class="btn open-modal">Quero manifestar interesse</button></p>
</div></section>

<!-- 5. Reserve o dia -->
<section class="reserve navy"><div class="wrap duas-colunas">
  <div>
    <img src="/assets/logo-sevilha-performance.png" alt="" width="150" height="48" class="logo-secao">
    <h2>Reserve o dia.<br>A conversa começa<br>ao redor da mesa.</h2>
    <p class="cta-linha"><button type="button" class="btn open-modal">Quero manifestar interesse</button></p>
  </div>
  <dl class="ficha">
    <div><dt>Data</dt><dd>6 de outubro</dd></div>
    <div><dt>Local</dt><dd>Sede da Sevilha Contabilidade<small>São Paulo, SP</small></dd></div>
    <div><dt>Formato</dt><dd>Encontro presencial de um dia</dd></div>
    <div><dt>Para quem</dt><dd>Donos e sócios de contabilidades<small>Empresas com mais de 10 colaboradores</small></dd></div>
  </dl>
</div></section>

<!-- 6. Interesse -->
<section class="interesse teal" id="interesse"><div class="wrap">
  <p class="kicker">6 de outubro • São Paulo</p>
  <h2>Manifeste seu interesse no Café com Sevilha.</h2>
  <p class="prosa">Clique abaixo e responda duas perguntas rápidas. Nossa equipe entrará em contato com as próximas informações.</p>
  <button type="button" class="btn btn-navy btn-grande open-modal">Quero participar!</button>
</div></section>

</main>

<footer class="wrap rodape">
  <img src="/assets/logo-sevilha-performance.png" alt="Sevilha Performance" width="110" height="35">
  <p>© Sevilha Performance. Todos os direitos reservados.</p>
</footer>

<a class="wa-flutuante" href="https://wa.me/5531999491532?text=Ol%C3%A1!%20Quero%20manifestar%20interesse%20no%20Caf%C3%A9%20com%20Sevilha." target="_blank" rel="noopener" aria-label="Abrir WhatsApp">
  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 0 1 0 16.4c-1.5 0-2.9-.4-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.2 4.4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.4 1 2.9.8 3.5.7.5-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.2-.7.1l-1 1.2c-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.5z"/></svg>
</a>
```

- [ ] **Step 4: `index.html` — modal**

Cole o modal de `aula-gestao-operacional/index.html` (linhas 191-322, do comentário `<!-- Modal copiado…` até o `</div>` que fecha `#modal-overlay`) e faça **só** estas trocas:

1. `<form id="sessao-form" onsubmit="submitForm(event)" data-destino="kiwify" data-textos="aula">` → `<form id="sessao-form" onsubmit="submitForm(event)" data-destino="inline" data-textos="cafe" data-whatsapp="https://wa.me/5531999491532?text=Ol%C3%A1!%20Quero%20manifestar%20interesse%20no%20Caf%C3%A9%20com%20Sevilha.">`
2. `#modal-title` inicial: "Duas perguntas rápidas"; `#modal-sub` inicial: "Elas definem se o Café com Sevilha é o formato certo para o seu escritório."
3. `#route-porte`: `<strong>O Café é para escritórios com mais de 10 colaboradores.</strong> Para o seu porte, o Clube da Performance é o caminho certo.` — links: "Conhecer o Clube da Performance" (`#clube-link`) e "Continuar mesmo assim" (`#route-continuar`).
4. `.dica` do cargo: "O Café é pensado para quem decide."
5. `#route-cargo`: `<strong>O Café é pensado para quem decide.</strong> Se o dono ou sócio for participar, cadastre em nome dele.`
6. Remova o `<div class="trust">…</div>` inteiro (era preço/gravação da aula).
7. `#form-error`: `<strong>Não conseguimos enviar agora.</strong> A conexão falhou. Tente de novo ou fale direto com a gente: <a href="#" id="err-wa">abrir o WhatsApp</a>.` (igual à aula — mantém).
8. Campo oculto: `<input type="hidden" name="pagina" value="/cafe-com-sevilha" />`.
9. `#submit-btn`: "Quero participar!"; `.form-privacy`: "Sem spam. Só o contato sobre o Café com Sevilha."
10. `#form-success`: h2 "Recebemos seu interesse." ; `<p class="modal-sub">Nossa equipe entra em contato com as próximas informações do encontro.</p>` ; `<a id="wa-link" href="#" class="btn btn-ghost">Falar no WhatsApp</a>` (sem `hidden`).

Feche o `<body>` com:

```html
<script src="/assets/tracking.js?v=7" defer></script>
<script src="/assets/form-steps.js?v=3" defer></script>
</body>
</html>
```

Não há `<script>` inline de comportamento nesta página: tudo mora nos dois assets.

- [ ] **Step 5: `cafe.css`**

Escreva o CSS do zero para este mundo visual (não copie o `aula.css`, que é navy/verde/Poppins). Requisitos — o resto é craft seu:

- `:root` com os tokens do Global Constraints; `body { background: var(--navy); color: #fff; font: 400 1rem/1.6 Inter, system-ui, sans-serif; }`. Seções `.light`/`.cream` trocam `color` para `var(--ink)`; `.teal` usa `background: var(--teal)` com texto navy.
- `h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; font-weight: 500; letter-spacing: -.01em; }`; h1 `clamp(2.4rem, 5vw, 4.5rem)` com `line-height: 1`; h2 `clamp(1.9rem, 3.2vw, 2.75rem)` com `line-height: 1.1`; h3 1.35rem. `.kicker { font: 600 .72rem/1 Inter; letter-spacing: .14em; text-transform: uppercase; color: var(--teal-soft); }` — em seção clara/creme, `color: var(--teal-ink)`.
- `.wrap { max-width: 1160px; margin: 0 auto; padding: 0 20px; }`. Seções com `padding: clamp(56px, 9vw, 112px) 0`.
- Hero: grade `1.05fr .95fr` acima de 900px, uma coluna abaixo (foto depois do texto). `.hero-foto img { width: 100%; height: auto; }`. `figcaption` = três nomes em linha, `.72rem`, caixa alta, `letter-spacing: .12em`, distribuídos com `justify-content: space-between`.
- `.fatos`: três colunas; `dt` em Inter 700 `1.05rem` teal-soft; `dd` `.8rem` muted-claro.
- `.btn`: `display: inline-flex; align-items: center; gap: .5rem; min-height: 48px; padding: .85rem 1.5rem; border-radius: 8px; background: var(--teal); color: var(--navy-deep); font: 700 .95rem Inter; border: 0; cursor: pointer;` hover escurece (`filter: brightness(.94)`) e sobe 1px; `.btn-ghost` = fundo transparente, borda `1px solid rgba(255,255,255,.35)`, texto branco (sobre navy) — no `#form-success`, que é branco, dê `color: var(--teal-ink); border-color: var(--teal-ink)`; `.btn-navy` = fundo navy, texto branco; `.btn-grande` = `min-height: 56px; padding: 1rem 2.2rem; font-size: 1.05rem`. Foco: `.btn:focus-visible, .wa-flutuante:focus-visible, a:focus-visible { outline: 3px solid var(--teal-soft); outline-offset: 3px; }` — em fundo claro `outline-color: var(--teal-ink)`.
- `.pilares`: três colunas separadas por `border-left: 1px solid rgba(255,255,255,.12)`, `padding-left: 24px`; `.num` teal-soft `.75rem`; `.com` teal-soft 600 `.85rem`. Abaixo de 760px, uma coluna com `border-left` mantido.
- `.motivos`: grade 2×2 com linhas `1px solid rgba(10,32,51,.12)` entre os itens; `.num` teal-ink 700. Uma coluna abaixo de 640px.
- `.ficha`: filete `border-top: 3px solid var(--teal)`; cada `div` com `padding: 18px 0; border-bottom: 1px solid rgba(255,255,255,.12)`; `dt` = kicker; `dd` = Georgia 1.25rem; `small` = bloco `.85rem` muted-claro.
- `.rodape`: flex, logo + texto `.8rem`, `padding: 32px 20px`, `border-top: 1px solid rgba(255,255,255,.1)`.
- `.wa-flutuante`: fixo, `right: 20px; bottom: 20px; width: 56px; height: 56px; border-radius: 50%; background: #25d366; color: #fff; display: grid; place-items: center; box-shadow: 0 8px 24px rgba(0,0,0,.35); z-index: 40;`.
- **Modal**: copie a estrutura funcional do `aula.css` linhas 93-177 (`.modal-overlay`, `.modal`, cadeia flex com `min-height: 0`, `.modal-head/.modal-body/.modal-foot`, `.modal-close`, `.passo-rotulo`, `.grupo`, `.opcoes` com input escondido + label-pílula, `.opcoes input:checked + label`, `.opcoes input:focus-visible + label { outline }`, `.voltar`, `.route`, `.form-error`, `.form-group`, `.form-success`, `.form-privacy`) **trocando as cores**: pílula marcada = `background: var(--navy); color: #fff; border-color: var(--navy)`; hover = `border-color: var(--teal)`; foco = `outline: 3px solid var(--teal-ink)`; `.route` fica creme (`background: var(--cream); border: 1px solid #e3d7bf; color: var(--ink)`) e o link principal de `.route-acoes` teal-ink; `.modal` branco com `border-radius: 20px`, título Georgia; `.btn-full { width: 100% }`. O modal precisa de `max-height: calc(100dvh - 32px)` e `overflow` só no `.modal-body`.
- Movimento: só dentro de `@media (prefers-reduced-motion: no-preference)` — `.btn { transition: transform .15s, filter .15s }`, `.modal-overlay.open .modal { animation: sobe .22s ease-out }` com `@keyframes sobe { from { transform: translateY(12px) } }` (sem `opacity: 0` de partida).
- Responsivo obrigatório: nada de overflow horizontal em 390px; `img { max-width: 100%; height: auto; }`; `.hero-copy .btn` vira `width: 100%` abaixo de 480px; `.topo` mantém logo + botão na mesma linha (botão pode encolher para `padding: .7rem 1rem`).

- [ ] **Step 6: Servir estático e conferir no agent-browser**

O `/api/leads` não sobe aqui (isso é a Task 4); o que se confere é layout, modal e console.

```bash
python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix cafe)"
agent-browser open http://127.0.0.1:8765/cafe-com-sevilha/
agent-browser wait --load networkidle
agent-browser set viewport 1440 900
agent-browser screenshot --full .impeccable/review/cafe-desktop.png
agent-browser set viewport 390 844
agent-browser screenshot --full .impeccable/review/cafe-mobile.png
agent-browser set viewport 1440 900
agent-browser snapshot -i
```

Leia os dois PNGs. Compare com `original-desktop.png`: mesma ordem de seções, mesmas cores por seção, foto com blob visível, títulos serifados. Depois, pelo snapshot, clique no botão "Quero manifestar interesse" da seção "Três perspectivas" (o do meio da página), `agent-browser snapshot -i`, clique em "5 a 9" → o `#route-porte` deve aparecer; clique em "Continuar mesmo assim", depois "Dono ou sócio" → passo 2 com os campos e o botão "Quero participar!". Screenshot do modal em 390×844 (`.impeccable/review/cafe-modal-mobile.png`) — o botão de enviar precisa estar visível sem rolar a página inteira.

```bash
agent-browser console
agent-browser a11y
agent-browser eval 'document.documentElement.scrollWidth <= window.innerWidth'
agent-browser close
kill %1
```

Expected: console sem erro (o `fbevents.js` pode falhar por rede — isso não é erro da página; `/api/pageview` 404 é esperado no estático), `a11y` sem violação, `eval` → `true` em 390 e em 1440.

- [ ] **Step 7: Detector do impeccable**

Run: `node /Users/thaleslorenzo/.claude/skills/impeccable/scripts/detect.mjs --json cafe-com-sevilha/index.html cafe-com-sevilha/cafe.css 2>&1 | head -60`
Expected: sem achado de severidade alta. Corrija o que apontar e rode uma segunda vez no máximo.

- [ ] **Step 8: Lint**

Run: `npm run lint 2>&1 | tail -8 && npm run lint:biome 2>&1 | tail -5`
Expected: `0 errors`.

- [ ] **Step 9: Reportar** — caminhos das capturas, achados corrigidos, o que ficou. Não commitar.

---

### Task 4: Integração, verificação ponta a ponta e documentação

**Files:**
- Modify: `scripts/test-form-passos.js:31` (`PAGINAS`)
- Modify: `PRODUCT.md` (tabela de ofertas) e `DESIGN.md` (tabela de superfícies)
- Capturas: `.impeccable/review/`

**Interfaces:**
- Consumes: tudo das Tasks 1-3.

- [ ] **Step 1: Página no contrato do modal**

Em `scripts/test-form-passos.js`, linha 31: `const PAGINAS = ['mentoria/index.html', 'mentoria-2/index.html', 'aula-gestao-operacional/index.html'];` → acrescente `'cafe-com-sevilha/index.html'` ao final do array.

- [ ] **Step 2: Todos os verificadores**

```bash
node scripts/test-form-passos.js 2>&1 | tail -6
node scripts/test-ofertas-cafe.js
node scripts/test-leads-unificados.js
node scripts/test-leads-capi.js | tail -2
node scripts/test-porte.js | tail -1
node scripts/test-pageview.js | tail -1
npm run lint 2>&1 | tail -8
npm run lint:biome 2>&1 | tail -4
```

Expected: tudo verde; `0 errors` nos dois lints. O `test-form-passos.js` precisa imprimir o bloco `cafe-com-sevilha/index.html` com todos os `✓` (ids, contrato, ramo `data-destino` sem chips e com `.btn.open-modal`, `passo-2` e `modal-foot` escondidos, rádios sem `required`, `escritorio` opcional, mesmas faixas que `/mentoria`).

- [ ] **Step 3: Ponta a ponta com `vercel dev`**

`.env.local` do worktree tem os tokens de produção (copiado do checkout principal). O envio grava em Supabase, planilha, RD e Meta de verdade — use dados marcados como teste e limpe depois.

```bash
npx vercel dev --listen 3000 > /private/tmp/claude-501/vercel-dev.log 2>&1 &
sleep 8; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/cafe-com-sevilha
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix cafe-e2e)"
agent-browser open "http://localhost:3000/cafe-com-sevilha?utm_source=teste&utm_campaign=%5BCAF%C3%89%5D%20e2e&sp_interno=1"
agent-browser wait --load networkidle
agent-browser snapshot -i
```

Fluxo: clique em "Quero participar!" (o botão da faixa `#interesse`), `snapshot -i`, "10 a 19", "Dono ou sócio", preencha `#f-name` = "Teste Café E2E", `#f-phone` = "31999990001", `#f-email` = "teste-cafe-e2e@example.com", `#f-escritorio` = "Escritório Teste", clique em "Quero participar!" (`#submit-btn`), `agent-browser wait --text "Recebemos seu interesse"`.

```bash
agent-browser network requests | grep -E "api/leads|api/pageview"
agent-browser screenshot .impeccable/review/cafe-sucesso.png
agent-browser close
grep -E "Supabase OK|RD Marketing|RD CRM|CAPI|LeadQualificado" /private/tmp/claude-501/vercel-dev.log | tail -12
```

Expected: `POST /api/leads` 200; log com `[Supabase OK] lead salvo — pagina=/cafe-com-sevilha`, `[RD CRM] deal … ` (ou aviso `RD_CRM_STAGE_ID_CAFE não definido — deal [CAFÉ] cai no stage padrão`, que é o estado esperado enquanto o cliente não manda os ids), evento `Lead` aceito pela CAPI, `LeadQualificado` enviado (faixa 10-19). Confira a linha no banco com a ferramenta do Supabase (`select pagina, utm_campaign, cargo, colaboradores, event_id from sevilha_leads where email='teste-cafe-e2e@example.com'`). A página `#form-success` fica na tela — não pode ter redirecionado para o WhatsApp.

- [ ] **Step 4: Limpeza**

Run: `node scripts/purge-test-leads.js` (dry-run; confira que só o lead `teste-cafe-e2e@example.com` — e nada real — aparece), depois `node scripts/purge-test-leads.js --commit`. Se o deal `[CAFÉ] Teste Café E2E` foi criado no CRM, apague pela interface ou por `DELETE_AFTER`-equivalente do `scripts/test-api-leads-e2e.js` (leia o script antes). Derrube o `vercel dev` (`kill %1`).

- [ ] **Step 5: Documentos de produto e design**

`PRODUCT.md`, tabela "Duas ofertas dividem o mesmo repositório" — acrescente uma coluna/linha para o Café (siga o formato que a aula paga já acrescentou; se a tabela virou lista, siga a lista):

| | Café com Sevilha |
|---|---|
| O que é | Encontro presencial de um dia, 6/10/2026, sede da Sevilha Contabilidade (SP) |
| Público | Donos e sócios de escritórios com **mais de 10** colaboradores |
| Quem conduz | Vicente Sevilha, Bruno Silvestre e Rodrigo Pires |
| Páginas | `/cafe-com-sevilha` |
| Destino | Time entra em contato (sem WhatsApp automático) |
| Marca no CRM | deal prefixado `[CAFÉ]` |

E em "Restrições técnicas", na frase sobre `PAGEVIEW_BEACON_PAGES`/`LEADS_SHEET_WRITE_PAGES`, nada muda (já é regra geral).

`DESIGN.md`, tabela "Superfícies": linha `| /cafe-com-sevilha | Persuade | Réplica da LP do RD: navy/teal/creme, Georgia nos títulos, modal de dois passos por data-destino="inline" |`. E no bloco "Tokens", uma nota de uma linha: "O Café tem paleta própria (ver `cafe-com-sevilha/cafe.css`): navy `#0a2033`, teal `#20a2a8`, creme `#f2ebdd` — é a identidade do evento, não a do site."

- [ ] **Step 6: Reportar** — saída dos testes, caminhos das capturas, o que o log do `vercel dev` mostrou para cada integração, e a lista de pendências do cliente (ids do CRM, envs na Vercel, troca de URL nos anúncios). Não commitar.

---

## Depois do plano (orquestrador)

1. Commit por task (`/usr/bin/git` no worktree): `feat(leads): oferta [CAFÉ] …`, `feat(form): destino inline e textos do Café …`, `feat(cafe): página /cafe-com-sevilha …`, `test+docs: Café no contrato do modal, PRODUCT e DESIGN`.
2. Envs na Vercel (produção): `PAGEVIEW_BEACON_PAGES`, `LEADS_SHEET_WRITE_PAGES` com `/cafe-com-sevilha`; `RD_CRM_STAGE_ID_CAFE`, `RD_CRM_CAMPAIGN_ID_CAFE` quando o cliente mandar.
3. Push do branch, PR para `main`, conferir a página no deploy de preview e em produção (agent-browser), e só então trocar a URL nos anúncios.
