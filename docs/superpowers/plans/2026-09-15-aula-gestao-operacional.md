# Aula paga "Gestão Operacional" — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar no ar `/aula-gestao-operacional` (página de vendas da aula de R$ 47), com lead capturado antes do checkout Kiwify, `Lead`/`InitiateCheckout`/`Purchase` no Meta por Pixel + CAPI, e uma aba "Aula paga" no dashboard com o grupo `AULA` em todo o pipeline.

**Architecture:** Página estática nova reaproveita o modal de dois passos (`assets/form-steps.js`) parametrizado por `data-*`, e o pipeline de lead existente (`/api/leads`) com uma oferta `[AULA]`. O webhook da Kiwify entra por rewrite numa function existente (`api/eventos-qualificados.js`, padrão do `crm-webhook`) porque o plano Hobby está em 12/12 functions. O grupo `AULA` é acrescentado onde `SE`/`CP`/`CAFE` já existem (`lib/meta.js`, `api/meta.js`, `lib/leads-unificados.js`, `api/rd-stats.js`, `assets/js/dash/*`).

**Tech Stack:** HTML/CSS estático, JS vanilla no browser, Node (CommonJS) serverless na Vercel, Supabase via PostgREST (`fetch`), Meta CAPI (`lib/capi.js`), RD Station CRM API v1, Chart.js 4 no dashboard. Testes: scripts Node avulsos em `scripts/test-*.js` (padrão `ok()`/`falhas`, `process.exit(falhas ? 1 : 0)`), `fetch` global stubado.

**Spec:** `docs/superpowers/specs/2026-09-15-aula-gestao-operacional-design.md`

## Global Constraints

- Vercel Hobby: **máximo 12 serverless functions** e `api/` já tem 12 arquivos. Nenhum arquivo novo em `api/`.
- Teto de **350 linhas por arquivo** (`quality/max-lines`) em arquivo novo; `api/leads.js` já passa do teto e está na linha de base — só acréscimos mínimos lá.
- `npm run lint` e `npm run lint:biome` sem novo erro; avisos não podem crescer além da linha de base do `CLAUDE.md`.
- Copy: nada de depoimento/case/logo, preço âncora, promessa de resultado em prazo, "sócio" para o Bruno, contador de vagas. Público **10+ colaboradores escrito na página**.
- Layout: sem tag/eyebrow acima do H1; sem caixa alta em corpo; foco com `outline`; sem gradiente roxo/rosa; sem borda lateral colorida em cartão; sem ícone decorativo; números com `font-variant-numeric: tabular-nums`.
- Tokens: `--roxo #150C43`, `--neon #50DC00`, fundo claro `#f3f1fa`, borda `#e2def2`; Poppins 700/800 + Inter.
- `name=` dos campos do formulário é contrato com `/api/leads`: `colaboradores`, `cargo`, `nome`, `email`, `telefone`, `escritorio`, `pagina` + ocultos de tracking.
- `assets/form-steps.js` está em teste A/B em `/mentoria` e `/mentoria-2`: **sem `data-*` o comportamento é idêntico ao atual**.
- Nunca `META_TEST_EVENT_CODE` definido em produção. Pixel nativo da Kiwify desligado.
- CSS/JS em `/assets` são `immutable`: mudança em `tracking.js`, `form-steps.js` e nos assets do dashboard exige subir o `?v=` nas páginas (`dash-2` → `dash-3`).
- Segredos nunca no chat nem em arquivo versionado; `.env.example` só com chave vazia e comentário de onde buscar.
- Commits um por task, feitos pelo orquestrador, mensagem em português no padrão `tipo(escopo): descrição`.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `sql/compras-aula.sql` (novo) | tabela `sevilha_compras_aula` | 1 |
| `vercel.json` | rewrites da página, do obrigado e do webhook | 1 |
| `.env.example` | envs novas documentadas | 1 |
| `api/leads.js` | oferta `[AULA]`, `InitiateCheckout` CAPI | 2 |
| `scripts/test-leads-aula.js` (novo) | prova os dois eventos | 2 |
| `lib/kiwify.js` (novo) | webhook: assinatura, upsert, `Purchase`, stage do CRM | 3 |
| `api/eventos-qualificados.js` | despacho `kiwify-webhook` | 3 |
| `scripts/test-kiwify-webhook.js` (novo) | contrato do webhook | 3 |
| `assets/form-steps.js` | `data-destino`, `data-textos`, `data-aviso-porte` | 4 |
| `assets/tracking.js` | página nova no beacon | 4 |
| `scripts/test-form-passos.js` | contrato estendido | 4 |
| `aula-gestao-operacional/index.html`, `aula.css`, `obrigado/index.html` (novos) | a página | 5 |
| `scripts/og-aula.py` (novo) → `assets/og-aula.png` | imagem OG | 5 |
| `lib/meta.js`, `api/meta.js`, `lib/resumo.js`, `lib/leads-unificados.js`, `api/rd-stats.js` | grupo `AULA` + `compras` | 6 |
| `scripts/test-grupo-aula.js` (novo) | classificação e agregado | 6 |
| `dashboard.html`, `assets/js/dash/{main,grupo,executivo}.js`, `assets/js/dash/aula.js` (novo) | aba "Aula paga" | 7 |
| `scripts/test-dash-aula.js` (novo) | contrato da aba | 7 |

Ondas para execução paralela (escopos disjuntos): **Onda 1** = Tasks 1, 2, 3, 4, 6 · **Onda 2** = Task 5 (depende de 4) e Task 7 (depende de 6) · **Onda 3** = Task 8 (validação, depende de tudo).

---

### Task 1: Tabela, rotas e envs

**Files:**
- Create: `sql/compras-aula.sql`
- Modify: `vercel.json` (bloco `rewrites`, antes de `"source": "/api/(.*)"`)
- Modify: `.env.example` (final do arquivo)

**Interfaces:**
- Produces: tabela `sevilha_compras_aula` (colunas abaixo) usada pelas Tasks 3 e 6; rotas `/aula-gestao-operacional`, `/aula-gestao-operacional/obrigado`, `/api/kiwify-webhook`; envs `KIWIFY_WEBHOOK_TOKEN`, `RD_CRM_STAGE_ID_AULA`, `RD_CRM_STAGE_ID_AULA_PAGO`, `RD_CRM_CAMPAIGN_ID_AULA`, `RD_CRM_PIPELINE_ID_AULA`.

- [ ] **Step 1: Criar `sql/compras-aula.sql`**

```sql
-- Compras da aula paga (webhook da Kiwify). Projeto Lorenzo Media,
-- convenção <cliente>_<dominio>. Aplicar no SQL Editor do Supabase.
create table if not exists sevilha_compras_aula (
  order_id        text primary key,
  status          text not null,               -- paid | refunded
  email           text,
  nome            text,
  telefone        text,
  valor_centavos  integer not null,
  sck             text,                        -- event_id do lead (vem do checkout)
  lead_id         uuid,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  capi_status     text,                        -- ok | erro:<motivo> | pendente
  crm_status      text,                        -- ok | sem-deal | erro:<motivo>
  pago_em         timestamptz,
  payload         jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists sevilha_compras_aula_pago_em on sevilha_compras_aula (pago_em);
create index if not exists sevilha_compras_aula_email on sevilha_compras_aula (lower(email));
```

- [ ] **Step 2: Aplicar a tabela no Supabase**

Use o MCP do Supabase (`apply_migration`, projeto `hojcntkggnwrvbvmcwxe`, nome `compras_aula`) com o conteúdo do arquivo. Confirme com `execute_sql`: `select count(*) from sevilha_compras_aula` → `0`.

- [ ] **Step 3: Rewrites em `vercel.json`**

Inserir antes do objeto `{"source": "/api/(.*)", ...}`:

```json
    {
      "source": "/aula-gestao-operacional",
      "destination": "/aula-gestao-operacional/index.html"
    },
    {
      "source": "/aula-gestao-operacional/obrigado",
      "destination": "/aula-gestao-operacional/obrigado/index.html"
    },
    {
      "source": "/api/kiwify-webhook",
      "destination": "/api/eventos-qualificados"
    },
```

- [ ] **Step 4: Envs em `.env.example`**

```bash
# ── Aula paga (/aula-gestao-operacional) ─────────────────────────────
# Kiwify → Apps → Webhooks → criar webhook para o produto da aula, eventos
# "Compra aprovada" e "Reembolso", URL https://<dominio>/api/kiwify-webhook.
# O token aparece na tela do webhook depois de salvar.
KIWIFY_WEBHOOK_TOKEN=
# RD CRM → Funis → funil "[AULA]" → id na URL do funil.
RD_CRM_PIPELINE_ID_AULA=
# RD CRM → mesmo funil → etapa "Inscrito" (lead antes de pagar) → id na URL.
RD_CRM_STAGE_ID_AULA=
# RD CRM → mesmo funil → etapa "Pagou" → id na URL.
RD_CRM_STAGE_ID_AULA_PAGO=
# RD CRM → Campanhas → campanha "[AULA]" → id.
RD_CRM_CAMPAIGN_ID_AULA=
# Acrescentar a rota nas listas já existentes (produção, no painel da Vercel):
#   PAGEVIEW_BEACON_PAGES=/mentoria,/mentoria-2,/aula-gestao-operacional
#   LEADS_SHEET_WRITE_PAGES=/mentoria,/mentoria-2,/aula-gestao-operacional
#   SESSAO_ESTRATEGICA_PAGINAS=/mentoria,/mentoria-2,/aula-gestao-operacional
```

- [ ] **Step 5: Validar JSON e commitar**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: `ok`

```bash
git add sql/compras-aula.sql vercel.json .env.example
git commit -m "feat(aula): tabela de compras, rotas da página e do webhook, envs documentadas"
```

---

### Task 2: Oferta `[AULA]` e `InitiateCheckout` em `/api/leads`

**Files:**
- Modify: `api/leads.js` — bloco `OFERTAS` (linhas ~44-68) e o `Promise.allSettled` do handler (linhas ~545-560)
- Create: `scripts/test-leads-aula.js`

**Interfaces:**
- Consumes: `enviarEvento({ evento, eventId, quando, userData, customData, sourceUrl, referrerUrl, actionSource })` de `lib/capi.js`.
- Produces: `OFERTAS['/aula-gestao-operacional']` com `marca '[AULA]'`; para essa página o handler envia `Lead` (`content_category: 'aula'`, `value: 47`) e `InitiateCheckout` com `event_id = 'ic:' + event_id`. Task 4 dispara o mesmo `ic:` no Pixel.

- [ ] **Step 1: Escrever o teste `scripts/test-leads-aula.js`**

```js
'use strict';
/**
 * /api/leads para a aula paga: oferta [AULA] e o par Lead + InitiateCheckout.
 *   node scripts/test-leads-aula.js
 * Sem rede: fetch é stubado e só o que iria para a CAPI é inspecionado.
 */
process.env.META_CAPI_TOKEN = 'teste';
delete process.env.SUPABASE_URL;
delete process.env.RD_CRM_TOKEN;
delete process.env.RD_MARKETING_TOKEN;
delete process.env.MAXMIND_ACCOUNT_ID;

const chamadas = [];
global.fetch = async (url, opts = {}) => {
  chamadas.push({ url: String(url), body: opts.body ? JSON.parse(opts.body) : null });
  return { ok: true, status: 200, json: async () => ({ events_received: 1 }), text: async () => '' };
};

const handler = require('../api/leads.js');
let falhas = 0;
const ok = (c, d) => { console.log(`  ${c ? '✓' : '✗'} ${d}`); if (!c) falhas += 1; };

function req(body) {
  return { method: 'POST', body, headers: { 'user-agent': 'teste', referer: 'https://x/' }, socket: { remoteAddress: '127.0.0.1' } };
}
function res() {
  const r = { code: 0, json: null };
  r.status = c => { r.code = c; return r; };
  r.json = j => { r.dado = j; return r; };
  r.setHeader = () => r;
  return r;
}
const eventosCapi = () => chamadas.filter(c => c.url.includes('graph.facebook.com')).map(c => c.body.data[0]);

(async () => {
  console.log('\n/aula-gestao-operacional');
  chamadas.length = 0;
  await handler(req({ nome: 'Teste', email: 't@x.com', telefone: '31999990000', pagina: '/aula-gestao-operacional', colaboradores: 'De 10 a 19', cargo: 'Dono/Sócio', event_id: 'ev_1' }), res());
  const ev = eventosCapi();
  const lead = ev.find(e => e.event_name === 'Lead');
  const ic   = ev.find(e => e.event_name === 'InitiateCheckout');
  ok(lead && lead.event_id === 'ev_1', 'Lead com o event_id do formulário');
  ok(lead && lead.custom_data.content_category === 'aula' && lead.custom_data.value === 47, 'Lead com content_category aula e value 47');
  ok(ic && ic.event_id === 'ic:ev_1', 'InitiateCheckout com event_id ic:<event_id>');
  ok(ic && ic.custom_data.currency === 'BRL' && ic.custom_data.value === 47, 'InitiateCheckout com valor da aula');
  ok(ev.some(e => e.event_name === 'LeadQualificado'), 'LeadQualificado continua para 10+');

  console.log('\n/mentoria (sem regressão)');
  chamadas.length = 0;
  await handler(req({ nome: 'Teste', email: 't2@x.com', telefone: '31999990001', pagina: '/mentoria', colaboradores: 'De 5 a 9', cargo: 'Dono/Sócio', event_id: 'ev_2' }), res());
  const ev2 = eventosCapi();
  ok(!ev2.some(e => e.event_name === 'InitiateCheckout'), 'sem InitiateCheckout fora da aula');
  ok(ev2.find(e => e.event_name === 'Lead').custom_data.content_category === 'pre-inscricao', 'content_category antigo preservado');

  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
  process.exit(falhas ? 1 : 0);
})();
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-leads-aula.js`
Expected: falhas em "content_category aula", "InitiateCheckout".

- [ ] **Step 3: Adicionar a oferta em `api/leads.js`**

Logo após `const SESSAO_ESTRATEGICA = { ... };`:

```js
// Aula paga: o lead nasce aqui e a compra fecha na Kiwify (lib/kiwify.js).
const AULA = {
  rotulo:      'Aula Gestão Operacional',
  marca:       '[AULA]',
  conversao:   'aula-gestao-operacional',
  tags:        ['aula', 'gestao-operacional'],
  stageEnv:    'RD_CRM_STAGE_ID_AULA',
  campaignEnv: 'RD_CRM_CAMPAIGN_ID_AULA',
  valor:       47,
};
```

E em `OFERTAS`:

```js
const OFERTAS = {
  '/mentoria':   SESSAO_ESTRATEGICA,
  '/mentoria-2': SESSAO_ESTRATEGICA,
  '/aula-gestao-operacional': AULA,
};
```

Em `sendToRDCRM`, o `deal_stage_id` já lê `process.env[oferta.stageEnv]`; se a env estiver vazia cai no padrão — acrescente um aviso logo antes de `const deal = {`:

```js
  if (oferta.stageEnv && !process.env[oferta.stageEnv]) {
    console.warn(`[RD CRM] ${oferta.stageEnv} não definido — deal ${oferta.marca} cai no stage padrão`);
  }
```

- [ ] **Step 4: `content_category`/`value` por oferta e o `InitiateCheckout`**

No handler, trocar a linha do `customData`:

```js
  const oferta = ofertaDe(pagina);
  const customData = {
    content_name: pagina,
    content_category: oferta.valor ? 'aula' : 'pre-inscricao',
    currency: 'BRL',
    value: oferta.valor || 0,
  };
```

E no `Promise.allSettled`, acrescentar depois de `enviarLeadQualificado(...)`:

```js
    oferta.valor ? enviarEvento({
      evento:       'InitiateCheckout',
      eventId:      `ic:${finalEventId}`,
      quando:       eventTime,
      userData,
      customData:   { content_name: oferta.rotulo, currency: 'BRL', value: oferta.valor },
      sourceUrl,
      referrerUrl,
      actionSource: 'website',
    }) : Promise.resolve(null),
```

(A destruturação `const [, , , capiResult, qualificadoResult]` continua válida: o novo item é o sexto.)

- [ ] **Step 5: Rodar o teste e o e2e existente**

Run: `node scripts/test-leads-aula.js` → `Tudo certo`.
Run: `node scripts/test-lead-qualificado.js` → sem falha (garante que nada quebrou no LeadQualificado).
Run: `npx eslint api/leads.js scripts/test-leads-aula.js` → sem erro novo.

- [ ] **Step 6: Commit**

```bash
git add api/leads.js scripts/test-leads-aula.js
git commit -m "feat(leads): oferta [AULA] com Lead de valor 47 e InitiateCheckout pareado na CAPI"
```

---

### Task 3: Webhook da Kiwify → `Purchase` + stage do CRM

**Files:**
- Create: `lib/kiwify.js`
- Modify: `api/eventos-qualificados.js` (handler, logo antes do despacho do `crm-webhook`)
- Create: `scripts/test-kiwify-webhook.js`

**Interfaces:**
- Consumes: `enviarEvento`, `montarUserData`, `normalizarEmail`, `normalizarTelefone` de `lib/capi.js`; `jaEnviados`, `marcarEnviados` de `lib/eventos-enviados.js`; `conexao`, `rest`, `TABELAS` de `lib/supabase.js`; tabela da Task 1.
- Produces: `tratarKiwify(req, res)`; grava `sevilha_compras_aula` (Task 6 lê); `Purchase` com `event_id = 'kiwify:' + order_id`.

Formato do webhook da Kiwify (o que importa): `POST` com `?signature=<hmac-sha1 hex do corpo bruto com o token>`; corpo JSON com `webhook_event_type` (`order_approved`, `order_refunded`), `order_id`, `order_status` (`paid`/`refunded`), `Customer { full_name, email, mobile }`, `Commissions { charge_amount }` em centavos, `TrackingParameters { src, sck, utm_source, utm_medium, utm_campaign, utm_content, utm_term }`, `approved_date`.

- [ ] **Step 1: Escrever `scripts/test-kiwify-webhook.js`**

```js
'use strict';
/**
 * Contrato do webhook da Kiwify (lib/kiwify.js).
 *   node scripts/test-kiwify-webhook.js
 * fetch stubado: Supabase, CAPI e RD CRM viram registros em memória.
 */
const crypto = require('crypto');
process.env.KIWIFY_WEBHOOK_TOKEN = 'tok';
process.env.META_CAPI_TOKEN = 'meta';
process.env.SUPABASE_URL = 'https://sb.local';
process.env.SUPABASE_SERVICE_KEY = 'k';
process.env.RD_CRM_TOKEN = 'rd';
process.env.RD_CRM_STAGE_ID_AULA_PAGO = 'stage-pago';

const chamadas = [];
let enviados = new Set();
let capiFalha = false;
global.fetch = async (url, opts = {}) => {
  const u = String(url); const body = opts.body ? JSON.parse(opts.body) : null;
  chamadas.push({ u, method: opts.method || 'GET', body });
  if (u.includes('sevilha_eventos_enviados') && (opts.method || 'GET') === 'GET') {
    return { ok: true, json: async () => [...enviados].map(event_id => ({ event_id })) };
  }
  if (u.includes('sevilha_eventos_enviados')) { body.forEach(r => enviados.add(r.event_id)); return { ok: true, text: async () => '' }; }
  if (u.includes('sevilha_leads')) return { ok: true, json: async () => [{ id: 'lead-1', fbp: 'fb.1.1.1', fbc: 'fb.1.2.2', external_id: 'ext', deal_id: null }] };
  if (u.includes('graph.facebook.com')) {
    if (capiFalha) return { ok: false, json: async () => ({ error: { message: 'boom' } }) };
    return { ok: true, json: async () => ({ events_received: 1 }) };
  }
  if (u.includes('crm.rdstation.com') && u.includes('/contacts?')) return { ok: true, json: async () => ({ contacts: [{ _id: 'c1', deal_ids: ['d1'] }] }) };
  if (u.includes('crm.rdstation.com') && u.includes('/deals/d1') && (opts.method || 'GET') === 'GET') return { ok: true, json: async () => ({ _id: 'd1', name: '[AULA] Teste', deal_stage: { _id: 'stage-inscrito' } }) };
  if (u.includes('crm.rdstation.com')) return { ok: true, json: async () => ({ _id: 'd1' }), text: async () => '' };
  return { ok: true, status: 201, json: async () => [{ order_id: 'o1' }], text: async () => '' };
};

const { tratarKiwify } = require('../lib/kiwify');
let falhas = 0;
const ok = (c, d) => { console.log(`  ${c ? '✓' : '✗'} ${d}`); if (!c) falhas += 1; };

function corpo(extra = {}) {
  return JSON.stringify({
    webhook_event_type: 'order_approved', order_id: 'o1', order_status: 'paid',
    Customer: { full_name: 'Ana Teste', email: 'Ana@X.com', mobile: '(31) 99999-0000' },
    Commissions: { charge_amount: 4700 },
    TrackingParameters: { sck: 'ev_1', utm_source: 'ig', utm_campaign: '[AULA] Teste' },
    approved_date: '2026-10-01 20:00', ...extra,
  });
}
function req(raw, sig) {
  const s = sig ?? crypto.createHmac('sha1', 'tok').update(raw).digest('hex');
  return { method: 'POST', url: `/api/kiwify-webhook?signature=${s}`, rawBody: raw, body: JSON.parse(raw), headers: {} };
}
function res() { const r = {}; r.status = c => { r.code = c; return r; }; r.json = j => { r.dado = j; return r; }; r.end = () => r; return r; }
const capi = () => chamadas.filter(c => c.u.includes('graph.facebook.com')).map(c => c.body.data[0]);
const upserts = () => chamadas.filter(c => c.u.includes('sevilha_compras_aula') && c.method === 'POST');

(async () => {
  console.log('\nassinatura inválida');
  let r = res(); await tratarKiwify(req(corpo(), 'errada'), r);
  ok(r.code === 401, 'responde 401');
  ok(!upserts().length, 'não grava nada');

  console.log('\norder_approved');
  chamadas.length = 0; r = res(); await tratarKiwify(req(corpo()), r);
  ok(r.code === 200, 'responde 200');
  ok(upserts().length === 1 && upserts()[0].body.order_id === 'o1', 'upsert por order_id');
  ok(upserts()[0].body.email === 'ana@x.com' && upserts()[0].body.valor_centavos === 4700, 'e-mail normalizado e valor em centavos');
  ok(upserts()[0].body.sck === 'ev_1' && upserts()[0].body.lead_id === 'lead-1', 'lead localizado pelo sck');
  const p = capi().find(e => e.event_name === 'Purchase');
  ok(p && p.event_id === 'kiwify:o1', 'Purchase com event_id kiwify:<order_id>');
  ok(p && p.custom_data.value === 47 && p.custom_data.currency === 'BRL', 'value 47 BRL');
  ok(p && p.user_data.fbp === 'fb.1.1.1' && p.user_data.fbc === 'fb.1.2.2', 'fbp/fbc do lead');
  ok(chamadas.some(c => c.u.includes('/deals/d1') && c.method === 'PUT' && c.body.deal.deal_stage_id === 'stage-pago'), 'deal [AULA] avança para o stage pago');

  console.log('\nreentrega');
  chamadas.length = 0; r = res(); await tratarKiwify(req(corpo()), r);
  ok(r.code === 200 && !capi().length, 'segunda entrega não reenvia Purchase');

  console.log('\norder_refunded');
  chamadas.length = 0; r = res(); await tratarKiwify(req(corpo({ webhook_event_type: 'order_refunded', order_status: 'refunded' })), r);
  ok(r.code === 200 && upserts()[0].body.status === 'refunded', 'grava status refunded');
  ok(!capi().length, 'sem evento no Meta');

  console.log('\nCAPI fora');
  chamadas.length = 0; enviados = new Set(); capiFalha = true; r = res();
  await tratarKiwify(req(corpo({ order_id: 'o2' })), r);
  ok(r.code === 200, 'ainda responde 200');
  const u = chamadas.filter(c => c.u.includes('sevilha_compras_aula') && c.method === 'PATCH').pop();
  ok(u && /^erro:/.test(u.body.capi_status), 'capi_status gravado com o erro');

  console.log('\nevento desconhecido');
  chamadas.length = 0; r = res(); await tratarKiwify(req(corpo({ webhook_event_type: 'pix_created', order_status: 'waiting_payment' })), r);
  ok(r.code === 200 && !upserts().length, '200 sem gravar');

  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
  process.exit(falhas ? 1 : 0);
})();
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-kiwify-webhook.js`
Expected: `Cannot find module '../lib/kiwify'`.

- [ ] **Step 3: Criar `lib/kiwify.js`**

```js
'use strict';

/**
 * Webhook da Kiwify para a aula paga (/aula-gestao-operacional).
 *
 * Entra por rewrite em /api/kiwify-webhook → api/eventos-qualificados.js,
 * porque o plano Hobby está em 12/12 functions. O que faz:
 *   1. valida a assinatura (HMAC-SHA1 do corpo bruto com o token);
 *   2. order_approved → upsert em sevilha_compras_aula + Purchase na CAPI +
 *      deal [AULA] do contato avança para o stage "pago" no RD CRM;
 *   3. order_refunded → só atualiza o status;
 *   4. qualquer outro evento → 200 sem ação (não-2xx faz a Kiwify reenviar).
 *
 * Responde 200 mesmo com CAPI ou CRM fora: a compra já está gravada e a falha
 * fica em capi_status/crm_status. Purchase é deduplicado por
 * sevilha_eventos_enviados (event_id kiwify:<order_id>).
 *
 * Envs: KIWIFY_WEBHOOK_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY,
 *       META_CAPI_TOKEN, RD_CRM_TOKEN, RD_CRM_STAGE_ID_AULA_PAGO
 */

const crypto = require('crypto');
const { enviarEvento, montarUserData, normalizarEmail, normalizarTelefone } = require('./capi');
const { jaEnviados, marcarEnviados } = require('./eventos-enviados');
const { conexao, rest, TABELAS } = require('./supabase');

const TABELA   = 'sevilha_compras_aula';
const ROTULO   = 'Aula Gestão Operacional';
const CRM_BASE = 'https://crm.rdstation.com/api/v1';

function assinaturaConfere(req) {
  const token = process.env.KIWIFY_WEBHOOK_TOKEN;
  if (!token) return false;
  const url = new URL(String(req.url || ''), 'http://localhost');
  const recebida = url.searchParams.get('signature') || '';
  const bruto = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
  const esperada = crypto.createHmac('sha1', token).update(bruto).digest('hex');
  const a = Buffer.from(recebida), b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function registroDe(body) {
  const c = body.Customer || {};
  const t = body.TrackingParameters || {};
  const centavos = Number(body.Commissions?.charge_amount ?? body.charge_amount ?? 0);
  return {
    order_id:       String(body.order_id),
    status:         body.order_status === 'refunded' ? 'refunded' : 'paid',
    email:          normalizarEmail(c.email || ''),
    nome:           c.full_name || null,
    telefone:       normalizarTelefone(c.mobile || '') || null,
    valor_centavos: Number.isFinite(centavos) ? centavos : 0,
    sck:            t.sck || null,
    utm_source:     t.utm_source   || null,
    utm_medium:     t.utm_medium   || null,
    utm_campaign:   t.utm_campaign || null,
    utm_content:    t.utm_content  || null,
    utm_term:       t.utm_term     || null,
    pago_em:        body.approved_date ? new Date(body.approved_date.replace(' ', 'T') + '-03:00').toISOString() : new Date().toISOString(),
    payload:        body,
    updated_at:     new Date().toISOString(),
  };
}

async function sb(url, opts = {}) {
  const c = conexao();
  if (!c) throw new Error('Supabase não configurado');
  const res = await fetch(url, { ...opts, headers: { ...c.headers, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res;
}

async function leadPeloSck(sck, email) {
  const filtro = sck ? `event_id=eq.${encodeURIComponent(sck)}` : `email=eq.${encodeURIComponent(email)}`;
  const url = rest(TABELAS.leads, `${filtro}&select=id,fbp,fbc,external_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term&order=created_at.desc&limit=1`);
  if (!url) return null;
  try { return (await (await sb(url)).json())[0] || null; } catch (e) { console.warn('[kiwify] lead não localizado:', e.message); return null; }
}

async function upsert(registro) {
  await sb(rest(TABELA, 'on_conflict=order_id'), {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(registro),
  });
}

async function atualizar(orderId, campos) {
  await sb(rest(TABELA, `order_id=eq.${encodeURIComponent(orderId)}`), {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(campos),
  });
}

async function enviarPurchase(registro, lead) {
  const eventId = `kiwify:${registro.order_id}`;
  if ((await jaEnviados([eventId])).has(eventId)) return { ok: true, repetido: true };
  const userData = montarUserData({
    email: registro.email, telefone: registro.telefone, nome: registro.nome, pais: 'br',
    externalId: [lead?.external_id, registro.email], fbp: lead?.fbp, fbc: lead?.fbc,
    quandoMs: Date.parse(registro.pago_em),
  });
  const envio = await enviarEvento({
    evento: 'Purchase', eventId, quando: Math.floor(Date.parse(registro.pago_em) / 1000),
    userData, actionSource: 'website',
    customData: { content_name: ROTULO, content_ids: [registro.order_id], currency: 'BRL', value: registro.valor_centavos / 100 },
  });
  if (envio.ok) await marcarEnviados([{ event_id: eventId, evento: 'Purchase', fonte: 'kiwify', enviado_em: new Date().toISOString() }]);
  return envio;
}

/** Deal [AULA] do contato (pelo e-mail) → stage "pago". */
async function avancarDeal(email) {
  const token = process.env.RD_CRM_TOKEN, stage = process.env.RD_CRM_STAGE_ID_AULA_PAGO;
  if (!token || !stage) return 'sem-config';
  const s = await fetch(`${CRM_BASE}/contacts?token=${token}&email=${encodeURIComponent(email)}`);
  if (!s.ok) return `erro:contato ${s.status}`;
  const contato = ((await s.json()).contacts || [])[0];
  const ids = (contato?.deal_ids || []).map(d => (typeof d === 'string' ? d : d._id || d.id)).filter(Boolean);
  for (const id of ids.reverse()) {
    const g = await fetch(`${CRM_BASE}/deals/${id}?token=${token}`);
    if (!g.ok) continue;
    const deal = await g.json();
    if (!String(deal.name || '').startsWith('[AULA]')) continue;
    const p = await fetch(`${CRM_BASE}/deals/${id}?token=${token}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal: { deal_stage_id: stage } }),
    });
    return p.ok ? 'ok' : `erro:deal ${p.status}`;
  }
  return 'sem-deal';
}

async function tratarKiwify(req, res) {
  if (!assinaturaConfere(req)) {
    console.warn('[kiwify] assinatura inválida');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const body = req.body || {};
  const tipo = body.webhook_event_type;
  if (tipo !== 'order_approved' && tipo !== 'order_refunded') {
    return res.status(200).json({ ok: true, ignorado: tipo });
  }
  const registro = registroDe(body);
  try {
    if (tipo === 'order_refunded') {
      await upsert({ ...registro, status: 'refunded' });
      return res.status(200).json({ ok: true, status: 'refunded' });
    }
    const lead = await leadPeloSck(registro.sck, registro.email);
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      if (!registro[k] && lead?.[k]) registro[k] = lead[k];
    }
    await upsert({ ...registro, lead_id: lead?.id || null, capi_status: 'pendente' });
    const envio = await enviarPurchase(registro, lead);
    const capiStatus = envio.ok ? 'ok' : `erro:${String(envio.erro || '').slice(0, 120)}`;
    let crmStatus = 'sem-config';
    try { crmStatus = await avancarDeal(registro.email); } catch (e) { crmStatus = `erro:${e.message}`.slice(0, 120); }
    await atualizar(registro.order_id, { capi_status: capiStatus, crm_status: crmStatus });
    console.log(`[kiwify] ${registro.order_id} capi=${capiStatus} crm=${crmStatus}`);
    return res.status(200).json({ ok: true, capi: capiStatus, crm: crmStatus });
  } catch (e) {
    // Sem gravação não há o que confirmar: 503 faz a Kiwify tentar de novo.
    console.error('[kiwify] falha:', e.message);
    return res.status(503).json({ error: 'Falha ao gravar a compra.' });
  }
}

module.exports = { tratarKiwify, assinaturaConfere, registroDe };
```

- [ ] **Step 4: Despachar em `api/eventos-qualificados.js`**

Antes do bloco `if (req.method === 'POST' && (caminho.includes('crm-webhook') ...` inserir:

```js
  // Webhook da Kiwify (aula paga) — mesma função pelo mesmo motivo do CRM.
  if (req.method === 'POST' && caminho.includes('kiwify-webhook')) {
    const { tratarKiwify } = require('../lib/kiwify');
    return tratarKiwify(req, res);
  }
```

Confirme que `const caminho = String(req.url || '');` fica **antes** desse bloco (mova a linha se preciso).

Atenção ao corpo bruto: a Vercel entrega `req.body` já parseado. Para o HMAC, `assinaturaConfere` usa `req.rawBody` quando existir e senão `JSON.stringify(req.body)`. Na Task 8 valide contra um webhook real; se a assinatura não bater por diferença de serialização, a alternativa documentada é ler o stream (`for await (const chunk of req)`) antes de qualquer parse — anote o resultado no `lib/kiwify.js`.

- [ ] **Step 5: Rodar o teste**

Run: `node scripts/test-kiwify-webhook.js` → `Tudo certo`.
Run: `node scripts/test-eventos-qualificados.js` → sem regressão.
Run: `npx eslint lib/kiwify.js api/eventos-qualificados.js scripts/test-kiwify-webhook.js`.

- [ ] **Step 6: Commit**

```bash
git add lib/kiwify.js api/eventos-qualificados.js scripts/test-kiwify-webhook.js
git commit -m "feat(kiwify): webhook de compra grava sevilha_compras_aula, envia Purchase na CAPI e avança o deal [AULA]"
```

---

### Task 4: `form-steps.js` parametrizado e beacon da página nova

**Files:**
- Modify: `assets/form-steps.js` (bloco de constantes, `TEXTOS`, `mostrarSucesso`, `avaliarPasso1`)
- Modify: `assets/tracking.js` (`PAGEVIEW_BEACON_PAGES`)
- Modify: `scripts/test-form-passos.js`
- Modify: `mentoria/index.html`, `mentoria-2/index.html` — só o `?v=` das tags `<script>` de `tracking.js` e `form-steps.js`

**Interfaces:**
- Consumes: `window.AULA = { data, hora, checkoutUrl, precoCentavos }` (Task 5 define no HTML).
- Produces: atributos no `<form id="sessao-form">`: `data-destino="kiwify"`, `data-textos="aula"`. Função global `window.SP_urlCheckout(dados)` (para teste). Pixel `InitiateCheckout` com `eventID 'ic:' + event_id`.

- [ ] **Step 1: Estender `scripts/test-form-passos.js`**

Acrescente ao final do arquivo (antes do `process.exit`):

```js
/* ── Parametrização por data-* (aula paga) ─────────────────────────── */
console.log('\nassets/form-steps.js — data-destino');
const js = fs.readFileSync(path.join(RAIZ, 'assets/form-steps.js'), 'utf8');
ok(js.includes("form.dataset.destino"), 'lê data-destino do form');
ok(js.includes("form.dataset.textos"), 'lê data-textos do form');
ok(/InitiateCheckout/.test(js), 'dispara InitiateCheckout quando o destino é o checkout');
ok(/'ic:' \+/.test(js), 'InitiateCheckout usa o event_id do lead com prefixo ic:');
ok(js.includes('window.SP_urlCheckout'), 'expõe SP_urlCheckout');

// Monta a URL sem navegador: avalia só a função.
const trecho = js.match(/window\.SP_urlCheckout = function[\s\S]*?\n  };\n/);
ok(!!trecho, 'SP_urlCheckout isolável para teste');
if (trecho) {
  const sandbox = { window: { AULA: { checkoutUrl: 'https://pay.kiwify.com.br/abc' } }, sessionStorage: { getItem: k => ({ utm_source: 'ig', fbclid: 'f1' })[k] || null } };
  const fn = new Function('window', 'sessionStorage', trecho[0] + ' return window.SP_urlCheckout;')(sandbox.window, sandbox.sessionStorage);
  const url = new URL(fn({ nome: 'Ana Teste', email: 'a@x.com', telefone: '(31) 99999-0000', event_id: 'ev_9' }));
  ok(url.origin + url.pathname === 'https://pay.kiwify.com.br/abc', 'base do checkout');
  ok(url.searchParams.get('name') === 'Ana Teste' && url.searchParams.get('email') === 'a@x.com', 'nome e e-mail pré-preenchidos');
  ok(url.searchParams.get('phone') === '31999990000', 'telefone só dígitos');
  ok(url.searchParams.get('sck') === 'ev_9', 'sck = event_id do lead');
  ok(url.searchParams.get('utm_source') === 'ig' && url.searchParams.get('fbclid') === 'f1', 'UTMs e fbclid repassados');
}

console.log('\nassets/tracking.js — beacon');
const tr = fs.readFileSync(path.join(RAIZ, 'assets/tracking.js'), 'utf8');
ok(/PAGEVIEW_BEACON_PAGES = \[[^\]]*'\/aula-gestao-operacional'/.test(tr), 'página da aula no beacon');
for (const p of PAGINAS) {
  const html = fs.readFileSync(path.join(RAIZ, p), 'utf8');
  ok(/tracking\.js\?v=6/.test(html) && /form-steps\.js\?v=2/.test(html), `${p} com ?v= novo dos assets`);
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-form-passos.js` → falhas nos itens novos.

- [ ] **Step 3: Editar `assets/form-steps.js`**

Depois de `var FORA_DO_PORTE = [...]` e da leitura de `form`, acrescentar:

```js
  /* Parametrização por data-* no <form>. Sem atributo, tudo se comporta como
     em /mentoria: WhatsApp no sucesso, textos da Sessão Estratégica. */
  var DESTINO = form.dataset.destino || 'whatsapp';   // 'whatsapp' | 'kiwify'
  var TEXTOS_ID = form.dataset.textos || 'sessao';
```

Trocar `var TEXTOS = {...}` por:

```js
  var TEXTOS_POR_OFERTA = {
    sessao: {
      1: { rotulo: 'Passo 1 de 2', titulo: 'Duas perguntas rápidas',
           sub: 'Elas definem se a Sessão Estratégica é o formato certo para o seu escritório.' },
      2: { rotulo: 'Passo 2 de 2', titulo: 'Onde falamos com você',
           sub: 'Nosso time chama no WhatsApp para combinar a data da sessão.' },
    },
    aula: {
      1: { rotulo: 'Passo 1 de 2', titulo: 'Antes do pagamento, duas perguntas',
           sub: 'A aula foi desenhada para escritórios com equipe estruturada. Isso ajuda a gente a preparar o material.' },
      2: { rotulo: 'Passo 2 de 2', titulo: 'Onde enviamos o link da aula',
           sub: 'Você segue para o pagamento em seguida. O acesso chega por e-mail e WhatsApp.' },
    },
  };
  var TEXTOS = TEXTOS_POR_OFERTA[TEXTOS_ID] || TEXTOS_POR_OFERTA.sessao;
```

Acrescentar, antes de `window.submitForm`:

```js
  /* URL do checkout da Kiwify com pré-preenchimento, UTMs, fbclid e o sck
     (event_id do lead) — é o sck que o webhook usa para casar compra e lead. */
  window.SP_urlCheckout = function (dados) {
    var base = (window.AULA && window.AULA.checkoutUrl) || '';
    var url = new URL(base, window.location.href);
    var p = url.searchParams;
    if (dados.nome)     p.set('name', dados.nome);
    if (dados.email)    p.set('email', dados.email);
    if (dados.telefone) p.set('phone', String(dados.telefone).replace(/\D/g, ''));
    if (dados.event_id) p.set('sck', dados.event_id);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid'].forEach(function (k) {
      var v = dados[k] || sessionStorage.getItem(k);
      if (v) p.set(k, v);
    });
    return url.toString();
  };
```

Trocar `mostrarSucesso` por:

```js
  var ultimoEnvio = null;

  function mostrarSucesso() {
    var wrapper = document.getElementById('form-wrapper');
    var sucesso = document.getElementById('form-success');
    if (wrapper) wrapper.style.display = 'none';
    if (sucesso) sucesso.style.display = 'block';
    if (DESTINO === 'kiwify') {
      var dados = ultimoEnvio || {};
      if (window.fbq && window.AULA) {
        fbq('track', 'InitiateCheckout',
          { content_name: 'Aula Gestão Operacional', currency: 'BRL', value: (window.AULA.precoCentavos || 0) / 100 },
          { eventID: 'ic:' + (dados.event_id || '') });
      }
      marcar('checkout');
      setTimeout(function () { window.location.href = window.SP_urlCheckout(dados); }, 1200);
      return;
    }
    setTimeout(function () { window.location.href = WHATSAPP_URL; }, 2500);
  }
```

E `window.submitForm`:

```js
  window.submitForm = function (e) {
    if (erro) erro.classList.remove('on');
    ultimoEnvio = Object.fromEntries(new FormData(form));
    window.SP_handleSubmit(e, form, function () {
      // O SP_handleSubmit preenche event_id nos campos ocultos antes de enviar.
      ultimoEnvio = Object.fromEntries(new FormData(form));
      mostrarSucesso();
    }, DESTINO === 'kiwify' ? mostrarSucesso : mostrarErro);
  };
```

(No destino Kiwify a falha de rede também redireciona: o lead ficou no `localStorage` e o webhook recupera o contato.)

No `route-porte`, o texto vem do HTML de cada página — nada muda no JS. O botão `#route-continuar` já existe e continua liberando o passo 2.

- [ ] **Step 4: `assets/tracking.js`**

```js
  var PAGEVIEW_BEACON_PAGES = ['/mentoria', '/mentoria-2', '/aula-gestao-operacional'];
```

E acrescentar `'checkout'` à lista `EVENTOS_ACEITOS` em `lib/pageviews.js` (o beacon rejeita evento fora da lista):

Run: `grep -n "EVENTOS_ACEITOS" lib/pageviews.js` e inclua `'checkout'` no array.

- [ ] **Step 5: Subir o `?v=` nas duas páginas irmãs**

Em `mentoria/index.html` e `mentoria-2/index.html`: `tracking.js?v=5` → `tracking.js?v=6`; `form-steps.js?v=1` → `form-steps.js?v=2`.

- [ ] **Step 6: Rodar testes e lint**

Run: `node scripts/test-form-passos.js` → `Tudo certo`.
Run: `node scripts/test-pageview.js` → sem regressão.
Run: `npx eslint assets/form-steps.js assets/tracking.js lib/pageviews.js scripts/test-form-passos.js`.

- [ ] **Step 7: Commit**

```bash
git add assets/form-steps.js assets/tracking.js lib/pageviews.js scripts/test-form-passos.js mentoria/index.html mentoria-2/index.html
git commit -m "feat(form): destino kiwify e textos por oferta via data-*; página da aula no beacon; bump dos assets"
```

---

### Task 5: A página `/aula-gestao-operacional`

**Files:**
- Create: `aula-gestao-operacional/index.html`
- Create: `aula-gestao-operacional/aula.css`
- Create: `aula-gestao-operacional/obrigado/index.html`
- Create: `scripts/og-aula.py` → gera `assets/og-aula.png`
- Modify: `scripts/test-form-passos.js` — `PAGINAS` ganha `'aula-gestao-operacional/index.html'`

**Interfaces:**
- Consumes: `data-destino="kiwify"`, `data-textos="aula"` (Task 4); rotas (Task 1); `/api/leads` com `pagina=/aula-gestao-operacional` (Task 2).
- Produces: `window.AULA` config; ids obrigatórios do modal (lista `IDS_OBRIGATORIOS` do teste); copy da página.

Antes de escrever, leia `mentoria-2/index.html` inteiro (estrutura do `<head>`, snippet do Pixel com o guarda `spInterno`, modal completo, `form-success`) e `DESIGN.md`. Copie o modal **na íntegra** (ids e `name=` são contrato) e altere só os textos indicados.

- [ ] **Step 1: `aula-gestao-operacional/aula.css`** (< 350 linhas)

Tokens e base:

```css
:root {
  --roxo: #150C43; --neon: #50DC00; --neon-ink: #2a7a00;
  --ink: #12172b; --muted: #5a5680; --chao: #f3f1fa; --borda: #e2def2;
  --erro: #c62828; --raio: 20px;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--chao); color: var(--ink); font: 16px/1.55 Inter, system-ui, sans-serif; }
h1, h2, h3, .num, .btn { font-family: Poppins, Inter, system-ui, sans-serif; }
h1 { font-size: clamp(2.15rem, 4.1vw, 3.25rem); line-height: 1.08; font-weight: 800; letter-spacing: -.01em; margin: 0 0 1rem; }
h2 { font-size: 1.5rem; line-height: 1.2; font-weight: 800; margin: 0 0 1rem; }
h3 { font-size: 1.05rem; font-weight: 700; margin: 0 0 .5rem; }
mark { background: var(--neon); color: var(--roxo); padding: 0 .25em; border-radius: 8px; }
.num { font-variant-numeric: tabular-nums; }
.wrap { width: min(100% - 2rem, 1040px); margin-inline: auto; }
section { padding-block: 3.5rem; }
@media (min-width: 900px) { section { padding-block: 5rem; } }
.palco { background: var(--roxo); color: #fff; }
.palco h1, .palco h2 { color: #fff; }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: .8rem 1.4rem;
  border-radius: 12px; font-weight: 800; font-size: 1rem; text-decoration: none; cursor: pointer; border: 0;
  background: var(--neon); color: var(--roxo); transition: transform .15s ease, box-shadow .15s ease; }
.btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(80,220,0,.25); }
:focus-visible { outline: 3px solid var(--neon); outline-offset: 3px; }
.cartao { background: #fff; border: 1px solid var(--borda); border-radius: var(--raio); padding: 1.25rem; }
```

Hero-ingresso:

```css
.hero { padding-block: 3rem 3.5rem; }
.hero .lead { font-size: 1.1rem; max-width: 36rem; color: rgba(255,255,255,.85); margin: 0 0 1.75rem; }
.ingresso { background: #fff; color: var(--roxo); border-radius: var(--raio); max-width: 34rem; overflow: hidden; }
.ingresso .corpo { padding: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: .9rem 1.25rem; border-bottom: 2px dashed var(--borda); }
.ingresso .corpo small { display: block; color: var(--muted); font-size: .85rem; }
.ingresso .corpo b { font-size: 1.05rem; }
.ingresso .canhoto { padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.ingresso .preco { font-size: 2rem; font-weight: 800; line-height: 1; }
.ingresso .preco small { display: block; font-size: .8rem; font-weight: 400; color: var(--muted); margin-top: .35rem; }
@media (min-width: 900px) { .hero .wrap { display: grid; grid-template-columns: 1.1fr .9fr; gap: 3rem; align-items: center; } }
```

Programação, leva, Bruno, FAQ, fechamento:

```css
.prog { position: relative; padding-left: 3rem; }
.prog::before { content: ""; position: absolute; left: 1.1rem; top: .5rem; bottom: .5rem; border-left: 2px dashed #c9c4e6; }
.prog .etapa { position: relative; margin-bottom: 1.75rem; }
.prog .etapa i { position: absolute; left: -3rem; top: 0; width: 2.25rem; height: 2.25rem; border-radius: 50%;
  background: var(--roxo); color: var(--neon); font: 800 .95rem Poppins, sans-serif; display: grid; place-items: center; font-style: normal; }
.prog .caso { margin-top: .6rem; }
.prog .caso small { display: block; color: var(--muted); font-size: .8rem; margin-bottom: .2rem; }
.leva { display: grid; gap: 1rem; }
@media (min-width: 720px) { .leva { grid-template-columns: 1fr 1fr; } }
.pilula { display: inline-block; border-radius: 8px; padding: .15rem .6rem; font-size: .85rem; font-weight: 700; background: var(--neon); color: var(--roxo); margin-bottom: .75rem; }
.pilula.dep { background: #e9e6f5; }
.faixa { display: grid; gap: 1.25rem; }
.faixa .foto { width: 88px; height: 88px; border-radius: 50%; border: 3px solid var(--neon); object-fit: cover; background: #2a2160; }
.faixa q { display: block; font: 600 1.25rem/1.35 Poppins, sans-serif; quotes: "“" "”"; margin: .5rem 0 1rem; }
.fatos { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; }
.fatos div { border: 1px solid rgba(255,255,255,.2); border-radius: 12px; padding: .8rem; font-size: .9rem; line-height: 1.35; }
.fatos b { display: block; font: 800 1.2rem Poppins, sans-serif; color: var(--neon); }
@media (max-width: 560px) { .fatos { grid-template-columns: 1fr; } }
.faq details { border-top: 1px solid var(--borda); padding: .9rem 0; }
.faq summary { font-weight: 700; cursor: pointer; }
.lista-nao li { color: var(--muted); }
```

Modal: copie o bloco `.modal-overlay ... #form-success` de `mentoria-2/index.html` para o final deste arquivo, trocando `--navy` → `var(--roxo)` e `--green` → `var(--neon)`. Mantenha `min-height: 0` na cadeia flex e o `:focus-visible` com `outline`.

- [ ] **Step 2: `aula-gestao-operacional/index.html`**

Estrutura (copy abaixo é a final; ajuste só se o Bruno mandar texto novo):

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aula ao vivo: o projeto de gestão operacional de um escritório contábil — Sevilha Performance</title>
  <meta name="description" content="2h10 ao vivo com o método completo da Sevilha e as 5 planilhas usadas em cliente. Para donos de escritório contábil com 10+ colaboradores. R$ 47.">
  <meta name="robots" content="noindex, nofollow" id="meta-robots">
  <meta property="og:title" content="O projeto que transforma a operação de um escritório contábil">
  <meta property="og:description" content="Aula ao vivo, 2h10, com as 5 planilhas do método. Escritórios 10+. R$ 47.">
  <meta property="og:image" content="https://sevilha-perfomance.vercel.app/assets/og-aula.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Poppins:wght@700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/aula-gestao-operacional/aula.css?v=1">
  <script>
    window.AULA = {
      data: '',                       // ISO 'AAAA-MM-DD'; vazia = noindex e "próxima turma"
      hora: '19:30',
      checkoutUrl: '',                // https://pay.kiwify.com.br/...
      precoCentavos: 4700,
    };
  </script>
  <!-- Meta Pixel: copiar o snippet de mentoria-2/index.html na íntegra, com o guarda spInterno. -->
</head>
<body>
<header class="wrap" style="padding-block:1.25rem"><img src="/assets/logo-sevilha.svg" alt="Sevilha Performance" height="28" style="height:28px;width:auto"></header>

<section class="hero palco"><div class="wrap">
  <div>
    <h1>O projeto que transforma a <mark>operação</mark> de um escritório contábil — do mapeamento à margem</h1>
    <p class="lead">Uma aula ao vivo de 2h10 com o método completo da Sevilha, aberto etapa por etapa, e as 5 planilhas que usamos em cliente.</p>
  </div>
  <div class="ingresso">
    <div class="corpo">
      <div><small>Data</small><b class="num" id="aula-data">Próxima turma</b></div>
      <div><small>Horário</small><b class="num" id="aula-hora">19h30 (Brasília)</b></div>
      <div><small>Onde</small><b>Zoom, ao vivo</b></div>
      <div><small>Perfil</small><b>Escritórios com 10+ colaboradores</b></div>
    </div>
    <div class="canhoto">
      <span class="preco num">R$ 47<small>gravação por 7 dias inclusa</small></span>
      <button type="button" class="btn open-modal">Garantir vaga</button>
    </div>
  </div>
</div></section>

<section><div class="wrap">
  <h2>Você entrega no prazo, com qualidade — e a margem não aparece</h2>
  <div class="cartao"><ul>
    <li>Não sabe quanto custa cada área do escritório nem quanto cada uma devolve de receita.</li>
    <li>A equipe se declara sobrecarregada e você não tem parâmetro objetivo para confirmar ou contestar.</li>
    <li>Contratou e não sobrou tempo. Trocou de sistema e não melhorou. Ficou mais caro nos dois casos.</li>
    <li>A operação é reativa: o time decide de manhã o que vai fazer e tudo vira urgência.</li>
    <li>Um cliente difícil justifica o desempenho do time inteiro. A exceção pauta a carteira.</li>
  </ul></div>
  <p>Você domina a técnica contábil e conhece o resultado do cliente melhor do que ele. O que falta não é esforço: é número sobre a própria operação.</p>
</div></section>

<section><div class="wrap">
  <h2>O que você vai ver nas <mark>2h10</mark></h2>
  <p>O projeto inteiro, na ordem em que a Sevilha aplica em cliente. Cada etapa com a planilha sendo preenchida ao vivo.</p>
  <div class="prog">
    <div class="etapa"><i class="num">1</i><h3>Classificação da carteira por complexidade real</h3><p>Volume, prazo e risco — não dificuldade técnica.</p>
      <div class="cartao caso"><small>Caso real, anonimizado</small>O cliente "problemático" que consumia 8% do tempo de todo o fiscal.</div></div>
    <div class="etapa"><i class="num">2</i><h3>Mapeamento de entregas e tempo por atividade</h3><p>Quanto cada entrega custa em horas, por pessoa e por cliente.</p>
      <div class="cartao caso"><small>Caso real, anonimizado</small>O time que consumia 25% do dia em e-mail.</div></div>
    <div class="etapa"><i class="num">3</i><h3>Capacidade produtiva e meta operacional</h3><p>Quantas horas o time tem de fato e quanto cabe nelas.</p>
      <div class="cartao caso"><small>Caso real, anonimizado</small>O escritório que contratou mais um colaborador e não gerou capacidade.</div></div>
    <div class="etapa"><i class="num">4</i><h3>Acompanhamento diário: previsto × realizado</h3><p>Leitura dos desvios antes de virarem urgência.</p>
      <div class="cartao caso"><small>Caso real, anonimizado</small>O cliente que ia automatizar o que representava 1,5% do tempo, enquanto o DAS consumia 20%.</div></div>
    <div class="etapa"><i class="num">5</i><h3>Da meta ao resultado</h3><p>Faturamento recorrente × custo com pessoal e priorização de ações por impacto.</p></div>
  </div>
</div></section>

<section><div class="wrap">
  <h2>O que você <mark>leva</mark></h2>
  <div class="leva">
    <div class="cartao"><span class="pilula">Garantido na aula</span><ul>
      <li>O método completo de gestão operacional da Sevilha, etapa por etapa</li>
      <li>5 planilhas: classificação de clientes, entregas e tempos, capacidade e meta operacional, acompanhamento diário, meta financeira e banco de oportunidades</li>
      <li>A capacidade produtiva teórica do seu time calculada ao vivo e confrontada com o tempo mapeado</li>
      <li>Separar o que é problema estrutural do que é percepção do time</li>
      <li>Gravação por 7 dias</li></ul></div>
    <div class="cartao"><span class="pilula dep">Depende de aplicação depois</span><ul>
      <li>Sanear as bases</li><li>Sustentar a agenda diária</li><li>Manter o ciclo de acompanhamento vivo</li>
      <li>Ganho de margem e produtividade — execução ao longo de meses</li></ul></div>
  </div>
</div></section>

<section class="palco"><div class="wrap faixa">
  <h2>Quem <mark>conduz</mark> a aula</h2>
  <div style="display:flex;gap:1rem;align-items:center"><img class="foto" src="/Bruno.jpeg" alt="Bruno Silvestre" width="88" height="88"><div><b>Bruno Silvestre</b><br><span style="color:rgba(255,255,255,.75)">Cofundador e diretor comercial da Sevilha Performance</span></div></div>
  <q>Não é uma palestra sobre o problema. É o projeto inteiro, aberto.</q>
  <div class="fatos">
    <div><b>~20 anos</b>em gestão, com formação na metodologia Falconi</div>
    <div><b>desde 2019</b>dedicação exclusiva ao setor contábil</div>
    <div><b>+500</b>projetos realizados pelo grupo em empresas contábeis</div>
  </div>
  <p style="color:rgba(255,255,255,.75)">Responsável pela construção da metodologia de gestão operacional da empresa.</p>
</div></section>

<section><div class="wrap">
  <h2>Para quem é</h2>
  <div class="leva">
    <div class="cartao"><h3>É para você se</h3><ul>
      <li>É dono ou sócio de escritório contábil com equipe estruturada, a partir de 10 colaboradores</li>
      <li>O escritório cresceu em carteira e em time, e a margem não acompanhou</li>
      <li>Já tentou contratar, treinar tecnicamente e trocar de sistema — e nenhum dos três resolveu</li></ul></div>
    <div class="cartao"><h3>Não é para</h3><ul class="lista-nao">
      <li>Contador autônomo</li><li>Escritório de 1 a 3 pessoas</li><li>Estudante</li><li>Funcionário operacional</li></ul>
      <p>Tem menos de 10 colaboradores? O formato para o seu porte é o <a href="/campanha">Clube da Performance</a>.</p></div>
  </div>
</div></section>

<section><div class="wrap">
  <h2>Como funciona</h2>
  <div class="cartao"><ul>
    <li>Ao vivo no Zoom, com sala controlada e chat moderado</li>
    <li>2h10 de conteúdo mais 15 minutos de perguntas</li>
    <li>Link por e-mail logo após a compra, e lembretes no WhatsApp na véspera, na manhã do dia e 30 minutos antes</li>
    <li>Inscrições encerram 2 horas antes do início</li>
    <li>Gravação disponível por 7 dias</li></ul></div>
</div></section>

<section><div class="wrap faq">
  <h2>Perguntas frequentes</h2>
  <details><summary>Preciso assistir ao vivo?</summary><p>É o ideal: as planilhas são preenchidas ao vivo e você tira dúvida na hora. Quem não puder tem a gravação por 7 dias.</p></details>
  <details><summary>Meu escritório tem menos de 10 colaboradores. Vale?</summary><p>A aula foi desenhada para equipes estruturadas. Para o seu porte, o Clube da Performance entrega mais — e você pode se inscrever mesmo assim.</p></details>
  <details><summary>O que acontece depois da aula?</summary><p>Você sai com o método e as planilhas para aplicar. Quem quiser conversar sobre o próprio escritório recebe o convite no fim da aula.</p></details>
  <details><summary>E se eu quiser reembolso?</summary><p>Garantia de 7 dias pela Kiwify, sem perguntas.</p></details>
  <details><summary>É a mentoria da Sevilha?</summary><p>Não. É o método da Consultoria Performance — o projeto que a Sevilha executa em escritórios de 10+ — aberto em uma aula.</p></details>
</div></section>

<section class="palco"><div class="wrap">
  <h2>Garanta sua <mark>vaga</mark></h2>
  <div class="ingresso">
    <div class="corpo">
      <div><small>Data</small><b class="num" data-aula-data>Próxima turma</b></div>
      <div><small>Horário</small><b class="num">19h30 (Brasília)</b></div>
      <div><small>Onde</small><b>Zoom, ao vivo</b></div>
      <div><small>Perfil</small><b>Escritórios com 10+ colaboradores</b></div>
    </div>
    <div class="canhoto"><span class="preco num">R$ 47<small>gravação por 7 dias inclusa</small></span><button type="button" class="btn open-modal">Garantir vaga</button></div>
  </div>
</div></section>

<footer class="wrap" style="padding-block:2rem;color:var(--muted);font-size:.85rem">Sevilha Performance · consultoria de gestão para escritórios contábeis</footer>

<!-- MODAL: copiar de mentoria-2/index.html na íntegra. Alterações permitidas:
     1. <form id="sessao-form" onsubmit="submitForm(event)" data-destino="kiwify" data-textos="aula">
     2. hidden: <input type="hidden" name="pagina" value="/aula-gestao-operacional">
     3. #route-porte: "A aula foi feita para escritórios com 10+ colaboradores. Para o seu porte,
        o Clube da Performance entrega mais." + os dois links já existentes.
     4. .trust: <span><b>R$ 47</b></span><span>2h10 ao vivo</span><span>Gravação por 7 dias</span><span>Dados usados só para o acesso (LGPD)</span>
     5. #submit-btn: "Ir para o pagamento"
     6. #form-success: "Inscrição registrada. Abrindo o pagamento…" + <a id="wa-link" href="#" hidden>
        (o id precisa existir; fica oculto porque o destino é a Kiwify) -->

<script>
  // Data e noindex a partir de window.AULA — troca de turma sem tocar copy.
  (function () {
    var a = window.AULA || {};
    if (!a.data) return;
    var d = new Date(a.data + 'T12:00:00-03:00');
    var txt = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) + ' · ' + (a.hora || '19:30').replace(':', 'h');
    document.querySelectorAll('#aula-data, [data-aula-data]').forEach(function (el) { el.textContent = txt; });
    var r = document.getElementById('meta-robots'); if (r) r.setAttribute('content', 'index, follow');
  })();
</script>
<script src="/assets/tracking.js?v=6" defer></script>
<script src="/assets/form-steps.js?v=2" defer></script>
</body>
</html>
```

- [ ] **Step 3: `aula-gestao-operacional/obrigado/index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Inscrição confirmada — Sevilha Performance</title>
  <meta name="robots" content="noindex, nofollow">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Poppins:wght@800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/aula-gestao-operacional/aula.css?v=1">
  <!-- Meta Pixel: mesmo snippet da página, só PageView. -->
</head>
<body>
<section class="palco" style="min-height:100vh;display:grid;place-items:center"><div class="wrap" style="max-width:40rem">
  <h1>Sua vaga está <mark>garantida</mark></h1>
  <p class="lead">O link do Zoom chega no seu e-mail em alguns minutos. Nos dias da aula você recebe lembretes no WhatsApp: na véspera, na manhã do dia e 30 minutos antes.</p>
  <p class="lead">Não achou o e-mail? Confira a caixa de promoções ou spam e salve o remetente.</p>
</div></section>
<script src="/assets/tracking.js?v=6" defer></script>
</body>
</html>
```

- [ ] **Step 4: `scripts/og-aula.py` → `assets/og-aula.png`**

```python
"""Imagem OG da aula (1200x630). Pillow já é dependência do projeto.
   python3 scripts/og-aula.py
"""
from PIL import Image, ImageDraw, ImageFont
W, H = 1200, 630
ROXO, NEON, BRANCO = (21, 12, 67), (80, 220, 0), (255, 255, 255)
img = Image.new("RGB", (W, H), ROXO)
d = ImageDraw.Draw(img)
def fonte(tam):
    for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf"]:
        try: return ImageFont.truetype(p, tam)
        except OSError: pass
    return ImageFont.load_default()
d.rectangle([80, 150, 80 + 260, 150 + 62], fill=NEON)
d.text((92, 156), "AULA AO VIVO", font=fonte(44), fill=ROXO)
for i, linha in enumerate(["O projeto que transforma a", "operação de um escritório", "contábil — do mapeamento à margem"]):
    d.text((80, 250 + i * 70), linha, font=fonte(56), fill=BRANCO)
d.text((80, 520), "2h10 · 5 planilhas do método · escritórios 10+ · R$ 47", font=fonte(30), fill=NEON)
img.save("assets/og-aula.png", optimize=True)
print("assets/og-aula.png")
```

Run: `python3 scripts/og-aula.py` → arquivo gerado (< 200 KB).

- [ ] **Step 5: Incluir a página no contrato do formulário**

Em `scripts/test-form-passos.js`, `const PAGINAS = ['mentoria/index.html', 'mentoria-2/index.html', 'aula-gestao-operacional/index.html'];`. Se o teste checar textos específicos da Sessão Estratégica por página, condicione pela presença de `data-textos="aula"`.

Run: `node scripts/test-form-passos.js` → `Tudo certo` (ids, `name=`, chips não se aplicam — a página não tem `.porte-chip`; o teste deve tolerar ausência de chips quando o form tem `data-destino`).

- [ ] **Step 6: Servidor local e verificação em lote (uma rodada)**

`vercel dev` (porta 3000) e agent-browser em sessão nomeada:

```bash
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix aula)"
agent-browser open http://localhost:3000/aula-gestao-operacional
agent-browser set viewport 390 844 && agent-browser screenshot .impeccable/review/aula-390.png
agent-browser set viewport 1440 900 && agent-browser screenshot .impeccable/review/aula-1440.png
agent-browser snapshot -i          # clicar "Garantir vaga", responder 5 a 9 → ver aviso + "Continuar mesmo assim"
agent-browser a11y; agent-browser console; agent-browser vitals
agent-browser close
```

E o detector: `node /Users/thaleslorenzo/.claude/skills/impeccable/scripts/detect.mjs --json aula-gestao-operacional/index.html aula-gestao-operacional/aula.css`.

Corrija tudo o que aparecer numa passada; no máximo uma segunda rodada.

- [ ] **Step 7: Lint e commit**

Run: `npm run lint && npm run lint:biome`.

```bash
git add aula-gestao-operacional assets/og-aula.png scripts/og-aula.py scripts/test-form-passos.js
git commit -m "feat(aula): página de vendas /aula-gestao-operacional com ingresso, programação e modal para a Kiwify"
```

---

### Task 6: Grupo `AULA` no pipeline de dados + `compras`

**Files:**
- Modify: `lib/meta.js` (`classifyCampaign`), `api/meta.js` (buckets `grupos`, saída), `lib/resumo.js` (regex de limpeza e `captacao`)
- Modify: `lib/leads-unificados.js` (`GRUPO_POR_PAGINA`, `porGrupo`, `compras`)
- Modify: `api/rd-stats.js` (`FUNIS`)
- Create: `scripts/test-grupo-aula.js`

**Interfaces:**
- Consumes: tabela `sevilha_compras_aula` (Task 1/3); `chavesContato(l)` e `lerTudo` já existentes.
- Produces: `meta.grupos.AULA`; `leads.por_grupo.AULA`; `leads.compras = { total, receita_centavos, por_dia: [{dia, compras, receita_centavos}], por_campanha: [{campanha, compras, receita_centavos}], por_conjunto, por_anuncio, compradores_com_sessao }` (ou `null` sem compras); `rd.funis.AULA` quando `RD_CRM_PIPELINE_ID_AULA` existe.

- [ ] **Step 1: Teste `scripts/test-grupo-aula.js`**

```js
'use strict';
/** Grupo AULA no pipeline: classificação, por_grupo e agregado de compras.
 *   node scripts/test-grupo-aula.js */
let falhas = 0;
const ok = (c, d) => { console.log(`  ${c ? '✓' : '✗'} ${d}`); if (!c) falhas += 1; };

const { classifyCampaign } = require('../lib/meta');
console.log('\nlib/meta.js');
ok(classifyCampaign('[AULA] [LEAD] [COLD] - Teste').grupo === 'AULA', '[AULA] → AULA');
ok(classifyCampaign('[SE] [FORMS] x').grupo === 'SE', '[SE] continua SE');

const lu = require('../lib/leads-unificados');
console.log('\nlib/leads-unificados.js');
ok(lu.GRUPO_POR_PAGINA['/aula-gestao-operacional'] === 'AULA', 'página da aula → AULA');
ok(typeof lu.agregarCompras === 'function', 'agregarCompras exportado');
if (typeof lu.agregarCompras === 'function') {
  const leads = [
    { grupo: 'AULA', email: 'a@x.com', telefone: '31999990000', dia: '2026-10-01', campanha: '[AULA] T', conjunto: 'HOT', anuncio: 'AD1' },
  ];
  const compras = [
    { order_id: 'o1', status: 'paid', email: 'a@x.com', valor_centavos: 4700, pago_em: '2026-10-01T23:00:00Z', utm_campaign: '[AULA] T', utm_medium: 'HOT', utm_content: 'AD1' },
    { order_id: 'o2', status: 'refunded', email: 'b@x.com', valor_centavos: 4700, pago_em: '2026-10-02T12:00:00Z' },
    { order_id: 'o3', status: 'paid', email: 'c@x.com', valor_centavos: 4700, pago_em: '2026-09-01T12:00:00Z' },
  ];
  const deals = [{ nome: '[SE] Ana', email: 'a@x.com', criado_em: '2026-10-03T12:00:00Z' }];
  const r = lu.agregarCompras({ compras, leads, deals, since: '2026-10-01', until: '2026-10-31' });
  ok(r.total === 1 && r.receita_centavos === 4700, 'só paid no período conta');
  ok(r.por_dia.find(d => d.dia === '2026-10-01').compras === 1, 'pago_em convertido para o dia no fuso do painel');
  ok(r.por_campanha[0].campanha === '[AULA] T' && r.por_campanha[0].compras === 1, 'por_campanha pela utm_campaign');
  ok(r.compradores_com_sessao === 1, 'comprador com deal [SE] depois da compra conta');
}

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-grupo-aula.js`.

- [ ] **Step 3: `lib/meta.js`**

```js
  const grupo = upper.includes('[CP]') ? 'CP'
              : upper.includes('[SE]') ? 'SE'
              : upper.includes('[AULA]') ? 'AULA'
              : /\[CAF[EÉ]/.test(upper) ? 'CAFE'
              : 'OUTROS';
```

Atualize o comentário acima da função com a linha `[AULA] → Aula paga (/aula-gestao-operacional)`.

- [ ] **Step 4: `api/meta.js`**

`const grupos = { CP: emptyBucket(), SE: emptyBucket(), CAFE: emptyBucket(), AULA: emptyBucket(), OUTROS: emptyBucket() };` e na saída `grupos: { ..., AULA: withDerived(grupos.AULA), ... }`. Procure outros lugares do arquivo que listem `['CP','SE','CAFE']` (série diária) e inclua `AULA`.

- [ ] **Step 5: `lib/resumo.js`**

Regex de limpeza: `/\[(CP|SE|AULA|FORMS|LEAD|FASE\d+)\]\s*/g`. Captação: `meta.grupos.SE.spend + meta.grupos.CP.spend + (meta.grupos.AULA ? meta.grupos.AULA.spend : 0)`.

- [ ] **Step 6: `lib/leads-unificados.js`**

`GRUPO_POR_PAGINA['/aula-gestao-operacional'] = 'AULA'`; `porGrupo` sobre `['SE', 'CAFE', 'CP', 'AULA', 'OUTROS']`. Acrescentar:

```js
/** Agregado das compras da aula no período, no fuso do painel. */
function agregarCompras({ compras, leads, deals, since, until }) {
  const diaDe = iso => new Intl.DateTimeFormat('sv-SE', { timeZone: FUSO }).format(new Date(iso));
  const pagas = compras.filter(c => c.status === 'paid').map(c => ({ ...c, dia: diaDe(c.pago_em) }))
    .filter(c => c.dia >= since && c.dia <= until);
  const soma = (lista, chave) => {
    const m = new Map();
    for (const c of lista) { const k = c[chave] || '(sem etiqueta)'; const a = m.get(k) || { [chave]: k, compras: 0, receita_centavos: 0 }; a.compras += 1; a.receita_centavos += c.valor_centavos; m.set(k, a); }
    return [...m.values()].sort((a, b) => b.compras - a.compras);
  };
  const chavesDeal = new Map();
  for (const d of deals || []) if (/^\[SE\]/.test(d.nome || '')) for (const k of chavesContato(d)) chavesDeal.set(k, d.criado_em);
  const comSessao = pagas.filter(c => chavesContato(c).some(k => chavesDeal.has(k) && chavesDeal.get(k) > c.pago_em)).length;
  return {
    total: pagas.length,
    receita_centavos: pagas.reduce((s, c) => s + c.valor_centavos, 0),
    por_dia: cadaDia(since, until).map(dia => ({ dia, compras: pagas.filter(c => c.dia === dia).length, receita_centavos: pagas.filter(c => c.dia === dia).reduce((s, c) => s + c.valor_centavos, 0) })),
    por_campanha: soma(pagas.map(c => ({ ...c, campanha: c.utm_campaign })), 'campanha'),
    por_conjunto: soma(pagas.map(c => ({ ...c, conjunto: c.utm_medium })), 'conjunto'),
    por_anuncio:  soma(pagas.map(c => ({ ...c, anuncio: c.utm_content })), 'anuncio'),
    compradores_com_sessao: comSessao,
  };
}
```

No ponto em que o módulo monta a resposta (função que devolve `{ periodo, total, por_dia, por_grupo, ... }`), ler as compras quando `por_grupo.AULA.leads > 0` ou quando houver compras no período:

```js
  const compras = await lerCompras(since, until);   // lerTudo(rest('sevilha_compras_aula', `pago_em=gte.${since}T00:00:00-03:00&pago_em=lte.${until}T23:59:59-03:00&order=pago_em.asc`))
  const deals   = rd ? rd.deals : [];              // se a função já recebe deals do RD; senão passe []
  resultado.compras = compras.length ? agregarCompras({ compras, leads: unicos, deals, since, until }) : null;
```

Exportar `GRUPO_POR_PAGINA` e `agregarCompras` no `module.exports`. Mantenha o arquivo abaixo de 350 linhas; se estourar, mova `agregarCompras` para `lib/compras-aula.js` e importe.

- [ ] **Step 7: `api/rd-stats.js`**

```js
const FUNIS = {
  SE: { id: '68d152fa949ae20022df32cb', nome: 'Sessão Estratégica' },
  CP: { id: '69d52f54c0b8000015d2e7b9', nome: 'Clube da Performance' },
  ...(process.env.RD_CRM_PIPELINE_ID_AULA ? { AULA: { id: process.env.RD_CRM_PIPELINE_ID_AULA, nome: 'Aula paga' } } : {}),
};
```

- [ ] **Step 8: Testes e lint**

Run: `node scripts/test-grupo-aula.js` → `Tudo certo`.
Run: `node scripts/test-leads-unificados.js`, `node scripts/test-meta-agregados.js`, `node scripts/test-rd-stats-campanha.js` → sem regressão.
Run: `npx eslint lib/meta.js api/meta.js lib/resumo.js lib/leads-unificados.js api/rd-stats.js scripts/test-grupo-aula.js`.

- [ ] **Step 9: Commit**

```bash
git add lib/meta.js api/meta.js lib/resumo.js lib/leads-unificados.js api/rd-stats.js scripts/test-grupo-aula.js
git commit -m "feat(dados): grupo AULA no Meta, leads unificados, resumo e RD; agregado de compras da aula"
```

---

### Task 7: Aba "Aula paga" no dashboard

**Files:**
- Modify: `dashboard.html` (nav, painel, `?v=dash-3`, `<script>` novo)
- Modify: `assets/js/dash/grupo.js` (`NOME`, `FUNIL_RD`, gancho pós-render), `assets/js/dash/main.js` (loop de grupos), `assets/js/dash/executivo.js` (receita da aula)
- Create: `assets/js/dash/aula.js`
- Create: `scripts/test-dash-aula.js`

**Interfaces:**
- Consumes: `d.leads.compras` e `d.meta.grupos.AULA` (Task 6); helpers `D.setK`, `D.fmtR`, `D.fmtN`, `D.fmtP`, `D.pct`, `D.orDash`, `D.renderFunil`, `D.tabela`, `D.linhasCampanha`, `D.esc` já existentes em `assets/js/dash/*.js` (leia `graficos.js` e `tabelas.js` para as assinaturas).
- Produces: `D.renderAula(d)`; painel `#painelAULA`; aba `data-tab="aula"`.

- [ ] **Step 1: Teste `scripts/test-dash-aula.js`**

```js
'use strict';
/** Contrato da aba "Aula paga" no dashboard (sem navegador, lê os arquivos).
 *   node scripts/test-dash-aula.js */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
let falhas = 0;
const ok = (c, d) => { console.log(`  ${c ? '✓' : '✗'} ${d}`); if (!c) falhas += 1; };
const html = fs.readFileSync(path.join(RAIZ, 'dashboard.html'), 'utf8');
ok(/data-tab="aula"/.test(html), 'botão da aba aula');
ok(/id="painelAULA"/.test(html), 'painel AULA');
ok(/dash\/aula\.js\?v=dash-3/.test(html), 'aula.js carregado com v=dash-3');
ok(!/\?v=dash-2/.test(html), 'nenhum asset ainda em dash-2');
const grupo = fs.readFileSync(path.join(RAIZ, 'assets/js/dash/grupo.js'), 'utf8');
ok(/AULA: 'Aula paga'/.test(grupo), 'NOME.AULA');
ok(/AULA: 'AULA'/.test(grupo), 'FUNIL_RD.AULA');
const main = fs.readFileSync(path.join(RAIZ, 'assets/js/dash/main.js'), 'utf8');
ok(/\['SE', 'CAFE', 'CP', 'AULA'\]/.test(main), 'main renderiza AULA');
const aula = fs.readFileSync(path.join(RAIZ, 'assets/js/dash/aula.js'), 'utf8');
ok(/D\.renderAula = function/.test(aula), 'renderAula definido');
ok(/Sessões por 100 compradores/.test(aula), 'métrica do cliente presente');
ok(aula.split('\n').length <= 350, 'aula.js abaixo de 350 linhas');
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-dash-aula.js`.

- [ ] **Step 3: `dashboard.html`**

Após o botão `data-tab="cp"`, inserir (mesmo SVG do botão de grupo):

```html
  <button class="tab-btn lm-menu-item" data-tab="aula"><svg class="" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v2"/></svg><span><strong>Aula paga</strong><small>[AULA]</small></span><svg class="lm-menu-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>
```

Após `#tab-cp`: `<div class="tab-panel" id="tab-aula"><div class="container" id="painelAULA"></div></div>`.

Trocar todos os `?v=dash-2` por `?v=dash-3` (CSS e JS) e acrescentar `<script src="/assets/js/dash/aula.js?v=dash-3"></script>` antes de `main.js`.

- [ ] **Step 4: `grupo.js`, `main.js`, `executivo.js`**

`grupo.js`: `NOME = { SE: ..., CAFE: ..., CP: ..., AULA: 'Aula paga' }`; `FUNIL_RD = { SE: 'SE', CP: 'CP', AULA: 'AULA' }`; no fim de `D.renderGrupo`, `if (g === 'AULA' && typeof D.renderAula === 'function') D.renderAula(d);`.

`main.js`: `for (const g of ['SE', 'CAFE', 'CP', 'AULA']) seExiste(D.renderGrupo, g, d);`.

`executivo.js`: onde monta os cards, acrescentar um card "Receita da aula" visível só quando `d.leads && d.leads.compras && d.leads.compras.total > 0`, valor `D.fmtR(d.leads.compras.receita_centavos / 100)`, sub `${compras.total} compras`.

- [ ] **Step 5: `assets/js/dash/aula.js`**

```js
'use strict';
/* Aba [AULA]: o que só a aula paga tem — compras, receita, ROAS e a métrica do
   cliente (sessões estratégicas por 100 compradores). Renderiza dentro de
   #painelAULA depois do markup padrão do grupo (grupo.js). */
(function (D) {
  const markup = `
  <div class="kpi-groups" id="aulaKpis"><div class="kpi-group">
    <div class="kpi-group-label">Aula paga — compras no período</div>
    <div class="kpi-card green"><div class="kpi-label">Compras</div><div class="kpi-value" id="AULA-compras"></div><div class="kpi-sub" id="AULA-compras-sub"></div></div>
    <div class="kpi-card blue"><div class="kpi-label">Receita</div><div class="kpi-value" id="AULA-receita"></div></div>
    <div class="kpi-card purple"><div class="kpi-label">Custo por compra</div><div class="kpi-value" id="AULA-cpc"></div></div>
    <div class="kpi-card teal"><div class="kpi-label">ROAS</div><div class="kpi-value" id="AULA-roas"></div></div>
    <div class="kpi-card green"><div class="kpi-label">Sessões por 100 compradores</div><div class="kpi-value" id="AULA-sessoes"></div><div class="kpi-sub" id="AULA-sessoes-sub"></div></div>
    <div class="kpi-card purple"><div class="kpi-label">Custo por sessão</div><div class="kpi-value" id="AULA-cps"></div><div class="kpi-sub" id="AULA-cps-sub"></div></div>
  </div></div>
  <div class="section"><div class="section-title">🎟️ Funil da aula</div><div id="funilAULA"></div></div>
  <div class="section"><div class="section-title">📈 Leads × compras por dia</div><div class="chart-wrap" style="height:240px"><canvas id="chartAulaDia"></canvas></div></div>
  <div class="section"><div class="section-title">🎯 Compras por campanha <div class="section-tools"><button class="btn-csv" type="button" data-csv="tblComprasAULA">Exportar CSV</button></div></div><div class="table-wrap"><table id="tblComprasAULA"></table></div></div>`;

  function kpis(d, c, spend, pg, rows) {
    const sessoesSE = d.rd && d.rd.funis && d.rd.funis.SE ? d.rd.funis.SE.total : null;
    D.setK('AULA-compras', D.fmtN(c.total));
    document.getElementById('AULA-compras-sub').textContent = pg ? `Lead → compra ${D.orDash(D.pct(c.total, pg.leads), D.fmtP)}` : '';
    D.setK('AULA-receita', D.fmtR(c.receita_centavos / 100));
    D.setK('AULA-cpc', c.total ? D.fmtR(spend / c.total) : '—');
    D.setK('AULA-roas', spend > 0 ? (c.receita_centavos / 100 / spend).toFixed(2) + 'x' : '—');
    D.setK('AULA-sessoes', c.total ? D.fmtN(Math.round(100 * c.compradores_com_sessao / c.total)) : 'aguardando');
    document.getElementById('AULA-sessoes-sub').textContent = `${D.fmtN(c.compradores_com_sessao)} compradores com sessão`;
    D.setK('AULA-cps', c.compradores_com_sessao ? D.fmtR(spend / c.compradores_com_sessao) : '—');
    document.getElementById('AULA-cps-sub').textContent = sessoesSE !== null && d.meta.grupos.SE && sessoesSE > 0
      ? `via SE direto: ${D.fmtR(d.meta.grupos.SE.spend / sessoesSE)}` : 'via SE direto: sem base';
  }

  D.renderAula = function (d) {
    const el = document.getElementById('painelAULA');
    if (!el) return;
    let box = document.getElementById('aulaExtra');
    if (!box) { box = document.createElement('div'); box.id = 'aulaExtra'; box.innerHTML = markup; el.appendChild(box); }
    const c = (d.leads && d.leads.compras) || { total: 0, receita_centavos: 0, por_dia: [], por_campanha: [], compradores_com_sessao: 0 };
    const spend = d.meta.grupos.AULA ? d.meta.grupos.AULA.spend : 0;
    const pg = d.leads ? d.leads.por_grupo.AULA : null;
    const st = d.stats && d.stats.por_pagina ? d.stats.por_pagina['/aula-gestao-operacional'] : null;
    kpis(d, c, spend, pg, null);
    D.renderFunil('funilAULA', [
      { nome: 'Visitantes', valor: st ? st.visitantes : null },
      { nome: 'Abriu o formulário', valor: st ? st.abriu_modal : null },
      { nome: 'Leads', valor: pg ? pg.leads : null },
      { nome: 'Compras', valor: c.total },
      { nome: 'Sessão agendada', valor: c.compradores_com_sessao },
    ]);
    const leadsDia = d.leads ? d.leads.por_dia : [];
    D.graficoLinhas('chartAulaDia', leadsDia.map(x => x.dia), [
      { label: 'Leads', data: leadsDia.map(x => (x.grupos && x.grupos.AULA) || 0) },
      { label: 'Compras', data: leadsDia.map(x => { const k = c.por_dia.find(y => y.dia === x.dia); return k ? k.compras : 0; }) },
    ]);
    const rows = c.por_campanha.map(r => {
      const m = (d.meta.campanhas || []).find(x => x.campaign_name === r.campanha);
      const gasto = m ? m.spend : 0;
      return { campanha: r.campanha, compras: r.compras, receita: r.receita_centavos / 100, custo_compra: r.compras ? gasto / r.compras : null, roas: gasto ? (r.receita_centavos / 100) / gasto : null };
    });
    D.tabela('tblComprasAULA', rows, ['campanha', 'compras', 'receita', 'custo_compra', 'roas']);
  };
})(window.SPD = window.SPD || {});
```

Ajuste os nomes dos helpers ao que existe de fato em `graficos.js`/`tabelas.js` (`D.graficoLinhas` pode se chamar diferente; `D.tabela` pode exigir colunas registradas em `COLUNAS`) — leia os dois arquivos antes e adapte, mantendo a estrutura acima. Se `stats.por_pagina` não trouxer `abriu_modal`, use os eventos do funil (`open-modal`) que `/api/stats` já expõe.

- [ ] **Step 6: Verificar no navegador (uma rodada)**

Com `vercel dev`: abrir `http://localhost:3000/dashboard#aula`, sem tokens do Meta o painel avisa mas renderiza. Screenshot 1440 em `.impeccable/review/dash-aula.png`; `agent-browser console` limpo.

- [ ] **Step 7: Testes, lint e commit**

Run: `node scripts/test-dash-aula.js` e `node scripts/test-dash-cruzamento.js` → `Tudo certo`; `npm run lint`.

```bash
git add dashboard.html assets/js/dash/aula.js assets/js/dash/grupo.js assets/js/dash/main.js assets/js/dash/executivo.js scripts/test-dash-aula.js
git commit -m "feat(dash): aba Aula paga com compras, receita, ROAS e sessões por 100 compradores; assets em dash-3"
```

---

### Task 8: Validação final e publicação

**Files:** nenhum novo — verificação.

- [ ] **Step 1: Suíte completa**

```bash
for t in test-leads-aula test-kiwify-webhook test-form-passos test-grupo-aula test-dash-aula test-lead-qualificado test-eventos-qualificados test-leads-unificados test-pageview test-dash-cruzamento; do echo "== $t"; node scripts/$t.js || exit 1; done
npm run lint && npm run lint:biome
```

Expected: tudo verde; contagem de avisos de lint igual ou menor à linha de base do `CLAUDE.md`.

- [ ] **Step 2: Detector de design e browser (uma rodada em lote)**

`node /Users/thaleslorenzo/.claude/skills/impeccable/scripts/detect.mjs --json aula-gestao-operacional/index.html aula-gestao-operacional/aula.css dashboard.html assets/js/dash/aula.js` → sem achado aberto.

agent-browser em 390×844 e 1440×900 na página e no `#aula` do dashboard: screenshots, `a11y`, `console`, `network requests`, `vitals`. Modal: passo 1 → "5 a 9" → aviso com link do Clube e "Continuar mesmo assim" → passo 2 → submit com dados de teste e `?sp_interno=1` → confirmar redirect montado com `name`, `email`, `phone`, `sck`, UTMs (em dev o `checkoutUrl` vazio cai na própria página — checar a URL no console antes do redirect).

- [ ] **Step 3: Revisão de código**

Dispatch `code-reviewer` (bug, tratamento de erro, contrato de campos) e `security-reviewer` (HMAC do webhook, PII em log, entrada do webhook) sobre o diff `git diff main...HEAD`. Corrigir o que for real; registrar o que ficou de fora e por quê.

- [ ] **Step 4: Publicação e configuração**

1. `git push` da branch (deploy da Vercel é por push; CLI negada neste projeto). Abrir PR para `main`.
2. No painel da Vercel: envs da Task 1 (com os ids que o Bruno criar no CRM), e as três listas de páginas atualizadas.
3. Kiwify: produto R$ 47, Pixel nativo desligado, webhook para `https://<domínio>/api/kiwify-webhook` com token; página de obrigado apontando para `/aula-gestao-operacional/obrigado`.
4. Preencher `window.AULA.checkoutUrl` (e `data` quando o Bruno definir) e commitar.
5. Compra de teste real de R$ 47 com `?sp_interno=1`: conferir `sevilha_compras_aula`, `Purchase` no Events Manager (sem `META_TEST_EVENT_CODE`), deal `[AULA]` no stage pago, aba do dashboard. Se a assinatura HMAC não bater, aplicar a alternativa do corpo bruto anotada em `lib/kiwify.js`.
6. Atualizar `PRODUCT.md` (nova oferta na tabela, `api/` em 12/12) e `DESIGN.md` (superfície `/aula-gestao-operacional`, tokens da aula) — commit `docs:`.

- [ ] **Step 5: Encerramento**

`graphify update .`; memória do projeto com o que só existe fora do repo (ids do CRM, token no painel, data da turma); nota no vault se alguma lição valer para outro projeto (webhook multiplexado por rewrite no Hobby é candidata).

---

## Self-review

- **Cobertura da spec:** Seção 1 (página, config, obrigado, OG, noindex) → Task 5; layout → Task 5 CSS/HTML; Seção 2 (`data-*`, URL do checkout com `sck`, `InitiateCheckout` Pixel, redirect em 1,2 s, falha de rede redireciona) → Task 4; Seção 3 (`OFERTAS`, `Lead` value 47, `InitiateCheckout` CAPI, webhook, tabela, stage pago, envs) → Tasks 1, 2, 3; Seção 4 (grupo AULA no pipeline, `compras`, funil RD, aba, `aula.js`, executivo, `dash-3`) → Tasks 6, 7; Seção 5 (testes, lint, browser, produção, push) → cada task + Task 8. Pendências do cliente ficam na Task 8 Step 4.
- **Placeholders:** nenhum "TBD"; os pontos "adapte ao helper existente" (Task 7 Step 5) apontam o arquivo exato a ler.
- **Consistência de nomes:** `tratarKiwify`, `agregarCompras`, `GRUPO_POR_PAGINA`, `D.renderAula`, `window.SP_urlCheckout`, `window.AULA`, `ic:<event_id>`, `kiwify:<order_id>`, `sevilha_compras_aula`, `RD_CRM_STAGE_ID_AULA_PAGO` usados com o mesmo nome em todas as tasks.
