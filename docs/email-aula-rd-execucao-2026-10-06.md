# Email da aula no RD: execução e pendências

## Resultado confirmado

Enviado uma única vez em 06/10/2026 às **12h17 de Brasília**. Email `23407453`; campanha de estatísticas `20330446`: https://app.rdstation.com.br/campanhas/20330446/estatisticas.

- RD confirmou **1.985 emails enviados** e **1.946 entregues (98,04%)** na primeira leitura após o envio. 112 aberturas (5,76%) e zero cliques nessa leitura inicial; métricas ainda em evolução, sem atribuir vendas a aberturas.
- Remetente aplicado: Sevilha Performance, `contato@sevilhaperformance.com.br`, endereço comprovado no envio anterior da conta. O domínio de email Sevilha estava verificado no RD, última validação 05/10/2026. O remetente de agência inicialmente sugerido foi substituído após alerta de falta de autenticação.
- Incluída **Base ativa**, somente engajados. Excluídas **Clientes**, **Hard Bounces**, **Soft Bounces**, **leads_without_legal_bases**. RD confirmou uma inclusão e quatro exclusões. Contagem recalculada no envio: 1.985 selecionados/enviados.
- Consentimento selecionado após o usuário confirmar que os contatos vieram de formulários com consentimento. Registros sem base legal foram excluídos da audiência.
- Mensagem HTML completa aplicada em bloco próprio; link nativo de pré-visualização preservado. CTA com quatro UTMs e descadastro resolvido pelo RD foram conferidos no preview. Texto residual do bloco padrão foi removido e relido antes do envio.
- Envio imediato, sem Envio Inteligente. Não houve outro email de Aula entre as três campanhas agendadas; agendamentos existentes de Mentoria foram preservados. Não foi repetido o botão Enviar depois do aceite.
- HTML validado: CTA único, quatro UTMs, macro de descadastro, ausência de `sp_interno`/resíduos; destino público retornou HTTP 200.
- [Comprovante visual](evidencias/email-aula-rd-2026-10-06-envio.png).

### Pendências para próximos envios

**Clientes não comprova exclusão de todos os compradores da aula.** A compra atualiza CRM, mas o código não marca comprador no RD Marketing; a cobertura dessa exclusão permanece sem comprovação. Sincronizar compras confirmadas ao Marketing e criar segmento próprio antes de novos envios. O envio realizado não deve ser reportado como tendo todos os compradores reconciliados/excluídos.

OAuth foi preparado e testado localmente; aplicativo privado e autorização real ainda pendentes. API de consulta/fluxos não equivale a endpoint de disparo avulso. Medir cliques e compras pela UTM da campanha, sem novo disparo automático.

## Histórico de preparação, anterior ao envio

Verificado em 06/10/2026, aproximadamente 11h25–11h40, horário de Brasília.

- Conta autenticada: Sevilha Performance.
- Campanha criada uma única vez: `[AULA] É HOJE | Gestão Operacional | 2026-10-06 | RD`, ID `23407453`.
- Assunto salvo: `É hoje: gestão do escritório contábil com Bruno`.
- Remetente padrão observado: Sevilha Performance, `thales@lorenzomedia.com.br`; identidade de envio ainda precisa ser revisada antes de publicar.
- Conteúdo preparado no HTML local. Importação no RD exige URL pública; conteúdo completo ainda não foi importado. O indicador verde do RD refere-se ao modelo padrão, não prova que a mensagem preparada está publicada.
- Seleção preparada na interface: Base ativa, somente engajados, excluindo Hard Bounces, Soft Bounces e leads_without_legal_bases. Base legal não selecionada; audiência final não aprovada para envio. Não usar contagens intermediárias como destinatários confirmados.
- Uma seleção inicial adicionou listas de supressão ao campo de inclusão; isso foi corrigido na interface antes de qualquer envio. Readback mostrou uma lista de inclusão e três de exclusão.
- A revisão automática rejeitou selecionar Consentimento: o RD informa que atribui a base legal escolhida a contatos sem informação após enviar. Nenhuma base legal foi atribuída.
- Código de produção: captura gera conversão `aula-gestao-operacional` e tags `aula`, `gestao-operacional` no Marketing. Compra é persistida e avança o negócio no CRM; não foi encontrada marca de comprador no Marketing. Essas tags de captura não comprovam compra.
- Controle do navegador deixou de responder com `Debugger unattached`; nenhuma tentativa alternativa de envio foi feita.

**Estado anterior, superado pelo resultado acima: rascunho incompleto; nenhum teste por email, envio ou agendamento executado nessa etapa.**

## Checklist de retomada original, executado conforme resultado acima

1. Recuperar conexão do Chrome ao RD; abrir https://app.rdstation.com.br/email/23407453/edit.
2. Importar a mensagem preparada e validar preview, CTA com quatro UTMs e descadastro nativo `*||UNSUBSCRIBE_LINK||*`.
3. Revisar remetente e reconciliar compradores confirmados com exclusão no Marketing, sem confundir CRM com segmentação Marketing.
4. Confirmar a base legal efetivamente documentada para a audiência; não inventar consentimento.
5. Conferir campanhas agendadas/drafts para evitar duplicidade, recomputar audiência final e enviar uma única vez.
6. Reler estado por ID e guardar evidência visual. Aceite/processamento não confirma entrega.

Oferta preparada: aula hoje às 19h30, R$27 até 16h, inscrições até 17h30. Após 16h revisar preço/copy; após 17h30 não enviar este convite de compra.
