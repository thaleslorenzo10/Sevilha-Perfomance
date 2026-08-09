# Sevilha Performance — contexto do projeto

## A regra que mais dói quando é esquecida

**Nunca cite número a partir de uma cópia baixada antes.** As planilhas recebem
lead o dia inteiro. Se a pergunta é "quantos leads temos", baixe de novo, na
hora — mesmo que você tenha baixado há duas horas. Já aconteceu de responder
"1 lead qualificado em agosto" com um CSV de dois dias antes, quando eram 4.

Isso vale só para análise manual. O código de produção sempre lê ao vivo:
`readAllTabs()` e `readLPTabs()` buscam o CSV a cada chamada, sem cache.

Se guardar um snapshot no scratchpad, **ponha a data no nome do arquivo**.

## De onde vêm os leads

Dois funis, duas planilhas, e eles não se misturam:

| funil | fonte | como é lido |
|---|---|---|
| **LP** (campanhas `[SE] [LEAD]`) | planilha "Respondi \| Formulário SEVILHA PERFORMANCE - CONSULTORIA" (`1_Y8o6...`), preenchida pela integração nativa do Respondi | `readLPTabs()` |
| **FORMS** (`[SE] [FORMS]`) | aba de export do formulário instantâneo do Meta na `[CENTRAL DE EVENTOS]` (`1cedv5k...`) | `readAllTabs()` |

A Central também tem cópias antigas de LP — a aba `base` (morta desde 15/09/2025)
e o log `Eventos Geral`, alimentado por um workflow n8n que perdeu ~130 leads em
panes de sincronização. **Nenhuma das duas deve virar lead de LP**: por isso cada
extrator está amarrado à sua fonte. Ver
`docs/superpowers/specs/2026-08-06-lp-planilha-respondi-design.md`.

Regra de contagem, igual nos dois lugares: linha sem e-mail e sem telefone não é
lead (o Respondi grava até abandono de formulário), e lead de teste do Meta não
conta. **Toda submissão conta, inclusive de quem já se inscreveu antes** — a
chave de deduplicação é o id de submissão, não o contato. O que o id colapsa é a
linha idêntica repetida na planilha, que a integração às vezes grava mais de uma
vez: isso é a mesma submissão, não dois leads.

## A definição de lead qualificado mora num lugar só

`lib/porte.js` — 10 ou mais colaboradores. Alimenta o dashboard **e** o evento
enviado ao Meta, de propósito: se divergirem, o painel e o gerenciador passam a
contar coisas diferentes. Faixa que cruza o corte ("6 a 10") vira `INDEFINIDO`
em vez de ser chutada.

## O evento LeadQualificado

`api/eventos-qualificados.js` varre as duas planilhas e manda ao Meta quem tem
10+ colaboradores. Pontos que não são óbvios:

- **O CAPI recusa evento com mais de 7 dias.** Histórico não é recuperável.
- **Trava de reenvio** em `sevilha_eventos_enviados` (Supabase). A janela de
  deduplicação do Meta é de 48h, curta demais para uma varredura diária.
- **Só grava na trava o que o Meta confirmou.** Já houve um bug em que o envio
  falhava calado e o lead era travado para sempre — a resposta tem `falhas` e
  `primeira_falha` justamente para isso ficar visível.
- **Agendamento**: workflow n8n `[SEVILHA PERFOMANCE] LeadQualificado — varredura
  a cada 4h` (`krmwjSWzovIOjsc2`). O cron do `vercel.json` é reserva diária,
  porque o plano Hobby do Vercel **só permite cron diário**.
- `api/respondi.js` faz o mesmo em tempo real, mas está de reserva: o Respondi
  aceita um webhook por formulário e o existente é do workflow n8n que alimenta
  Sheets e Pipedrive. Os dois caminhos derivam o `event_id` do mesmo hash de
  contato, então rodar ambos não duplica conversão.

## Testes

Node puro, sem framework, todos offline (o `fetch` é substituído):

```
node scripts/test-porte.js
node scripts/test-leads-capi.js
node scripts/test-respondi-webhook.js
node scripts/test-sheet-leads.js
node scripts/test-eventos-qualificados.js
```

Os dois últimos aceitam dados reais via `TEST_RESPONDI_CSV` e `TEST_FORMS_ROWS`.
Baixe fresco antes de usar.

## Armadilhas de operação

- **Redeploy no Vercel**: use sempre a **linha do topo** da lista. Redeployar uma
  linha antiga promove aquele build a produção — foi o que já derrubou o endpoint
  novo para um 404 por horas.
- **Supabase**: se a API REST devolver `PGRST002`, algum schema listado em
  *Exposed schemas* não existe no banco e o PostgREST não monta o cache — a API
  inteira do projeto cai. A lista pode estar fixada na role `authenticator`
  (`pgrst.db_schemas`), e nesse caso o painel não a gerencia.
- **A API do Meta não expõe criação de conversão personalizada.** Esse passo é
  manual no Events Manager.

## Bug conhecido, ainda aberto

`api/leads.js` grava no Supabase em `leads_sevilhaperfomance`, tabela que **não
existe**. A tabela com as colunas correspondentes é `sevilha_leads`. Os leads dos
formulários do site seguem indo para RD Marketing, RD CRM e Meta CAPI
normalmente; só a persistência no Supabase falha, em silêncio.
