# Aula e gravação — reconciliação de 26/10/2026

## Estado de entrega

Usuário autorizou publicação e conclusão do retroativo. **Publicado e verificado em produção; 35 gravações importadas definitivamente.** A leitura foi publicada antes da inserção para não contar gravações como inscrições. As funções/índice do banco estão aplicados.

O usuário ativou todos os produtos no webhook e enviou o CSV de vendas. O teste `Example product` chegou à tabela; o código novo o exclui de indicadores e integrações, conservando a evidência. Outros produtos são persistidos, mas não entram nos indicadores nem no CRM da Aula. Nenhuma configuração de campanha, gasto, envio externo ou credencial foi alterada nesta tarefa.

## Retroativo conferido

CSV: 223 linhas; 198 pagas, 18 aguardando pagamento, 7 recusadas. Destino deste retroativo: exclusivamente gravações pagas. Excluídos Clube, oferta Teste de R$5, recusadas e pendentes.

| Edição | Gravações pagas | Receita base | Cobrado com acréscimos | Líquido Kiwify |
|---|---:|---:|---:|---:|
| 06/10/2026, edição completa | 17 | R$1.649,00 | R$1.661,19 | R$1.517,25 |
| 27/10/2026, snapshot CSV | 18 | R$1.746,00 | R$1.774,49 | R$1.606,50 |

As 35 referências são únicas, ausentes no banco no preflight e vinculadas a inscrições pagas do produto correto no banco. Vínculo conservador: e-mail e data de criação exatamente iguais, um único pedido principal no CSV; referência principal conferida no banco. Uma pessoa pode comprar mais de uma vez: a edição atual possui 18 gravações e 17 compradores únicos da gravação.

O CSV não informa aprovação exata. O retroativo usa a criação do pedido como aproximação marcada em `payload.importacao.data_pagamento`; atualização do CSV não foi usada como aprovação porque pode ocorrer dias depois. Um webhook real com aprovação válida atualiza essa precisão, preservando a proveniência e o bloqueio de reenvio histórico.

## Contratos implementados

- Classificação explícita de aula, gravação, testes e demais produtos; valores base/cobrado/líquido separados.
- Agregados de aula e gravação, estornos separados, combinado, ticket por inscrição, adesão por compradores comuns e aviso de datas aproximadas; sem PII na resposta.
- Dashboard: edição de 06/10 adicionada, mantendo 27/10 e Café; inscrições não incluem gravações. Filtro global limita a janela efetiva e fica explícito na tela.
- `sql/kiwify-order-ref.sql`: unicidade por referência curta e RPC `sevilha_registrar_compra_kiwify`, somente service_role, com bloqueio transacional. Preserva ID canônico, estornos e recibos; rejeita identidades divergentes.
- Webhook: desconhecido/teste não usa integrações da Aula; gravação usa seu nome real e não avança deal da Aula. Recibos CAPI/CRM independentes; estorno sem aprovação preserva data existente. Entrada inválida não vira venda de hoje.
- `scripts/import-kiwify-order-bump.py`: preparação offline por padrão, valida moeda/valores/vínculos e grava manifesto privado somente fora do repositório, modo600. Não chama API, CAPI ou CRM.

## Verificação executada

- Testes de agregação/classificação, webhook multiproduto, regressão do backend Aula, edições/eventos, renderização e parser CSV passaram.
- `npm run check:toolkit`: exit0, sem erros; avisos do linter mantidos, sem rebaixar regras. Não há build/typecheck canônicos na raiz estática; pacote Clube não foi alterado.
- `sql/kiwify-order-ref.test.sql`: teste transacional com rollback confirmou conciliação de ID sintético/UUID, recibos/proveniência, precisão, proteção de estorno, conflito de identidades e ausência de permissão pública.
- Dry-run real em transação: 35 inserções; repetir lote: 0 inserções; rollback e leitura posterior: 0 retroativos persistidos. Nenhum evento externo disparado.
- Gitleaks `--redact` nos módulos de produção novos/alterados: nenhum segredo encontrado.
- Agent-browser, sessão `sevilha-order-bump-20261026`: preview local com agregados do banco + CSV, desktop1440 e celular390, troca de edição, sem overflow horizontal e sem erros de console. Leads não consultados nesse preview e identificados como n/d; investimento do preview é o snapshot das16h42. Publicação e validação no destino concluídas na etapa abaixo.
- Revisão independente por subagente sobre o fluxo fornecido em texto: corrigidos estorno concorrente, retryCRM, precisão e identidade divergente. O ambiente dos subagentes não expôs ferramentas; implementação e verificações executadas pelo coordenador.

## Publicação e aplicação autorizadas

Publicar somente os arquivos desta tarefa, preservando alterações de outras tarefas. Conferir a API de eventos publicada separando produtos e excluindo o teste. Revalidar referências contra o banco, executar o lote idempotente preparado, ler de volta contagens/valores e validar dashboard no destino. Não reenviar CAPI/CRM nem importar produtos de outros clientes. Para rollback, não apagar por proveniência genericamente: distinguir linhas inseridas pelo lote de linhas posteriormente conciliadas com webhook real.

Evidência privada e manifesto/SQL do lote em `/tmp/sevilha-order-bump-20261026/`; o CSV original permanece no anexo do chat. Não versionar dados pessoais.

### Evidência de produção — 26/10, 17h34–17h37 de Brasília

- Base preservada: `dpl_CdD9UNK62H3vy3RFvkSMfYBmMiek`. Novo deploy `dpl_YUxUFZC7gpfuWAvVUjGj568Mfyw6`, READY, alias `sevilha-perfomance.vercel.app` confirmado.
- Sete arquivos de produto publicados sobre o snapshot de produção; 378 arquivos de origem no destino. Conferência por hash: sete esperados, zero alterações em arquivos alheios. Nenhuma publicação do restante do checkout.
- API `/api/stats?modo=eventos`: HTTP200 com as três edições, sem erros de fonte. Webhook sem assinatura: HTTP401, sem evento de compra fictício.
- Importação: 35 linhas gravadas, 35 referências únicas, todas gravações, todas com CAPI/CRM `nao_enviado_retroativo`. Readback 06/10:17 gravações/R$1.649 base; 27/10:18/R$1.746 base.
- API publicada após importação: atual54 inscrições/53 pessoas,18 gravações/17 pessoas, R$3.204 base, R$3.243,81 cobrado e R$2.813,40 líquido Kiwify. Anterior completa88 inscrições/87 pessoas,17 gravações, R$4.025 base. Anterior até05/10:56 inscrições,11 gravações, R$2.579 base.
- Meta consultada às17h34: edição atual R$4.310,60; anterior até05/10 R$5.229,88; anterior completa R$6.483,66. Google das duas contas Sevilha retornou ausência de gasto no período.
- Validação com agent-browser em produção, sessão `sevilha-order-bump-prod`, desktop1440 e celular390: compras/receitas exibidas, ausência de overflow nos cartões e console sem erros. Navegação para edição anterior com filtro90dias confere edição completa. Favicon404 preexistente observado; APIs e assets da alteração retornaram200.
- Os registros de gravação continuam com data de criação aproximada até eventual webhook de aprovação real. Líquido não implica liberação bancária. Não foram reenviados eventos históricos. Evidências privadas em `release/` sob o diretório já registrado.

### Conferência final — 17h42 de Brasília

A campanha anterior iniciou mídia em17/09, com R$37,03 antes de18/09. Janela da edição ajustada para17/09–06/10, para painel e comparativo incluírem o investimento integral. Deploy final `dpl_E2z3xuq1zy6PvmyGFLsTTecRBreF`, READY e alias confirmado; duas alterações sobre a publicação anterior, zero mudanças alheias. APIs e hashes conferidos novamente.

| Indicador | Anterior até05/10 | Atual até26/10 17h42 | Anterior completa06/10 |
|---|---:|---:|---:|
| Investimento Meta | R$5.229,88 | R$4.315,96 | R$6.483,66 |
| Leads / MQL | 73 /40 | 76 /41 | 104 /54 |
| Inscrições / pessoas | 56 /55 | 54 /53 | 88 /87 |
| Gravações / pessoas | 11 /11 | 18 /17 | 17 /17 |
| Receita base conjunta | R$2.579,00 | R$3.204,00 | R$4.025,00 |
| Cobrado com acréscimos | R$2.579,00 | R$3.243,81 | R$4.043,97 |
| Líquido Kiwify | R$2.233,35 | R$2.813,40 | R$3.484,05 |
| Custo por inscrição | R$93,39 | R$79,93 | R$73,68 |
| Receita por inscrição | R$46,05 | R$59,33 | R$45,74 |
| Líquido menos mídia | -R$2.996,53 | -R$1.502,56 | -R$2.999,61 |

Adesão por compradores únicos:20,0% /32,1% /19,5%. Receita/mídia:0,49x /0,74x /0,62x. Sem reembolsos nos registros consultados. Em comparação com a véspera anterior:17,5% menos investimento,24,2% mais receita de produtos e14,4% menor custo por inscrição. Atual ainda parcial. Google sem gasto retornado nas contas consultadas.

### Versão final entregue

Deploy `dpl_FGwabzoDq4fU9Xdid8xqFizGfHvx` READY, alias de produção confirmado. Cache do módulo de eventos atualizado em dashboard.html; hash do arquivo e preservação dos outros 377 arquivos de origem conferidos. API retorna os dois produtos e zero erros de fonte; webhook sem assinatura continua401. Agent-browser na sessão `sevilha-order-bump-prod-final`, filtro90dias: cabeçalho17/09, investimento anterior R$6.483,66, módulo atualizado, sem overflow ou erros de página. Sessão encerrada após conferência. O comparativo entregue usa o corte financeiro das17h42 registrado acima.
