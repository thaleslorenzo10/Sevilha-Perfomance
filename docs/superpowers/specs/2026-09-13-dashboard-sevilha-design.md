# Dashboard Sevilha Performance — redesenho de dados e visão

Data: 2026-09-13. Estado: aprovado em conversa, aguardando revisão do texto.

## Objetivo

Um painel em `/dashboard` que responda, para qualquer período, com números que
batem entre si: quanto foi investido, quantos leads reais e quantos MQL vieram,
a que custo, de qual campanha, público, anúncio e posicionamento, e quantos
viraram deal no CRM. Serve a dois leitores: a operação diária (decidir orçamento
amanhã) e o cliente (leitura semanal).

## Problemas que motivam

Levantados lendo o código e consultando produção em 13/09/2026:

1. Lead é contado com três regras: `api/stats.js` conta linhas do Supabase sem
   dedupe; `api/sheet-leads.js` deduplica por e-mail/telefone; o Meta usa
   `onsite_conversion.lead_grouped` em campanhas `[FORMS]` e `lead` agregado
   (inflado pelo pixel) nas demais. O gráfico "leads por dia" cruza os três.
2. Quatro calendários no mesmo período: Supabase em `-03:00` fixo, eixo do
   Meta em UTC, planilha por string de data, RD no fuso da conta.
3. CPL real divide gasto de `[SE]`+`[CP]` por leads da planilha, mas os leads
   da `[PÁGINA NOVA]` vão para o Supabase, não para a planilha. CPL sai maior
   do que é.
4. A campanha `[CAFÉ COM SEVILHA]` (48 leads e R$ 519 na semana de 06 a 13/09)
   cai em "OUTROS" e seus leads, que chegam numa landing page do RD Station, não
   entram em nenhuma fonte que o painel lê.
5. `/mentoria` tem duas taxas de conversão na mesma tela, com denominadores
   diferentes.
6. Lead e MQL (10 ou mais colaboradores) aparecem misturados, com nomes
   diferentes ("qualificado", "10+", "porte maior") e sem custo por MQL.
7. Não há cruzamento por UTM: `por_anuncio` existe no endpoint da planilha, mas
   ninguém consome; Supabase guarda as cinco UTMs e nada as lê.
8. `dashboard.html` tem 805 linhas de JS inline e tokens de cor próprios ao lado
   do design system `lm-ds.css`; `/relatorio` repete helpers e menu.
9. `fetchAll` do Supabase não pagina: acima do limite do PostgREST as contagens
   caem em silêncio.

## Decisões

- **Fonte da verdade para lead:** união de planilha FORMS, Supabase (todas as
  páginas) e planilha Respondi, deduplicada, num único endpoint. Meta reporta
  seus próprios números, mostrados como "Meta reporta", nunca como lead real.
- **MQL:** lead com 10 ou mais colaboradores, pela regra já existente em
  `lib/porte.js`. Toda contagem é exibida como par Leads / MQL; todo custo como
  par CPL / CPMQL; toda linha traz % MQL. O rótulo no painel é "MQL (10+)".
- **Estrutura:** abas mantidas (Geral, Formatos, [SE], [CP]), mais [CAFÉ],
  Origem (cruzamento por UTM) e A/B (absorve `/relatorio`).
- **Café:** os leads passam a existir no Supabase via webhook de conversão do RD
  Marketing. Ler a API do RD Marketing exigiria OAuth novo; o webhook é criado na
  interface do RD e não exige credencial nova além de um segredo.
- **Fuso:** `-03:00` em todo cálculo de dia, numa função só. O eixo diário do
  Meta é montado no mesmo fuso.

## Arquitetura

### 1. `lib/fuso.js`

Substitui as duas cópias de `FUSO = '-03:00'`. Exporta `diaDe(date)`
(`YYYY-MM-DD` em `-03:00`), `inicioDoDia(dia)`, `fimDoDia(dia)` e
`cadaDia(since, until)`. Usada por leads unificados, `api/stats.js`,
`lib/sessao-estrategica.js` e `api/meta.js`.

### 2. `lib/leads-unificados.js` e `api/leads-unificados.js`

`GET /api/leads-unificados?since=YYYY-MM-DD&until=YYYY-MM-DD`

Fontes, lidas em paralelo:

| Fonte | Leitura | Campanha | Conjunto | Anúncio | Fonte/posição |
|---|---|---|---|---|---|
| FORMS (planilha Central) | `lib/sheets.js`, já existe | `campaign_name` | `adset_name` | `ad_name` | `platform` |
| Supabase `sevilha_leads` | PostgREST paginado por `Range` | `utm_campaign` | `utm_medium` | `utm_content` | `utm_source` |
| LP Respondi (planilha) | já existe | `utm_campaign` | vazio | `utm_content` | origem |
| Café (Supabase, via webhook) | mesma tabela, `pagina = rd:<identificador>` | `utm_campaign` | `utm_medium` | `utm_content` | `utm_source` |

Regras:

- Lead de teste excluído por uma regra só (hoje há duas cópias:
  `api/sheet-leads.js` e `api/eventos-qualificados.js`); a regra passa a viver
  aqui e os dois arquivos a importam.
- Dedupe por e-mail normalizado ou telefone normalizado (`lib/porte.js` já tem
  normalização de telefone; e-mail em minúsculas e sem espaços). Quando o mesmo
  contato aparece em duas fontes, vale a primeira ocorrência por data.
- Dia calculado por `lib/fuso.js`.
- Grupo classificado pelo nome da campanha com `classifyCampaign` de
  `lib/meta.js`, que ganha o grupo `CAFE` (nome contém `CAFÉ` ou `CAFE`).
- MQL por `ehQualificado(colaboradores)` de `lib/porte.js`.
- Etiqueta quebrada: valor de UTM contendo `{{` ou `__` vira dimensão
  "Etiqueta quebrada"; valor vazio vira "Sem etiqueta".

Saída (todo bloco traz `leads` e `mql`):

```
{
  periodo: { since, until, fuso: '-03:00' },
  total: { leads, mql },
  por_dia:      [{ dia, leads, mql, fontes: { FORMS, SUPABASE, RESPONDI, CAFE } }],
  por_grupo:    { SE: {leads, mql}, CAFE: {...}, CP: {...}, OUTROS: {...} },
  por_formato:  { FORMS: {leads, mql}, LP: {leads, mql} },
  por_campanha: [{ campanha, grupo, formato, leads, mql }],
  por_conjunto: [{ conjunto, campanha, leads, mql }],
  por_anuncio:  [{ anuncio, conjunto, campanha, leads, mql }],
  por_fonte:    [{ fonte, leads, mql }],
  por_pagina:   [{ pagina, leads, mql }],
  porte:        { MAIOR_10, MENOR_10, INDEFINIDO },
  qualificacao: { cargo: {...}, colaboradores: {...} },
  fontes: [{ nome, modo, total_no_periodo, ultimo_lead, dias_sem_lead, erro }]
}
```

`fontes[].erro` é preenchido quando uma fonte falha; o endpoint não falha
inteiro por causa de uma fonte, e o painel mostra a falha.

`api/sheet-leads.js` e `api/stats.js` continuam existindo para quem já os
consome (`api/resumo-png.js`, scripts), mas o dashboard para de dividir por
eles.

### 3. `lib/meta.js` e `api/meta.js`

- `classifyCampaign` ganha `CAFE`.
- Série diária montada com `lib/fuso.js`.
- `leads_onsite` e `leads_pixel` expostos por campanha (hoje só no total da
  conta), para o painel mostrar "Meta reporta" ao lado do real.
- Novo: insights no nível `adset` (`adset_name, campaign_name, spend,
  impressions, clicks`) e no nível `ad` (já existe `fetchAdInsights`).
- Novo: insights com `breakdowns=publisher_platform,platform_position` para
  gasto por posicionamento.
- `api/meta.js` passa a devolver `conjuntos[]`, `anuncios[]` e
  `posicionamentos[]`, cada um com `spend`, `impressions`, `clicks` e `leads`
  reportados. Cache mantido em `s-maxage=60`.

### 4. `api/rd-webhook.js` e `sql/rd-webhook.sql`

Webhook de conversão do RD Station Marketing, configurado na interface do RD
(Integrações → Webhooks, evento de conversão), apontando para
`POST /api/rd-webhook?secret=<RD_MARKETING_WEBHOOK_SECRET>`.

- Rejeita sem segredo válido (401).
- Para cada contato do payload grava em `sevilha_leads`: `nome`, `email`,
  `telefone`, `pagina = rd:<identificador da conversão>`, as UTMs vindas de
  `traffic_source`/`traffic_medium`/`traffic_campaign`/`traffic_content`,
  `colaboradores` e `cargo` quando o formulário do RD os trouxer, `origem =
  'rd_marketing'` e `rd_uuid`.
- `sql/rd-webhook.sql` adiciona as colunas `origem` e `rd_uuid` e um índice
  único em `(origem, rd_uuid)`; a inserção usa `Prefer:
  resolution=ignore-duplicates`, então reenvio do RD não duplica.
- Não dispara RD CRM, CAPI nem planilha: só registra. Integrações do Café
  continuam sendo feitas pelo próprio RD.
- Leads anteriores ao webhook não entram; o painel mostra "Café: leads reais
  desde <data do primeiro lead via webhook>".

### 5. Lead → deal por campanha (extra 3)

`api/rd-stats.js` já lê todos os deals do período. Passa a agrupar também por
`utm_campaign` lido de `deal_custom_fields` (campo
`68e6669152f4a7001f8d9f8f`, o mesmo que `api/leads.js` preenche), devolvendo
`por_campanha: [{ campanha, deals, ganhos, perdidos, valor }]`. Deals sem o
campo caem em "Sem campanha". A tabela de campanhas da aba Origem ganha as
colunas Deals e Lead → Deal.

### 6. Front: `dashboard.html` e `assets/js/dash/*.js`

Layout:

- **Faixa executiva** fixa acima das abas: Investido · Leads · MQL · % MQL ·
  CPL · CPMQL · Deals. Cada cartão traz o delta contra o período anterior de
  mesmo tamanho (segunda chamada aos mesmos endpoints com o período deslocado).
- **Alertas** logo abaixo, só quando existirem: fonte com erro, fonte sem lead
  há mais de 3 dias, etiqueta quebrada no período, Café sem webhook ativo.
- **Abas:** Geral, Formatos, [SE], [CAFÉ], [CP], Origem, A/B. Seleção por
  `data-tab`, não por índice. A aba ativa vai para o `hash` da URL.

Gráficos (Chart.js 4, cores de `--chart-series-*` e `--chart-grid` do
`lm-ds.css`; os tokens `--forms/--lp/--se/--cp` próprios do dashboard são
removidos):

1. Leads reais por dia, empilhado MQL sobre não-MQL, com gasto do Meta em linha
   no eixo secundário (aba Geral).
2. CPMQL por campanha, barras horizontais ordenadas, com CPL em barra mais fina
   ao lado (aba Geral e aba de cada grupo, filtrado).
3. Funil por grupo: visitas → leads → MQL → deals (aba Geral; usa
   `renderFunnel` que já existe, sem Chart.js).
4. "Meta reporta vs real" por campanha, barras pareadas (aba Origem).

Aba Origem: quatro tabelas (Campanha, Público, Anúncio, Posicionamento) com as
colunas Gasto · Leads · MQL · % MQL · CPL · CPMQL · Meta reporta; a de Campanha
tem também Deals e Lead → Deal. Junção lead × Meta por nome normalizado
(minúsculas, espaços colapsados, sem acento). Filtro por grupo. Ordenação por
clique no cabeçalho. Botão "Exportar CSV" em cada tabela (extra 4), gerado no
navegador a partir dos dados já carregados, com `;` como separador e BOM para
abrir no Excel em português.

Aba A/B: o conteúdo de `/relatorio` (variantes `/`, `/pre-inscricao-2`,
`/pre-inscricao-3` com visitas, leads, conversão) migra para cá, lendo
`/api/stats`. `relatorio.html` vira redirecionamento para `/dashboard#ab`.

Fórmulas, todas no front e todas sobre o endpoint de leads unificados:

- CPL = gasto do escopo ÷ leads do mesmo escopo; CPMQL = gasto ÷ MQL do mesmo
  escopo. "Mesmo escopo" significa mesma campanha, mesmo grupo ou mesma
  conta; nunca gasto de um grupo sobre leads de outro.
- Conversão de página = leads ÷ visitantes distintos (`lib/sessao-estrategica`
  já calcula); a tabela de páginas da aba Geral passa a usar o mesmo número.
- Quando o denominador é zero o valor é "—", nunca "0%".

Módulos em `assets/js/dash/`, cada um sob 350 linhas, carregados como scripts
simples na ordem de dependência: `formato.js` (número, moeda, percentual,
escape de HTML, normalização de nome), `api.js` (chamadas, período, período
anterior), `graficos.js` (Chart.js e funil), `executivo.js`, `geral.js`,
`formatos.js`, `grupo.js` (serve [SE], [CAFÉ] e [CP] parametrizado),
`origem.js`, `ab.js`, `csv.js`, `main.js` (filtros, abas, refresh). O
`<style>` inline do dashboard vai para `assets/css/admin-dashboard.css`, e o que
duplica `lm-ds.css` é removido.

### 7. Conferência: `scripts/conferir-dados.js`

`node scripts/conferir-dados.js --since 2026-09-01 --until 2026-09-13
[--base https://sevilha-perfomance.vercel.app]`

Baixa `/api/meta`, `/api/leads-unificados`, `/api/stats` e `/api/rd-stats` e
imprime:

- por dia: gasto, Meta onsite, Meta pixel, leads reais, MQL, e a divergência
  entre Meta e real;
- por campanha: as mesmas colunas mais deals;
- invariantes: soma de `por_dia` igual a `total`; soma de `por_grupo` igual a
  `total`; soma de campanhas do Meta igual à conta; nenhuma data fora do
  período; nenhuma fonte com erro.

Sai com código 1 se alguma invariante falhar. É a ferramenta de "conferir se
bate", antes e depois da mudança, e fica para uso.

## Testes

- `scripts/test-leads-unificados.js`: fixtures das quatro fontes; cobre dedupe
  entre fontes, lead de teste, fuso na virada do dia, classificação de grupo,
  etiqueta quebrada, MQL.
- `scripts/test-fuso.js`: `diaDe` em horários próximos da meia-noite.
- `scripts/test-rd-webhook.js`: segredo inválido, payload do RD, reenvio
  idempotente.
- `scripts/test-meta-leads.js` (existente) estendido para `CAFE` e níveis
  adset/posicionamento.
- `scripts/conferir-dados.js` rodando limpo contra produção após deploy.
- Lint: zero erro; linha de base de avisos não sobe (a extração dos módulos
  deve reduzi-la).
- Navegador (agent-browser): `/dashboard` em 390 e 1440, tema claro e escuro,
  cada aba, console sem erro, sem requisição falhando; `/relatorio`
  redirecionando.

## Fora de escopo

- Raio-x continua documento estático datado.
- OAuth do RD Marketing e importação dos leads do Café anteriores ao webhook.
- Alertas de CPMQL alto e frequência, fadiga de criativo, hora/dia da semana
  (extras 1, 2 e 5, não escolhidos).
- Mudar as páginas de captura ou o fluxo de gravação de lead (`api/leads.js`).

## Ordem sugerida de implementação

1. `lib/fuso.js` e testes.
2. `lib/leads-unificados.js` + endpoint + testes.
3. `lib/meta.js`: `CAFE`, fuso, níveis adset/ad/posicionamento.
4. `api/rd-stats.js`: `por_campanha`.
5. `api/rd-webhook.js` + SQL + testes; configurar o webhook no RD.
6. `scripts/conferir-dados.js`; rodar contra produção antes do front, para ter
   a linha de base.
7. Front: módulos, faixa executiva, abas, gráficos, Origem, A/B, CSV.
8. Validação no navegador, lint, conferência final, deploy.
