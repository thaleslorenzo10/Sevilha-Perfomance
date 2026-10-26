# Aula e gravação — reconciliação de 26/10/2026

## Estado de entrega

Código implementado e validado localmente. **Publicação e inserção definitiva das 35 gravações pendentes de autorização de publicação.** A leitura publicada anterior soma qualquer produto da tabela como inscrição; inserir antes da troca de código inflaria os indicadores. As novas funções/índice do banco já foram aplicados, sem alterar registros financeiros existentes.

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
- Agent-browser, sessão `sevilha-order-bump-20261026`: preview local com agregados do banco + CSV, desktop1440 e celular390, troca de edição, sem overflow horizontal e sem erros de console. Leads não consultados nesse preview e identificados como n/d; investimento do preview é o snapshot das16h42. Publicação e validação no destino ainda não ocorreram.
- Revisão independente por subagente sobre o fluxo fornecido em texto: corrigidos estorno concorrente, retryCRM, precisão e identidade divergente. O ambiente dos subagentes não expôs ferramentas; implementação e verificações executadas pelo coordenador.

## Continuação após autorização de publicação

Publicar somente os arquivos desta tarefa, preservando alterações de outras tarefas. Conferir a API de eventos publicada separando produtos e excluindo o teste. Revalidar referências contra o banco, executar o lote idempotente preparado, ler de volta contagens/valores e validar dashboard no destino. Não reenviar CAPI/CRM nem importar produtos de outros clientes. Para rollback, não apagar por proveniência genericamente: distinguir linhas inseridas pelo lote de linhas posteriormente conciliadas com webhook real.

Evidência privada e manifesto/SQL do lote em `/tmp/sevilha-order-bump-20261026/`; o CSV original permanece no anexo do chat. Não versionar dados pessoais.
