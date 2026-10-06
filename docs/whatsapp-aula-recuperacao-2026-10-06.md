# Recuperação WhatsApp da Aula — 06/10/2026

Autorização: usuário solicitou envio aos contatos que preencheram o formulário da aula e não compraram. Instância Evolution teste; envio privado único nesta turma. Fonte sevilha_leads, pagina /aula-gestao-operacional, turma desde 15/09/2026. Não inclui a base inteira do RD.

Preflight: 111 formulários, 89 registros excluídos por compra, 5 telefones inválidos e 1 duplicata entre não compradores; 16 destinos únicos. Compras no snapshot: 83 pedidos pagos reais, 82 emails únicos. Compras posteriores são reavaliadas antes da reserva e imediatamente antes de cada envio. Telefones e emails permanecem exclusivamente no banco/arquivos privados.

Checkout cGv131E aberto e conferido no navegador, Aula Gestão Operacional, R$27; nenhum pagamento realizado. Mensagem informa aula hoje às 19h30, método e cinco planilhas, inscrições reabertas até 19h15, link direto com quatro UTMs e sck original do formulário quando disponível, e opção SAIR.

Workflow separado oSTFp3kW7dTP1Sy4, 14 nodes, ativado após revisão e posteriormente pausado por desconexão da instância. Lotes até10 por minuto, intervalo2s, somente06/10 entre18h e19h15 Brasília. Fila prefixo sevilha:recuperacao-aula:2026-10-06:, 16 registros, expiração19h15. RPC compradores e demais fluxos preservados.

Compradores excluídos por email, telefone equivalente com/sem nono dígito ou lead_id. Optout global inclui telefone e sufixo8. Consulta histórico antes de envio bloqueia SAIR e recusas equivalentes, histórico indisponível e campanha já enviada. RPC de elegibilidade é repetida antes do envio; resposta ambígua bloqueia. Reserva atômica SKIP LOCKED, keys deduplicadas, ausência de retries automáticos de reserved/uncertain. Aceite PENDING não comprova entrega.

Consentimento observado: formulário rotula telefone como WhatsApp e informa contato relacionado ao acesso à aula; não há campo específico de consentimento comercial WhatsApp persistido. Não foi criada evidência ou alterada base legal.

Validação: script check-whatsapp-recuperacao.cjs e ESLint passaram; n8n zero erros/avisos; SQL parseado. Fixture SQL transacional com rollback conferiu elegibilidade, claim limitado, ausência de nova reserva e acesso anon negado. Revisão independente sem bloqueadores. Recibos reais devem ser conferidos após execução, sem repetir por incerteza.

Estado verificado às 18h16: 15 tentativas retornaram HTTP 500 Connection Closed, registradas como uncertain; 1 registro bloqueado paused_provider_error; zero aceites. Workflow desativado. Auditoria de histórico dos 16 destinos respondeu HTTP 200 e não encontrou saída desta campanha. Instância teste em estado close. Reconexão preparada via QR; qualquer retomada exige conexão open e reconciliação antes de liberar registros. Os lembretes individuais de compradores das 19h15 também dependem da reconexão.
