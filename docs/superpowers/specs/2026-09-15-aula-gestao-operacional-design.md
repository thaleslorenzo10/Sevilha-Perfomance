# Aula paga "Gestão Operacional" — página de vendas, funil e aba no dashboard

Data: 2026-09-15. Estado: aprovado em conversa, aguardando revisão do texto.

## Objetivo

Colocar no ar um segundo funil de entrada para a Consultoria Performance: uma
aula paga ao vivo (R$ 47, Zoom, 2h10) conduzida por Bruno Silvestre, com
página de vendas própria, lead capturado antes do checkout, compra na Kiwify,
eventos `Lead`, `InitiateCheckout` e `Purchase` no Meta por Pixel e CAPI, e uma
aba própria no dashboard para comparar este funil com a Sessão Estratégica.

A métrica de sucesso do teste, definida pelo cliente: **sessões estratégicas
geradas por 100 compradores** — não CPL nem volume de inscrição.

## Fontes

- Reunião "REUNIÃO TRÁFEGO - Bruno e Thales", 10/09/2026 (transcrição Tactiq):
  leads qualificados caíram de 50-60/mês para 10 em setembro; 100% da entrada
  depende do funil de sessão estratégica; decisão de testar aula paga ao vivo
  (5 edições antes de gravar), 15 dias de venda, oferta no fim = sessão
  estratégica.
- Briefing preenchido por Bruno em 14/09/2026 em `/briefing-aula`, gravado em
  `sevilha_briefings_aula` (Supabase, id `f0a8f0d7-…`). Toda a copy da página
  sai de lá.
- `PRODUCT.md` e `DESIGN.md` do repositório.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Rota | `/aula-gestao-operacional` (pasta `aula-gestao-operacional/`) |
| Checkout | Kiwify, link externo, após captura do lead na página |
| Identidade | Nova: roxo `#150C43`, verde neon `#50DC00`, Poppins (briefing) |
| Preço | R$ 47 (briefing; R$ 17 da reunião foi descartado pelo cliente) |
| Data e provas | Página publica sem; data/hora/checkout em bloco de config; seção de provas só quando houver autorização escrita |
| Tracking | PageView, Lead, InitiateCheckout e Purchase via Pixel + CAPI |
| Purchase | Webhook da Kiwify numa function existente (Hobby está em 12/12) |
| Dashboard | Aba própria "Aula paga" com grupo `AULA` em todo o pipeline |

## O que a página pode e não pode dizer

Pode: aula de 2h10 + 15 min de perguntas; Zoom; 19h30
(Brasília), terça ou quarta; link por e-mail e WhatsApp (D-1, manhã, 30 min
antes); inscrições encerram 2 h antes; gravação por 7 dias; sem limite de
vagas; kit de 5 planilhas; público 10+ colaboradores **escrito na página**;
Bruno Silvestre, cofundador e diretor comercial, ~20 anos em gestão, formação
Falconi, dedicação ao setor contábil desde 2019, "mais de 500 projetos pelo
grupo"; casos anonimizados com número (8% do tempo do fiscal num cliente, 25%
do dia em e-mail, DAS 20% vs automação de 1,5%).

Não pode: depoimento, logo, case nominal (sem autorização); preço âncora;
promessa de resultado em prazo; "sócio" para o Bruno; contador de vagas ou
escassez artificial; menção à sessão estratégica como parte da venda (é o
convite do palco).

## Seção 1 — Página

Pilha vertical, mobile-first. Tokens em `aula-gestao-operacional/aula.css`:

```
--roxo      #150C43   hero, fechamento, texto
--neon      #50DC00   marca da headline, botão principal
--neon-ink  verde escuro com contraste AA sobre branco (texto)
--ink, --muted, --chao  como em DESIGN.md
```

Poppins 700/800 (títulos, números, botões), Inter (corpo). Escala tipográfica
de `DESIGN.md`; sem tamanhos intermediários.

Config no topo do HTML — única coisa que muda entre edições:

```html
<script>
window.AULA = {
  data: '2026-10-14',            // ISO; vazia = página fica noindex e o hero diz "próxima turma"
  hora: '19:30',
  checkoutUrl: 'https://pay.kiwify.com.br/XXXX',
  precoCentavos: 4700,
};
</script>
```

Seções, na ordem:

1. **Hero** — tag "Aula ao vivo · Zoom · {data} às 19h30". H1 "O projeto que
   transforma a **operação** de um escritório contábil — do mapeamento à
   margem" (marca verde na palavra). Sub: "2h10 de método aberto, com as 5
   planilhas que a Sevilha usa em cliente. Para dono de escritório com 10+
   colaboradores." Preço `R$ 47`, botão "Garantir minha vaga" (`.open-modal`).
2. **Reconhece o problema** — lista com as 6 frases do campo `problema`.
3. **Por que contratar mais gente não resolveu** — técnica dominada, gestão
   sem número; ponte para o método.
4. **O que você vai ver** — 5 blocos numerados (`conteudo`), cada um com o caso
   anonimizado correspondente (`pratica`).
5. **O que você leva** — kit de 5 planilhas + gravação 7 dias. Duas colunas:
   "garantido na aula" e "depende de aplicação depois" (`resultado`).
6. **Quem conduz** — Bruno, foto (placeholder neutro até ele enviar), 5 linhas.
7. **Para quem é / não é** — 10+ explícito; "não é para": autônomo, escritório
   de 1-3 pessoas, estudante, funcionário operacional. Link para o Clube para
   quem tem menos de 10.
8. **Como funciona** — Zoom, link por e-mail + WhatsApp, 2h10 + 15 min,
   inscrições encerram 2 h antes, gravação 7 dias.
9. **FAQ** — 5 itens: precisa estar ao vivo? é para o meu porte? o que acontece
   depois? reembolso (regra da Kiwify, 7 dias)? é a mentoria? (não — é o método
   da Consultoria Performance).
10. **Fechamento roxo** — oferta + botão.

### Layout (decidido em mockups no visual companion, 15/09)

Mundo visual: **ingresso / credencial de evento**. Roxo `#150C43` é o palco
(hero, bloco do Bruno, fechamento); as seções de leitura são claras
(`#f3f1fa` de fundo, cartões brancos com borda `#e2def2`); verde `#50DC00` só
na marca da headline, no botão principal e nos números de destaque. Nenhum
gradiente roxo/rosa, nenhuma borda lateral colorida em cartão, nenhum ícone
decorativo; números com `font-variant-numeric: tabular-nums`.

Regras de `DESIGN.md` que valem aqui: **sem tag/eyebrow acima do H1**
(qualificador de público vai dentro da tabela da oferta, onde é lido como
critério); sem caixa alta em corpo; foco com `outline`, não `box-shadow`.

- **Hero (opção "Ingresso")** — H1 com marca verde, uma linha de apoio e um
  cartão branco picotado (linha tracejada `2px dashed` separando corpo e
  canhoto). Corpo em grade 2×2: Data · Horário · Onde (Zoom, ao vivo) ·
  Perfil (Escritórios 10+). Canhoto: `R$ 47` grande + "gravação por 7 dias
  inclusa" + botão "Garantir vaga". A data vem de `window.AULA`.
- **As 5 etapas (opção "Programação")** — linha do tempo vertical pontilhada;
  cada parada tem círculo roxo com número em verde, título da etapa, uma frase
  do que acontece e o caso real em caixa branca rotulada "Caso real,
  anonimizado".
- **O que você leva** — dois cartões lado a lado (empilhados no celular):
  "Garantido na aula" (pílula verde) e "Depende de aplicação depois" (pílula
  cinza), com o conteúdo do campo `resultado` + as 5 planilhas + gravação.
- **Quem conduz (opção "Faixa com a voz dele")** — bloco roxo com foto redonda
  (borda verde 3px), nome e cargo, a frase do briefing em destaque ("Não é uma
  palestra sobre o problema. É o projeto inteiro, aberto.") e três fatos em
  cartões de contorno fino: ~20 anos em gestão (Falconi) · desde 2019 só setor
  contábil · +500 projetos pelo grupo.
- Demais seções (problema, por que contratar não resolveu, para quem é, como
  funciona, FAQ, fechamento) seguem a mesma linguagem: cartão branco em fundo
  claro, fechamento roxo repetindo o canhoto do ingresso.

`<title>`, description e OG próprios (`assets/og-aula.png`). `noindex` enquanto
`AULA.data` estiver vazia. Página de obrigado estática em
`/aula-gestao-operacional/obrigado` ("o link chega por e-mail e WhatsApp"),
destino da página de obrigado da Kiwify; só PageView.

## Seção 2 — Formulário e checkout

Modal de dois passos de `assets/form-steps.js`, o mesmo de `/mentoria`. Três
pontos ganham parametrização por `data-*` no `<form id="sessao-form">`; **sem
os atributos, o comportamento é exatamente o atual** (WhatsApp, `/campanha`),
para `/mentoria` e `/mentoria-2` não mudarem durante o teste A/B:

- `data-destino="kiwify"` — `mostrarSucesso()` monta
  `AULA.checkoutUrl?name=&email=&phone=` (pré-preenchimento nativo da Kiwify)
  + UTMs capturadas pelo `tracking.js` + `fbclid` + `sck=<event_id do lead>`.
  O `sck` volta no webhook e é o que casa compra ↔ lead. Redirect em 1,2 s.
- `data-textos="aula"` — passo 1 "Antes do pagamento, duas perguntas"; passo 2
  "Onde enviamos o link da aula".
- `data-porte-bloqueia="nao"` — abaixo de 10 vê aviso ("A aula foi feita para
  escritórios com 10+. Para o seu porte, o Clube da Performance entrega mais.")
  com link do Clube **e** "Continuar mesmo assim" (`#route-continuar`, já
  existe).

Campos e `name=` idênticos (`colaboradores`, `cargo`, `nome`, `email`,
`telefone`, `escritorio` opcional) — contrato com `/api/leads`. Hidden
`pagina=/aula-gestao-operacional`.

Sequência no submit: `SP_handleSubmit` → `/api/leads` → sucesso →
`fbq('track','Lead',{…},{eventID})` (já existe) + `fbq('track',
'InitiateCheckout', {value: 47, currency: 'BRL', content_name}, {eventID:
'ic:' + eventId})` → redirect. Se `/api/leads` falhar de vez (retry e
`localStorage` já existem), redireciona mesmo assim: compra perdida custa mais
que lead perdido, e o webhook recupera o contato.

Kiwify: produto "Aula — Gestão Operacional", R$ 47, nome/e-mail/telefone
obrigatórios, **Pixel nativo desligado** (senão `Purchase` conta duas vezes),
webhooks `order.paid` e `order.refunded` para `/api/kiwify-webhook` com token.

## Seção 3 — Backend e tracking

### `api/leads.js`

```js
const AULA = {
  rotulo: 'Aula Gestão Operacional', marca: '[AULA]',
  conversao: 'aula-gestao-operacional', tags: ['aula', 'gestao-operacional'],
  stageEnv: 'RD_CRM_STAGE_ID_AULA', campaignEnv: 'RD_CRM_CAMPAIGN_ID_AULA',
};
OFERTAS['/aula-gestao-operacional'] = AULA;
```

Sem as envs de stage/campanha: cai no padrão com `console.warn`, lead não
bloqueia. Quando `ofertaDe(pagina) === AULA`: `Lead` CAPI com
`content_category: 'aula'`, `value: 47`, `currency: 'BRL'`; e um
`InitiateCheckout` CAPI com `event_id = 'ic:' + eventId`, mesmos `user_data`.
`LeadQualificado` (10+) inalterado.

### Webhook Kiwify — `lib/kiwify.js`, despachado por `api/eventos-qualificados.js`

- `vercel.json`: rewrite `/api/kiwify-webhook` → `/api/eventos-qualificados`.
  No handler, `caminho.includes('kiwify-webhook')` despacha para
  `tratarKiwify(req, res)` antes da checagem de segredo do cron (mesmo padrão
  do `crm-webhook`).
- Auth: Kiwify envia `?signature=` = HMAC-SHA1 do corpo bruto com o token do
  webhook. Compara com `crypto.timingSafeEqual` contra `KIWIFY_WEBHOOK_TOKEN`.
  Inválido → 401, nada gravado. Corpo precisa ser lido bruto (não o `req.body`
  já parseado) para o HMAC bater.
- `order.paid` → upsert em `sevilha_compras_aula` por `order_id` + `Purchase`
  CAPI. `order.refunded` → atualiza `status`, sem evento. Demais eventos → 200
  sem ação (não-2xx faz a Kiwify reenviar).
- `Purchase`: `event_id = 'kiwify:' + order_id`; `user_data` por
  `montarUserData` (email, telefone, nome hasheados) + `fbp`/`fbc`/`external_id`
  do lead localizado pelo `sck` (fallback: e-mail normalizado); `value` do
  pedido em reais, `currency BRL`, `content_name 'Aula Gestão Operacional'`,
  `content_ids [order_id]`. Dedupe por `sevilha_eventos_enviados`
  (`jaEnviados`/`marcarEnviados`). Responde 200 mesmo com CAPI fora; a falha
  vai em `capi_status` e no log.
- Nunca com `META_TEST_EVENT_CODE` ativo em produção (skill `meta-capi`).

### Tabela — `sql/compras-aula.sql`

```sql
create table if not exists sevilha_compras_aula (
  order_id        text primary key,
  status          text not null,               -- paid | refunded
  email           text, nome text, telefone text,
  valor_centavos  integer not null,
  sck             text,                        -- event_id do lead
  lead_id         uuid references sevilha_leads(id),
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  capi_status     text,
  pago_em         timestamptz,
  payload         jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on sevilha_compras_aula (pago_em);
create index on sevilha_compras_aula (lower(email));
```

UTMs copiadas do lead quando o `sck` casa; senão, das `utm_*` que a Kiwify
repassa do checkout.

### Envs (`.env.example`, com comentário de onde buscar)

`KIWIFY_WEBHOOK_TOKEN` (Kiwify → Apps → Webhooks → token),
`RD_CRM_STAGE_ID_AULA`, `RD_CRM_CAMPAIGN_ID_AULA`, `RD_CRM_PIPELINE_ID_AULA`;
acrescentar `/aula-gestao-operacional` em `PAGEVIEW_BEACON_PAGES`,
`LEADS_SHEET_WRITE_PAGES` e `SESSAO_ESTRATEGICA_PAGINAS`. Em produção via
Vercel; segredo nunca no chat.

### Página

`assets/tracking.js` sem alteração: PageView, beacon `/api/pageview`, funil de
scroll/modal, `?sp_interno=1`.

## Seção 4 — Aba "Aula paga" no dashboard

Grupo `AULA` em todo o pipeline:

- `lib/meta.js` `classifyCampaign`: `[AULA]` → `AULA`. `lib/resumo.js` limpa
  `[AULA]` do nome; captação soma `AULA`.
- `lib/leads-unificados.js`: `GRUPO_POR_PAGINA['/aula-gestao-operacional'] =
  'AULA'`; `por_grupo` inclui `AULA`. Payload ganha `compras` quando há
  registros no período: `{ total, receita_centavos, por_dia, por_campanha,
  por_conjunto, por_anuncio, compradores_com_sessao }`. `compradores_com_sessao`
  = compras cujo contato (`chavesContato`) bate com deal `[SE]` criado **depois**
  de `pago_em`.
- `api/rd-stats.js`: funil `AULA` por `RD_CRM_PIPELINE_ID_AULA`; sem env, a
  seção do RD fica oculta (como no Café).
- `dashboard.html`: botão `data-tab="aula"` ("Aula paga · [AULA]"),
  `#painelAULA`; assets em `?v=dash-3`.
- `assets/js/dash/grupo.js`: `NOME.AULA`, `FUNIL_RD.AULA`; `main.js` renderiza
  `['SE','CAFE','CP','AULA']`.
- `assets/js/dash/aula.js` (novo, < 350 linhas): bloco extra renderizado dentro
  de `#painelAULA` depois do markup padrão —
  - KPIs: Compras · Receita · Custo por compra · Lead → compra % · ROAS ·
    **Sessões por 100 compradores** ("aguardando" enquanto 0) · Custo por
    sessão via aula vs via SE direto.
  - Funil: visitantes → abriu modal → lead → compra → sessão agendada
    (`D.renderFunil`).
  - Série diária leads × compras (Chart.js).
  - Tabela por campanha com compras, custo/compra, receita, ROAS; CSV.
- `executivo.js`: "Receita da aula" no card executivo quando > 0.

A Visão geral já lista CPL/CPMQL por grupo; o comparativo entre funis sai de lá
sem trabalho extra.

## Seção 5 — Testes e validação

- `scripts/test-form-passos.js`: `data-destino="kiwify"` monta URL com
  `name/email/phone`, UTMs e `sck`; sem `data-*` o fluxo é o atual.
- `scripts/test-api-leads-e2e.js`: `/aula-gestao-operacional` → oferta
  `[AULA]`; `Lead` e `InitiateCheckout` com ids pareados.
- `scripts/test-kiwify-webhook.js` (novo): assinatura inválida → 401;
  `order.paid` → upsert + `Purchase` `kiwify:<order_id>`; reentrega → no-op;
  `order.refunded` → status sem evento; CAPI fora → 200 e `capi_status`.
- `scripts/test-meta-agregados.js` ou equivalente: `classifyCampaign('[AULA]…')`.
- `scripts/test-leads-unificados.js`: grupo `AULA` e agregado `compras`.
- `scripts/test-dash-cruzamento.js`: colunas de compra.
- `npm run lint` e `npm run lint:biome` sem novo erro; arquivos novos abaixo de
  350 linhas.
- agent-browser em 390 e 1440: hero, modal nos dois passos, aviso de porte,
  URL de redirect com parâmetros, console limpo, `a11y` sem violação de
  contraste, `vitals`; dashboard com a aba nova renderizando com dados vazios.
- Produção: preview da Vercel não tem tokens do Meta/Kiwify (memória do
  projeto). Validação real com `?sp_interno=1`, pedido de teste na Kiwify e
  conferência no Events Manager; `META_TEST_EVENT_CODE` removido antes de
  anunciar.
- Publicação: push na branch (deploy via CLI é negado neste projeto).

## Fora do escopo

Grupo do Meta para campanhas (ads, criativos, YouTube — outra frente da
reunião); versão gravada da aula; e-mails/WhatsApp de lembrete (Kiwify + RD);
seção de provas sociais (entra quando houver autorização por escrito); domínio
próprio.

## Pendências do cliente

Data da 1ª edição; foto do Bruno; link do checkout Kiwify e token do webhook;
pipeline/stage `[AULA]` no RD CRM; capacidade do Zoom; autorização dos casos.
