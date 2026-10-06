# Sessão Estratégica — Meta e Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execução em escopos disjuntos, revisão pelo coordenador; subagentes não commitam.

**Goal:** Alcançar 80–90 MQL/mês e 30 sessões/mês (~19–21 MQL e ~7 sessões/semana), com agendamentos e realizadas contabilizados separadamente. Substituir a captação Meta por formulário de maior intenção e cinco conceitos históricos comprovados, e preparar Google Search dentro do total de R$14.000/mês.

**Architecture:** Reutilizar ativos e integrações existentes. Criar substituições pausadas, conferir objetos por ID e somente trocar a entrega quando destino, medição e ingestão estiverem comprovados.

**Tech Stack:** Meta Graph v23, Google Ads REST v24, Python stdlib, páginas HTML existentes.

**Spec:** Pedido de 05/10/2026: landing page Meta pausada; orçamento total R$14.000/mês; novo formulário nativo; somente 4–5 melhores anúncios históricos; adicionar Search.

## Global Constraints

- R$14.000 é o total combinado, não uma verba adicional para Search.
- Sessão gratuita, individual, online, 45 minutos com Bruno Silvestre; preservar critério operacional 10+ colaboradores.
- Não excluir históricos, renomear anúncios antigos, imprimir segredos ou dados pessoais.
- Publicação autorizada pelo pedido; não ativar captação sem confirmar recebimento e medição.
- Meta: `utm_source={{placement}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`.
- Search: duas intenções, exact/phrase, RSA com 15 títulos e 4 descrições, sem pins; quatro sitelinks distintos e callouts.
- Google: criar conta própria Sevilha Performance no gerenciador Lorenzo, conforme autorização adicional do usuário; não usar Sevilha Contabilidade.
- Meta: verificar perfil profissional do Bruno e autorização de identidade/partnership ads; nunca se passar por ele ou publicar sem a conexão exigida.

## Review Focus

- Ranking: gasto lifetime e MQLs cobrem janelas distintas; custo/MQL requer gasto no mesmo intervalo.
- Formulário: ordem e chaves dos campos precisam preservar o export de 23 colunas.
- Ingestão: assinatura page leadgen não prova ausência de filtro por form_id no receptor.
- Destino Search: submit existente não pode ser tratado como agendamento ou MQL.
- Orçamento: CBO e ABO sem dupla contagem; daily budget não é teto mensal rígido.

### Task 1: Seleção histórica — ranking_historico

**Files:** docs/sessao-estrategica-ranking-historico-2026-10-05.{md,json}

- [x] Agregar todas as páginas de insights maximum dos anúncios SE.
- [x] Deduplicar contatos e cruzar MQL por ad_id real, mantendo intervalo e regra explícitos.
- [x] Escolher cinco conceitos com evidência suficiente; salvar somente métricas, IDs e criativos necessários.
- [x] Conferir ativos distintos e compatibilidade com troca de formulário.

### Task 2: Formulário e ingestão — funil

**Files:** docs/sessao-estrategica-form-meta-preflight-2026-10-05.{md,json}; docs/sessao-estrategica-meta-execucao-2026-10-05.json

**Escopo adicional autorizado:** O usuário pediu explicitamente: "As campanhas do Meta vamos testar usar o perfil do Bruno para anunciar também". As identidades disponíveis são Page Sevilha 131476997004991/IG17841401496577850 e Page Bruno Silvestre Consultor 106292094924513/IG17841446823336862. Como um formulário nativo pertence à sua Page, o teste de ambas as identidades inclui criar um formulário equivalente na Page Bruno. Ambos sem distribuição orgânica e somente vinculados a anúncios pausados nesta etapa. Não assinar webhooks, enviar leads de teste, publicar posts orgânicos ou ativar captação sem validar o receptor.

- [ ] Preservar perguntas qualificadoras, escritório e campos de contato na ordem atual; adicionar revisão de maior intenção.
- [ ] Conferir privacidade e CTA existentes, e documentar limitações comprovadas.
- [ ] Criar formulário sem distribuição orgânica e sem anúncios ativos, reler perguntas e is_optimized_for_quality.
- [ ] Criar formulário equivalente para a Page Bruno, respeitando seis campos e ordem do export; conferir que a criação não habilita captura orgânica.
- [ ] Preparar os mesmos cinco conceitos nas identidades Sevilha e Bruno (dez instâncias de anúncio, cinco ativos), em conjuntos comparáveis PAUSED; trocar somente identidade e form_id necessário à Page, conferir pausados por ID.
- [ ] Validar ingestão antes de ativar e antes de pausar as campanhas atuais. Se o receptor não estiver acessível, manter substituições pausadas.

### Task 3: Search — google_preflight

**Files:** docs/sessao-estrategica-google-preflight-2026-10-05.{md,json}; docs/sessao-estrategica-google-plano-2026-10-05.json

- [ ] Criar nova conta BRL/America_Sao_Paulo no gerenciador Lorenzo e reler ID, nome e estado; verificar faturamento e conversões.
- [ ] Preparar campanha Search, dois grupos e todos os assets; verificar limites de caracteres e URLs.
- [ ] Proposta inicial: R$320/dia Meta aquisição + R$40/dia conteúdo Instagram Bruno + R$70/dia Google genérico + R$20/dia marca; R$450/dia combinados. Em mês de 31 dias, Meta 360×31 + Google 90×30,4 = R$13.896 nominais; diário não garante hard cap. Recalcular pacing pelo saldo real de R$14.000. Estado atual confirmado: captação Meta R$450 + conteúdo Bruno R$0 + Google R$0. Transição proposta, ainda não aplicada: captação R$410 + conteúdo R$40, Google pausado R$0; sem somar R$90 enquanto inativo.
- [ ] Validar por API sem mutação quando conta estiver comprovada; criar pausada depois da validação.
- [ ] Ativar somente com medição da Sessão Estratégica comprovada e conferir status/qualidade retornados.

### Task 3b: Medição Google — ranking_historico (segunda onda)

**Files:** assets/tracking.js; mentoria/index.html; scripts/test-google-tracking.js; docs/sessao-estrategica-google-tracking-validacao-2026-10-05.md.

- [ ] Carregar tag AW-18496635417 após primeiro paint somente nas duas rotas SE, respeitando tráfego interno.
- [ ] Disparar SE Lead `AW-18496635417/3aj1CJus0pIdEJmE8fNE` apenas após resposta bem-sucedida de persistência; SE MQL `AW-18496635417/Yza4CJ6s0pIdEJmE8fNE` somente para porte10+.
- [ ] Reutilizar event_id como transaction_id, sem nome/e-mail/telefone no evento Google; nenhuma conversão no fallback de falha.
- [ ] Criar quatro destinos reais via IDs nas seções atuais, sem refazer a landing page.
- [ ] Testar sucesso, falha, porte, rota e tráfego interno com VM Node sem rede; conferir desktop/mobile com agent-browser sem submissão real.
- [ ] Coordenador publica somente diff desta tarefa em checkout isolado da base de produção comprovada `fc2529edc3058b0dc21b5630cd8626091328f414` e confere URL pública; não incluir alterações preexistentes.

### Task 4: Revisão e entrega — coordenador

- [ ] Revisão independente dos cinco ativos, formulário, orçamento e Search.
- [ ] Conferir remote readback das mutações e relatório de pendências reais.
- [ ] Executar checks locais pertinentes; frontend só requer browser se houver edição visual/deploy.
- [ ] Commit somente dos arquivos da tarefa, preservando alterações anteriores.

## Aprovação e execução

Plano autoaprovado conforme instrução do usuário. A autorização cobre campanhas da Sessão Estratégica; não permite escolher uma conta de outro produto sem prova nem disparar mensagens de teste pelo CRM. A mudança na entrega continua condicionada à validação das integrações.

## Metas, nomes e rastreio — revisão complementar 05/10/2026

- Objetivo comercial: 30 sessões/mês, equivalente a 6,9/semana; usuário não definiu se agendadas ou realizadas. Medir ambas separadamente, sem tratar lead ou MQL como sessão.
- Meta de MQL: 80–90/mês, equivalente a 18,5–20,8/semana (~19–21), usando 52/12 semanas por mês.
- Com R$14.000 totais: custo total/MQL de R$155,56–175,00 e custo total/sessão de R$466,67. Razão 30÷80–90 = 33,3–37,5% somente se as mesmas coortes e definição de sessão forem usadas; não é comparecimento comprovado.
- Comparecimento = realizadas÷agendadas; conversão de agendamento = agendadas÷MQL. Se agenda não estiver disponível no painel, informar indisponível, sem preencher com zero.
- Estados separados conforme Task 3: atual 450/0/0, transição planejada 410/40/0 e futuro planejado 320/40/70/20; conteúdo Bruno pertence ao total SE, sem dupla contagem CBO/ABO nem expansão para Aula/Clube/Café. Não ativar Google enquanto pausado nem empilhar orçamento da nova captação sobre o legado.
- Ranking permanece AD21, AD16, IA, AD29 e Vicente, escolhidos por MQL real em intervalo de gasto compatível; dez instâncias de identidade não significam dez conceitos.
- Auditar `creative.url_tags` dos ativos SE e dos dez pausados, distinguindo campo com macros (correto) de macro literal em registro downstream (falha de substituição). Formulário nativo depende dos IDs de ad/adset/campaign no export, não de url_tags sozinho.
- Somente recomendar mapeamento semântico de captura e HOT; não renomear live: nomes alimentam UTMs e junções históricas. Escopo HOT/Bruno continua com o agente de funil.
- Evidência e cobertura em [metas e tracking](../../sessao-estrategica-metas-e-tracking-2026-10-05.md). Consultas desta revisão somente GET; não altera follow-up, automações ou scheduler.

Plano autoaprovado conforme instrução do usuário; decisões rotineiras acima não exigem nova rodada de confirmação.

### Task 5: Teste futuro Respondi — planejado

- [x] Confirmar URL histórica exata: `https://form.respondi.app/gvz4UKQr`, presente nos CTAs originais.
- [x] Planejar os cinco conceitos AD21, AD16, IA, AD29 e Vicente para a rota antiga, mantendo LPs pausadas.
- [ ] Conferir estado do formulário externo, UTM substituída, persistência, MQL10+, event_id Pixel/CAPI e dedupe CRM nessa rota; não assumir que tracking de mentoria se aplica ao Respondi.
- [ ] Definir parcela dentro dos R$320/dia futuros de aquisição Meta após saldo e ingestão comprovados; nenhuma verba adicional ou ativação agora.
- [ ] Comparar custo/MQL único, agendamento e comparecimento em janelas compatíveis, com volume/amostra explícitos e sem alegar poder estatístico conhecido.

O pedido para planejar até um teste não exige ativação imediata. O consolidado distingue feito, planejado e pendente, sem criar automação ou alterar follow-up.

### Recuperação comercial existente

Medir MQL → contatado → agendado → realizado com dedupe, tempo de resposta e motivo de perda se o CRM fornecer esses dados. Sem novas automações, envios ou mudanças de follow-up. Reservar capacidade de agenda de 22,5h/mês para 30 sessões de 45 minutos, sem preparo. Para 30 realizadas, dividir 30 pelo comparecimento observado para estimar agendamentos necessários; a taxa não foi comprovada, portanto não inventar previsão.

### Pacing e estado efetivamente aplicado

A etapa Bruno registrou zero mutações de orçamento/distribuição: estado atual é captação R$450/dia, conteúdo Bruno R$0 e Google R$0 (pausado). Transição 410+40 e futuro 320+40+70+20 continuam propostas. Fonte MTD mais recente: preflight Bruno, captação [SE] de 01–05/out R$2.112,22; arquivo gravado 06/out 01:31:31 UTC (05/out 22:31:31 BRT), não timestamp exato da API. Esse snapshot substitui R$1.961,61 para pacing; saldo de captação R$11.887,78, sujeito a gasto posterior e decisão de escopo dos R$438,18 de distribuição antiga.


## Adendo — campanhas novas, entrega e dashboard

Pedido adicional do usuário: todas as frentes novas partem de campanhas novas; conferir entrega no CRM do cliente, planilhas e painel; comparar os formatos de campanha SE. Este pedido substitui a proposta de inserir públicos Bruno em conjuntos HOT legados. Não reativar LPs antigas.

### Task 5: Contrato de dados e entrega — funil

**Base:** clone de produção `codex/se-captacao-google-20261005`, commit c8aa709; ownership API/lib e verificadores específicos.

- Reutilizar fontes FORMS, Respondi e Supabase; preservar IDs como texto e informações de atribuição.
- Comparar Meta nativo, Respondi, Google Search e destinos sem rastreio, distinguindo fonte indisponível de dado vazio. Não dividir gasto Meta por leads Google.
- Conferir deduplicação da oferta SE e janela selecionada antes dos agregados.
- Traçar e verificar o recebimento pelas integrações existentes; HTTP200, inscrição leadgen ou evento de plataforma não provam chegada ao CRM/planilha. Registrar lacunas e impedir lançamento das substituições enquanto persistirem.
- Testar parsers/agregação/qualificação com dados sintéticos, sem lead real ou mensagem ao cliente.

### Task 6: Comparação de formatos — ranking_historico

**Ownership:** dashboard.html, módulos existentes assets/js/dash e CSS estritamente necessário no clone de produção.

- Reutilizar a aba Formatos; comparar investimento, leads únicos, MQL10+, taxa MQL e custos por formato no mesmo período.
- Exibir agendados/realizados somente com fonte comprovada; não converter MQL em reunião.
- Explicitar cobertura e limitações. Campanha pausada recém-criada não tem histórico de performance a disputar.
- Conferir navegador local desktop/mobile com dados sintéticos; sem contatos reais, sem submits.

### Task 7: Revisão e publicação — google_preflight / coordenador

- Revisão independente do diff/contrato com foco em atribuição, fontes, custos, deduplicação e preservação Aula/Café.
- Lint, typecheck aplicável, testes e build aplicável; commit pelo coordenador.
- A publicação da medição Google recebeu duas rejeições de revisão automática (manifesto amplo e depois runtime reduzido). Não repetir publicação sem nova aprovação específica. A validação local não equivale a entrega publicada.

Aceite final: relatório distingue planejado, aplicado, validado localmente, publicado e pendências de entrega. A garantia de chegada às três saídas exige prova por registro reconciliado, não apenas configuração.


## Encerramento da execução — autorização final e bloqueios

Usuário autorizou publicar e ativar tudo na noite de 05/10. Código final preservado na branch codex/se-captacao-google-20261005: c8aa709,23616f5,4240f29,60dc9d3. Quinze testes offline passaram; lint do código alterado sem erros; navegador local desktop/mobile validado com dados sintéticos. Fonte própria Google reutiliza api/meta.js com modo=google e rewrite, preservando 12 funções. Coluna integracoes aplicada/readback JSONB confirmado.

Publicação continua bloqueada: nova revisão automática rejeitou upload api/meta.js por exigir autorização específica de backend/APIs internas/dashboard. Configuração das quatro credenciais Google em produção/preview também rejeitada por falta de consentimento específico de transferência. Nenhum deployment criado, nenhuma credencial transferida, nenhum anúncio novo ativado. Conta Google sem billing; formulário Meta novo sem recebimento comprovado em Sheets/CRM. Consolidado autoritativo: docs/sessao-estrategica-consolidado-2026-10-05.md.
