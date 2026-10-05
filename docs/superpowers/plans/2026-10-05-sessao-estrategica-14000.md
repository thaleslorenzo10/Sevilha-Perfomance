# Sessão Estratégica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Somente o coordenador integra e commita; subagentes não commitam.

**Goal:** Pausar a aquisição por landing page da Sessão Estratégica e ajustar os orçamentos existentes ao investimento total de R$ 14.000/mês, preparando novos criativos e canais sem publicá-los.

**Architecture:** Reutilizar campanhas e formulários existentes. Ler IDs e orçamento atual pela API antes de alterar; conservar snapshot para reversão e confirmar cada mutação por leitura do mesmo objeto. Separar execução autorizada de rascunhos sujeitos à autorização de publicação.

**Tech Stack:** Meta Graph API, fontes operacionais existentes de leads, Markdown.

**Spec:** [Pacote de aquisição](../../sessao-estrategica-aquisicao-2026-10-05.md), [PRODUCT.md](../../../PRODUCT.md) e [auditoria histórica](../../auditoria-sessao-estrategica-2026-09-29.md).

## Global Constraints

- Teto TOTAL de R$ 14.000/mês, exclusivamente Sessão Estratégica; Google e LinkedIn nunca somam investimento sobre esse teto.
- Autorizado: pausar campanhas LP de Sessão Estratégica e ajustar orçamento de campanhas/conjuntos existentes da oferta. Novos anúncios/canais, mensagens e reativações seguem em rascunho.
- Oferta: diagnóstico individual gratuito de 45 minutos com Bruno Silvestre. Não confundir com Clube da Performance ou Aula de Gestão Operacional.
- Preservar MQL operacional de 10+ colaboradores. A comunicação pública de PRODUCT.md diz mais de 10; não alterar classificação, formulário ou código.
- Sem cases, resultados, depoimentos ou prazos prometidos. Reutilizar imagens/vídeos existentes; sem novas dependências, endpoints ou páginas.
- Meta: `utm_source={{placement}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`.
- Nenhum ID histórico constitui autorização ou prova do estado atual; os IDs executáveis vêm do preflight live.

## Review Focus

- Campanha com nome parecido ou de outra oferta: excluir da mutação; conferir conta, destino e relação campanha/conjunto/anúncio.
- CBO e ABO: contabilizar orçamento no nível que o controla, sem somar campanha e filhos duas vezes.
- Gasto já ocorrido e orçamento diário: recalcular saldo no momento da execução; média diária não garante teto mensal de gasto.
- API com resposta incerta, rate limit ou estado transitório: ler antes de repetir escrita; sem repetição cega.
- Rascunho confundido com publicação ou MQL com reunião: relatar status e métricas separadamente.

## Task 1 — Preflight e alocação existente

**Responsabilidade:** executor da conta Meta, com leitura live. Não exige edição de código.

**Consome:** autorização de pausa LP e teto mensal; dados live da conta da oferta. Snapshot de referência: [preflight de 05/out](../../sessao-estrategica-preflight-2026-10-05.json); reler antes da escrita.
**Produz:** snapshot sanitizado, lista exata de objetos LP e FORMS, modo CBO/ABO, orçamento anterior e proposta por objeto.

- [x] Confirmar conta Meta `1676714556216146`, moeda, fuso e IDs; ler campanhas `[SE]`, seus conjuntos/anúncios, destinos, `status`, `effective_status`, `daily_budget` e `lifetime_budget`.
- [x] Distinguir LP, FORMS, quente e frio; resolver ambiguidades por destino/formulário e hierarquia live. Não usar substring de nome como único critério.
- [x] Ler gasto real de outubro até o instante da execução e outras campanhas de Sessão Estratégica com gasto no mês, mesmo pausadas.
- [x] Computar saldo `14000 - gasto_SE_no_mês`. Se saldo não for positivo, não aumentar orçamento. Dividir saldo pelos dias restantes, incluindo o dia em curso de modo conservador; arredondar a distribuição para baixo em centavos.
- [x] Distribuir o saldo diário somente entre FORMS existentes elegíveis, preservando inicialmente a proporção quente/frio do orçamento live. Não reativar objetos pausados para preencher verba.
- [x] Revisar tabela de IDs, valores anteriores/novos e soma CBO/ABO; teste de aceite: oferta única, LP recebe zero entrega planejada, novos canais recebem zero e soma não excede o saldo planejado.

**Preflight atualizado de 05/out, 16h45min33s BRT:** gasto parcial do mês R$ 1.961,61; saldo R$ 12.038,39. Há 26 dias completos de 6–31/out; a divisão produz R$ 463,05/dia sem reservar o restante de 5/out. Adotar soma nominal de **R$ 450/dia** nos FORMS preserva proporção 100:110:130 e deixa R$ 338,39 de margem aritmética para o restante de hoje e variação. Reler gasto e configuração antes da escrita; esta margem não garante teto mensal.

| Objeto confirmado no preflight | Nível/controlador | Antes | Ação/valor confirmado |
|---|---|---:|---|
| LP quente `120252795398510526` | Campanha CBO | R$ 130/dia | Pausada às 16h46min51s; readback confirmado |
| LP fria `120252795560930526` | Campanha | Já pausada | Pausa preservada e confirmada |
| FORMS Bruno `120253330191810526` | Campanha CBO | R$ 100/dia | `daily_budget=13235` (R$ 132,35/dia) |
| FORMS fábrica `120248779747120526` | Campanha CBO | R$ 110/dia | `daily_budget=14559` (R$ 145,59/dia) |
| FORMS HOT campanha `120235128444610526`, conjunto `120243440924150526` | Conjunto ABO, único ativo | R$ 130/dia | Conjunto `daily_budget=17206` (R$ 172,06/dia) |

Somar somente 132,35 + 145,59 + 172,06 = R$ 450/dia; não adicionar o orçamento dos filhos CBO. LP atual usa `/diagnostico`; FORMS usa destino `ON_AD`, formulário `1836784071025712`. IDs foram resolvidos por leitura live, não pela tabela histórica; se qualquer campo divergir na releitura, refazer a proposta antes de escrever.

## Task 2 — Pausas e orçamento, com leitura de retorno

**Responsabilidade:** executor da conta; nenhum anúncio novo.

- [x] Salvar valores anteriores e instante do snapshot sem credenciais/dados pessoais.
- [x] Pausar somente os objetos LP confirmados no preflight. Preferir o nível de campanha quando a campanha inteira for LP da oferta; se houver destinos mistos, pausar exclusivamente os conjuntos LP identificados.
- [x] Reler cada ID escrito e seus filhos: conferir `status` e `effective_status`. `IN_PROCESS` ou aceitação da API não confirmam pausa efetiva; registrar pendência.
- [x] Ajustar orçamento FORMS no nível controlador: campanha em CBO, conjunto em ABO. Alterar um campo por objeto, com valores inteiros na unidade exigida pela API.
- [x] Reler orçamento e estado após cada alteração; reconciliar soma das campanhas/conjuntos elegíveis e projeção do saldo mensal.
- [x] Conferir que Clube, Aula e outros produtos ficaram fora da lista de alterações; confirmar que nenhum objeto previamente pausado foi ativado.

**Rollback:** se houver objeto errado, valor divergente ou soma inconsistente, interromper as próximas escritas e restaurar somente os campos modificados usando o snapshot, respeitando a intenção de manter LP pausada. Não reativar LP como efeito automático de desfazer orçamento. Se o snapshot ficar desatualizado por intervenção humana, reler e relatar o conflito antes de sobrepor. Reler todos os campos restaurados; rollback não desfaz gasto já ocorrido.

## Task 3 — Pacote de aquisição e revisão independente

**Files:** criar somente este plano e `docs/sessao-estrategica-aquisicao-2026-10-05.md`.

- [x] Preparar seis copies, em três ângulos, com título, texto e CTA; oferta explícita e assets existentes.
- [x] Preparar arquitetura mínima de Google Search e hipótese de LinkedIn, com zero ativação e verba retirada do Meta caso autorizados no futuro.
- [x] Revisar seis copies contra PRODUCT.md, teto de orçamento, ausência de promessas e critério MQL inalterado.
- [x] Coordenador integra revisão independente e entrega os arquivos com status confirmado da conta; não escrever “aplicado” sem readback.

## Task 4 — Pacing e avaliação

- [x] Ao final da execução, registrar gasto acumulado, saldo, dias restantes, soma diária configurada e status de cada mudança; indicar que orçamento diário não é limite rígido mensal.
- [ ] Revisão operacional diária manual do gasto e saldo enquanto o teto mensal estiver em vigor; este plano não cria monitor ou automação recorrente.
- [ ] Revisão após sete dias completos: gasto, leads únicos, MQL 10+, custo/MQL, quente/frio e campanha. Usar Meta como diagnóstico e fonte operacional deduplicada como denominador.
- [ ] Se reuniões/oportunidades não estiverem conciliadas com timestamps, marcar indisponíveis. Não converter três MQL de 1–4/out em conclusão definitiva sobre público/creative.
- [ ] Antes de publicar qualquer rascunho, validar acessos, tráfego, custos, UTMs, integrações e autorização específica. Publicação Google exige assets completos e readback de qualidade; pendência continua pendência.

## Estado deste plano

Tasks 1–3 concluídas em 05/10/2026. Pausa LP quente aplicada às 16h46min51s BRT e confirmada pela campanha e filhos (`PAUSED`/`CAMPAIGN_PAUSED`); LP fria já pausada, com pausa preservada. Os três orçamentos foram escritos e relidos; GET independente do coordenador confirmou FORMS ativos, LPs pausadas e os valores 13235/14559/17206 centavos. Evidência: [registro de execução](../../sessao-estrategica-execucao-2026-10-05.json).

Task 4: registro final concluído; acompanhamento diário e revisões futuras não executados. R$ 450/dia é pacing, não hard cap mensal. Nenhum criativo/canal novo publicado.

Validação informada pelo coordenador: 81 asserts locais passaram; lint geral encontrou 73 erros em worktrees, enquanto o checkout ativo teve zero erros e 781 avisos. Biome encontrou conflito entre configuração raiz e nested; build Next e typecheck não foram executados por ausência das ferramentas/dependências necessárias. Frontend não foi alterado. Não há afirmação de que todos os gates passaram.

**Resultado final às 16h48 BRT:** gasto acumulado de outubro R$ 1.962,33; saldo mensal R$ 12.037,67. Reconciliação de 22 campanhas da Sessão Estratégica e seus conjuntos confirmou soma de R$ 450/dia sem dupla contagem CBO/ABO. Projeção nominal para os 26 dias completos restantes, incluindo reserva do restante de hoje: R$ 13.932,16, com margem de R$ 67,84 até o teto. Projeção não é garantia de gasto nem hard cap; acompanhamento e revisões futuras continuam pendentes.
