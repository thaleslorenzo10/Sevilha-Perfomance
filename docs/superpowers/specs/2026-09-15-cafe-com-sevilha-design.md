# Café com Sevilha — página `/cafe-com-sevilha` dentro do site

**Data:** 2026-09-15 · **Branch:** `feat/cafe-com-sevilha` · **Status:** aprovado em conversa, aguardando revisão do texto

## Por que

A página do Café com Sevilha vive numa landing page do RD Station
(`lp.sevilhaperformance.com.br/cafe-com-sevilha`). O formulário posta em
`cta-redirect.rdstation.com`, o Pixel dispara só no navegador, não há UTM na
tabela e o webhook do RD que deveria trazer o lead para o painel **nunca
entregou uma linha** (conferido no Supabase em 15/09: zero registros com
`pagina like 'rd:%'`). Hoje o Café não existe no painel.

Trazer a página para o site resolve os três problemas de uma vez: o lead nasce
em `/api/leads` (Supabase + planilha + RD Marketing + RD CRM + Pixel/CAPI
dedupados), entra no grupo `CAFE` que o painel já tem, e a página passa a ser
medida como as irmãs.

## Decisões tomadas com o cliente

| Decisão | Escolha |
|---|---|
| Visual | **Réplica fiel** do mundo visual da página do RD: navy + teal + creme, título serifado. Copy palavra por palavra. |
| Pipeline | **`/api/leads`** com oferta nova `[CAFÉ]`. |
| Rota | **`sevilha-perfomance.vercel.app/cafe-com-sevilha`**, substitui a LP do RD; anúncios passam a apontar para cá. |
| Formulário | **Modal de dois passos** (o mesmo `assets/form-steps.js` das irmãs), aberto por vários botões ao longo da página. **Sem captcha matemático.** |

## Superfície (modo Persuade)

Um arquivo estático, `cafe-com-sevilha/index.html`, servido em
`/cafe-com-sevilha` como `/mentoria` (pasta + `index.html`; `vercel.json` não
precisa de rewrite). CSS inline como as irmãs.

### Seções, na ordem da original

1. **Header** — logo `/assets/logo-sevilha-performance.png` + botão
   "Manifestar interesse" (`.open-modal`).
2. **Hero** (navy) — kicker "Encontro presencial • São Paulo"; h1 "Um dia entre
   líderes que estão construindo o futuro da contabilidade."; parágrafo; três
   fatos em linha (**06 OUT** São Paulo, SP · **1 DIA** Sede da Sevilha
   Contabilidade · **+10** Colaboradores na equipe); CTA teal "Quero manifestar
   interesse ↗" (`.open-modal`); à direita a foto dos três sócios com o blob
   teal e os três nomes embaixo (Bruno Silvestre · Vicente Sevilha · Rodrigo
   Pires).
3. **"Uma mesa pequena para conversas grandes."** — fundo claro `#eef5f6`,
   kicker "Café, conversa e gestão de verdade", dois parágrafos à direita.
4. **"Três perspectivas. Uma gestão mais consistente."** — navy, kicker "O que
   estará na mesa", parágrafo de apoio, três colunas numeradas
   (01 Estratégia · com Vicente Sevilha / 02 Processos · com Bruno Silvestre /
   03 Pessoas · com Rodrigo Pires). Fecha com botão `.open-modal`.
5. **"Um encontro desenhado para quem toma decisões."** — creme `#f2ebdd`,
   kicker "Por que participar", grade 2×2 numerada (01–04). Fecha com botão
   `.open-modal`.
6. **"Reserve o dia. A conversa começa ao redor da mesa."** — navy, logo à
   esquerda; à direita a tabela Data / Local / Formato / Para quem com filete
   teal no topo. Fecha com botão `.open-modal`.
7. **`#interesse`** — faixa teal: kicker "6 de outubro • São Paulo", h2
   "Manifeste seu interesse no Café com Sevilha.", parágrafo "Clique abaixo e
   responda duas perguntas rápidas. Nossa equipe entrará em contato com as
   próximas informações." e o botão principal `.open-modal` "Quero
   participar!". A âncora `#interesse` continua existindo porque os anúncios e
   o link do header apontam para ela.
8. **Rodapé** — logo pequena + "© Sevilha Performance. Todos os direitos
   reservados."
9. **Botão flutuante de WhatsApp** — `https://wa.me/5531999491532`, o mesmo
   número do `/mentoria`. Se o atendimento do Café for outro número, é uma
   linha para trocar.

### Tokens

```
--navy       #0a2033   fundo do hero e das seções escuras
--navy-deep  #07182b   fundo do formulário / rodapé
--navy-card  #0b2239   cartões sobre navy
--teal       #20a2a8   botões, kickers, filetes
--teal-ink   #136f75   teal legível sobre claro/creme (#167f85 dava 4,02:1 sobre o creme; este dá 4,98:1)
--teal-soft  #75d2d3   apoio sobre navy
--cream      #f2ebdd   seção "Por que participar"
--light      #eef5f6   seção "Uma mesa pequena"
--ink        #0a2033   texto sobre claro
--muted      #5a6178   apoio sobre claro
```

Vermelho de erro: `#c62828` (o do projeto).

### Tipografia

Títulos em `Georgia, "Times New Roman", serif`, peso 500 — é exatamente o que a
original renderiza, e custa zero download. Corpo em Inter (o projeto já usa).
Escala: h1 `clamp(2.4rem, 5vw, 4.5rem)` com `line-height: 1`, h2
`clamp(1.9rem, 3.2vw, 2.75rem)`, h3 1.35rem, corpo 1rem, apoio .85rem, kicker
.72rem em caixa alta com `letter-spacing: .14em`. Só o kicker é caixa alta.

### Regras do projeto que valem aqui

- Foco com `outline` no raio do elemento, nunca `box-shadow`.
- Animação de entrada só **adiciona**, declarada dentro de
  `@media (prefers-reduced-motion: no-preference)`; nada nasce com
  `opacity: 0`.
- `<img>` com `width`/`height` e `height: auto` no CSS (regra paga no celular).
- Cadeia flex do modal com `min-height: 0`.
- Nenhum eyebrow qualificador acima do h1: o kicker do hero é "Encontro
  presencial • São Paulo" — informação de evento, não corte de público. O corte
  ("+10 colaboradores") fica nos fatos do hero e na tabela "Para quem", como na
  original; quem tem menos responde no modal e é roteado, não dispensado.

### O que diverge da original, de propósito

- **Sem jQuery, select2, choices.js nem scripts do RD.** Só o snippet do Pixel e
  `assets/tracking.js` + `assets/form-steps.js`.
- **Sem captcha "4 + 2 = ?"** — nenhuma página do site usa; se vier spam, entra
  depois no `/api/leads`, não na página.
- **Selects viram pílulas** `<input type="radio">` (regra do iOS já paga).
- **Formulário inline vira modal** com botões ao longo da página.

## Formulário

### Modal de dois passos, o mesmo das irmãs

Reusa `assets/form-steps.js` inteiro — passo 1 (porte + cargo, um toque cada),
passo 2 (nome, WhatsApp, e-mail, escritório), roteamento de quem tem menos de
10 para a aula paga (`data-rota`) com "Continuar mesmo assim", máscara de telefone,
foco preso no diálogo, Esc fecha, micro-eventos do funil via `SP_marcar`.

O que muda para o Café é **copy e destino do sucesso**, e isso entra pelo
mesmo mecanismo que a aula paga já usa — atributos `data-*` no `<form>`, não
cópia do arquivo:

```html
<form id="sessao-form" onsubmit="submitForm(event)" data-destino="inline" data-textos="cafe"
      data-whatsapp="https://wa.me/5531999491532?text=…">
```

Em `assets/form-steps.js`:

- `TEXTOS_POR_OFERTA` ganha a entrada `cafe`:
  passo 1 "Duas perguntas rápidas" / "Elas definem se o Café com Sevilha é o
  formato certo para o seu escritório."; passo 2 "Onde falamos com você" /
  "Nossa equipe entra em contato com as próximas informações do encontro."
- `DESTINO` aceita um terceiro valor, `'inline'`: `mostrarSucesso()` mostra o
  `#form-success` e **não agenda redirecionamento** nenhum (nem WhatsApp nem
  checkout).
- `data-whatsapp` troca a URL que `#err-wa` e `#wa-link` recebem — sem isso os
  dois links do Café abririam o WhatsApp com a mensagem da Sessão Estratégica.
- `data-rota` troca o destino de quem está abaixo do porte (padrão `/campanha`).
  **No Café é `/aula-gestao-operacional`** — decisão do cliente em 15/09: quem
  tem menos de 10 vai para a aula paga, não para o Clube. O link leva as UTMs
  junto (`utm_*`, `fbclid`, `gclid` da `sessionStorage`, onde o `tracking.js`
  as guarda); sem isso o clique vira visita orgânica na outra página. As irmãs
  ganham o mesmo anexo de UTM no link de rota delas.

Sem atributo, o comportamento é o de hoje — `/mentoria`, `/mentoria-2` e a
aula não mudam.

### HTML do modal na página do Café

Os mesmos ids que `form-steps.js` procura (a lista em
`scripts/test-form-passos.js`): `modal-overlay form-wrapper sessao-form
modal-foot passo-1 passo-2 passo-rotulo modal-title modal-sub route-porte
clube-link route-continuar route-cargo grupo-cargo form-error err-wa
form-success wa-link submit-btn voltar-passo-1 f-name f-phone`. A página entra
na lista `PAGINAS` desse teste, que passa a conferir os `value` dos rádios
contra `lib/porte.js` também aqui.

Campos, com o `name=` que é contrato com `/api/leads`:

| Campo | `name` | Tipo | Obrigatório |
|---|---|---|---|
| Quantos colaboradores | `colaboradores` | rádio-pílula (De 0 a 4 … Mais de 50) | máquina de passos |
| Posição no escritório | `cargo` | rádio-pílula (Dono/Sócio · Cargo Gerencial · Cargo Operacional) | máquina de passos |
| Nome | `nome` | text | sim |
| WhatsApp | `telefone` | tel | sim |
| E-mail | `email` | email | sim |
| Escritório | `escritorio` | text | não (a original exigia; aqui vale a regra do site — era o quarto obrigatório seguido) |
| UTMs, `fbclid gclid ttclid msclkid fbp fbc external_id event_id page_url` | hidden | — | preenchidos por `tracking.js` |

Copy dos avisos de rota (dentro do HTML, como nas irmãs):

- `#route-porte` (abaixo de 10): "O Café é para escritórios com mais de 10
  colaboradores. Para o seu porte, a aula de Gestão Operacional é o caminho
  certo." Botões: "Conhecer a aula" (`#clube-link` → `/aula-gestao-operacional`
  com UTMs) · "Continuar mesmo assim" (`#route-continuar`).
- `#route-cargo` (operacional, 10+): "O Café é pensado para quem decide.
  Se o dono ou sócio for participar, cadastre em nome dele."
- `#form-success`: "Recebemos seu interesse. Nossa equipe entra em contato com
  as próximas informações do encontro." + link secundário "Falar no WhatsApp"
  (`#wa-link`), sem redirecionamento.
- `#form-error`: "Não conseguimos enviar. Tente de novo ou fale direto no
  WhatsApp" (`#err-wa`).

### Envio

`window.submitForm` → `SP_handleSubmit` (`tracking.js`): preenche os ocultos,
gera `event_id`, posta em `/api/leads`, dispara `fbq('track','Lead', …,
{eventID})` com o mesmo id que o servidor manda para a CAPI. Falha de rede
guarda o lead no `localStorage` e reenvia no próximo carregamento.

## Backend — quatro toques cirúrgicos

### `api/leads.js`

```js
const CAFE_COM_SEVILHA = {
  rotulo:      'Café com Sevilha',
  marca:       '[CAFÉ]',
  conversao:   'cafe-com-sevilha-site',
  tags:        ['cafe-com-sevilha', 'evento'],
  stageEnv:    'RD_CRM_STAGE_ID_CAFE',
  campaignEnv: 'RD_CRM_CAMPAIGN_ID_CAFE',
};
const OFERTAS = {
  '/mentoria':   SESSAO_ESTRATEGICA,
  '/mentoria-2': SESSAO_ESTRATEGICA,
  '/cafe-com-sevilha': CAFE_COM_SEVILHA,
};
```

O identificador de conversão é **novo** (`-site`): a LP do RD usa
`cafe-com-sevilha`, e reaproveitá-lo faria a automação que o RD tem hoje (CRM,
CAPI, planilha do Café — ver `lib/rd-webhook.js`) rodar em cima do que
`/api/leads` já faz. `LeadQualificado` (10+) dispara pelo caminho normal.

**Sem `RD_CRM_STAGE_ID_CAFE` / `RD_CRM_CAMPAIGN_ID_CAFE`, o deal cai na etapa
padrão do Clube da Performance** com nome `[CAFÉ] Nome` — distinguível, mas no
funil errado. Os ids são pendência do cliente (mesmo fluxo da aula: pipeline
criado na interface, ids lidos pela API).

### `lib/leads-unificados.js`

`GRUPO_POR_PAGINA['/cafe-com-sevilha'] = 'CAFE'`. O painel já tem o grupo
`CAFE` (gasto por campanha `[CAFÉ …]` no Meta, leads por fonte); só faltava a
página mapear.

### `assets/tracking.js`

`PAGEVIEW_BEACON_PAGES` ganha `'/cafe-com-sevilha'`. É lista hardcoded no
cliente, servida como `immutable` por um ano — então o `?v=` do `tracking.js`
sobe de 6 para 7 nas páginas do beacon (`mentoria`, `mentoria-2`,
`aula-gestao-operacional`) e na nova, e o do `form-steps.js` sobe de 2 para 3
nas mesmas. `index.html` e `pre-inscricao-*` ficam em `?v=4`, como a aula os
deixou: não estão no beacon, a lista não muda nada para eles.

### Ambiente

`.env.example` documenta; na Vercel (produção) precisam mudar:

```
PAGEVIEW_BEACON_PAGES=/mentoria,/mentoria-2,/aula-gestao-operacional,/cafe-com-sevilha
LEADS_SHEET_WRITE_PAGES=/mentoria,/mentoria-2,/aula-gestao-operacional,/cafe-com-sevilha
RD_CRM_STAGE_ID_CAFE=        # etapa de entrada do funil do Café
RD_CRM_CAMPAIGN_ID_CAFE=     # campanha do CRM do Café
```

Nenhuma função serverless nova: continua em 11 das 12 do Hobby.

## Assets

- `assets/cafe-socios.webp` — a `Imagem_socios_1.png` da LP do RD (1448×1086,
  fundo transparente, blob teal incluso), convertida para WebP com alpha.
  `<img width="1448" height="1086" loading="eager" fetchpriority="high">`
  porque é o LCP.
- `assets/og-cafe.png` — 1200×630, foto dos sócios sobre navy com o título,
  composta com ffmpeg. `og:title` "Café com Sevilha — 6 de outubro, São Paulo".
- Logo: `/assets/logo-sevilha-performance.png` já existe.

## Verificação

Automática:

- `node scripts/test-form-passos.js` com `cafe-com-sevilha/index.html` em
  `PAGINAS` — ids do modal, `value` dos rádios contra `lib/porte.js`, e o
  ramo `data-destino` (sem chips, abre por `.btn.open-modal`); caso novo
  confere que `form-steps.js` trata `'inline'` sem redirecionar.
- `node scripts/test-leads-unificados.js` ganha o caso: lead com
  `pagina '/cafe-com-sevilha'` e campanha sem etiqueta → grupo `CAFE`.
- `node scripts/test-leads-capi.js` (ou caso novo ao lado) cobre
  `ofertaDe('/cafe-com-sevilha')` → marca `[CAFÉ]`, conversão
  `cafe-com-sevilha-site`, `stageEnv` `RD_CRM_STAGE_ID_CAFE`.
- `npm run lint` e `npm run lint:biome` sem erro e sem aviso novo além da linha
  de base do CLAUDE.md.

No navegador (agent-browser, sessão nomeada), 1440×900 e 390×844:

- screenshot lido de verdade: nada cortado, sobreposto ou preso em loading;
- `a11y` (axe) sem violação; `console` sem erro; `vitals`; sem overflow
  horizontal;
- modal aberto por um botão do meio da página, roteamento sub-10 aberto,
  passo 2 com o botão de enviar visível no celular;
- `detect.mjs` do impeccable uma vez, ao final.

Ponta a ponta, no preview da Vercel: um envio real → linha no Supabase com
`pagina='/cafe-com-sevilha'`, `Lead` no Events Manager com o `event_id`
dedupado (navegador + servidor), deal `[CAFÉ] …` no CRM, linha na planilha.
Depois `node scripts/purge-test-leads.js`.

## Fora do escopo

- Trocar a URL nos anúncios do Meta e desligar a LP do RD — depois da
  validação em produção.
- Ids do funil do Café no CRM (pendência do cliente).
- Chips de porte no hero ("A pergunta é a primeira interação"): a original abre
  com botão, e a réplica respeita isso. Se a taxa de abertura do modal repetir
  o gargalo medido na Sessão, é a próxima iteração — o `form-steps.js` já
  suporta `.porte-chip`.
