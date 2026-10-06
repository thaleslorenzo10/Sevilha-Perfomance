# Email da aula no RD: execução e pendências

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

**Estado: rascunho incompleto; nenhum teste por email, envio ou agendamento executado.**

## Retomada

1. Recuperar conexão do Chrome ao RD; abrir https://app.rdstation.com.br/email/23407453/edit.
2. Importar a mensagem preparada e validar preview, CTA com quatro UTMs e descadastro nativo `*||UNSUBSCRIBE_LINK||*`.
3. Revisar remetente e reconciliar compradores confirmados com exclusão no Marketing, sem confundir CRM com segmentação Marketing.
4. Confirmar a base legal efetivamente documentada para a audiência; não inventar consentimento.
5. Conferir campanhas agendadas/drafts para evitar duplicidade, recomputar audiência final e enviar uma única vez.
6. Reler estado por ID e guardar evidência visual. Aceite/processamento não confirma entrega.

Oferta preparada: aula hoje às 19h30, R$27 até 16h, inscrições até 17h30. Após 16h revisar preço/copy; após 17h30 não enviar este convite de compra.
