# Trocar a fonte dos leads LP para a planilha do Respondi

Data: 2026-08-06 · Status: aprovado pelo usuário (conversa do dashboard, 06/08)

## Problema

O dashboard conta os leads de LP (campanhas `[SE] [LEAD]`, formulário Respondi da
landing page) a partir da planilha **[CENTRAL DE EVENTOS] Sevilha Perfomance**
(`1cedv5kfJhdwcySI1KcqQM4jS_LjIPnUhdYv1aU-SMxg`). A análise das duas planilhas
completas mostrou que essa fonte é a menos confiável das duas:

- A aba "Leads Respondi" (gid `1200600305`, hoje renomeada para "base"), que a
  configuração documentada manda ler, **parou de receber leads em 15/09/2025**.
- A aba viva ("Eventos Geral") é alimentada por uma automação intermediária que
  **ficou 13 dias sem gravar nada** (24/dez/2025 → 06/jan/2026) e teve buracos de
  4–5 dias em fev, mai e jun/2026 — ~130 leads perdidos vs. a fonte primária.
- "Eventos Geral" não tem e-mail, telefone (0%) nem cargo (0%), o que anula a
  deduplicação por contato e deixa o painel "Perfil — cargo" sem dados de LP.

A planilha **Respondi | Formulário SEVILHA PERFORMANCE - CONSULTORIA**
(`1_Y8o6WDFUSpThp8R519QC7t6A0nfh8fFER0oxacZVH0`, dono bruno@sevilhaperformance.com.br)
é preenchida pela integração nativa do Respondi, não teve nenhum buraco além dos
dias reais sem lead, e traz e-mail (92%), telefone (89%) e cargo (85%). Está
compartilhada como "qualquer pessoa com o link pode ver", e o cabeçalho já é
compatível com o parser `extractLP` existente.

## Decisões (validadas com o usuário)

1. **LP passa a ser lido da planilha do Respondi**; FORMS continua vindo da
   Central de Eventos como hoje.
2. **Só conta lead com e-mail OU telefone.** O Respondi grava toda submissão,
   inclusive abandonos (124 linhas sem nenhum contato, ~8%); essas linhas não
   entram na contagem.
3. A extração LP **deixa de ler as abas da Central** — evita contagem dupla com
   a aba morta "base" (abr–set/2025) e com o log "Eventos Geral".

## Arquitetura

- `lib/sheets.js`
  - Novo `readLPTabs()`: baixa o CSV da planilha do Respondi (primeira aba, via
    `/export?format=csv`). ID fixo no código com override por
    `LEADS_SHEET_LP_ID` (aceita id ou URL; gid opcional `LEADS_SHEET_LP_GID`).
    Sempre via CSV público — independe da Service Account, que continua valendo
    só para a Central.
  - O fetch+validação de acesso de `readViaCsv` vira um helper compartilhado.
  - `csvUrlsFromEnv`/filtro de gid da Service Account passam a usar só
    `LEADS_SHEET_GID_FORMS`; `LEADS_SHEET_GID_LP` fica obsoleto (documentado).
- `api/sheet-leads.js` (`montarLeads`)
  - Lê as duas fontes em paralelo; `extractForms` roda só nas abas da Central,
    `findLPHeaders`+`extractLP` só nas abas do Respondi.
  - `extractLP` descarta linha sem e-mail e sem telefone; a chave de dedup vira
    `email || telefone` (re-submissões do mesmo contato colapsam em 1 lead).
  - Formato de resposta inalterado (`por_formato`, `porte`, `cobertura`, …) —
    `lib/resumo.js` e o dashboard continuam funcionando sem mudança.
- Falha na leitura de qualquer uma das fontes continua derrubando o endpoint
  (502 com URLs tentadas) — LP=0 silencioso é o pior desfecho, como já
  documentado no código.

## Consequências aceitas

- Histórico LP começa em 28/04/2025 (criação da planilha do Respondi); mar–abr/2025
  (~130 leads) e o funil RH (53 leads) só existem na Central e saem da contagem.
- A qualificação manual "Com/Sem Perfil" (aba "base") já estava morta e nunca foi
  lida pelo código; nada a preservar.
- Risco de dono: a planilha é do cliente (bruno@). Se o compartilhamento por link
  for revogado, o dashboard acusa erro 502 apontando a URL — recomendado pedir
  cópia própria ou alinhamento de que o link não muda.

## Teste

`scripts/test-sheet-leads.js` (Node puro, sem framework, padrão dos scripts do
repo): injeta abas falsas em `lib/sheets` antes de carregar `api/sheet-leads` e
verifica com fixtures sintéticas: filtro de lead sem contato, dedup por e-mail e
por telefone, parse de data/campanha/cargo do formato Respondi, FORMS intacto e
separação de fontes (aba "base" na Central não gera LP). Se
`scratchpad/respondi-novo-completo.csv` existir, roda também uma validação com a
planilha real (total esperado ≈ 1.492 linhas com contato antes do dedup).
