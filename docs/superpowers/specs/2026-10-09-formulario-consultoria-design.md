# Formulario proprio de consultoria

## Objetivo aprovado

Substituir os formularios das paginas `/mentoria` e `/mentoria-2` por uma
experiencia de uma pergunta por etapa, inspirada na V4 e com marca Sevilha.
O usuario confirmou manter as seis perguntas e integrar todos os destinos
existentes nesta entrega. O plano e auto-aprovado; nao repetir gates de aprovacao.

## Experiencia

- Ordem: colaboradores, cargo, escritorio, nome, email, WhatsApp.
- Preservar faixas e valores de cargo atuais, contratos `name=` e pagina de origem.
- Nome do escritorio continua opcional como nas LPs atuais, mas tem sua etapa.
- Contatos ficam exclusivamente nas tres etapas finais.
- Progresso de seis etapas, avancar/voltar, teclado, foco acessivel, fechar e
  reabrir preservando respostas. Layout amplo no desktop e adequado ao celular.
- Manter orientacao de porte menor que 10 e participacao do decisor sem bloquear
  inscricao. Nunca mudar silenciosamente para a oferta Clube.
- Usar logo e foto reais da Sevilha; nao copiar logos, depoimentos ou assets V4.
- Somente envio final grava lead e dispara Lead; avancar etapa nao e conversao.
- Sucesso oferece o WhatsApp de agendamento existente, depois de persistencia.
- Erro de persistencia mantem respostas e permite reenvio com o mesmo event_id.

## Integracoes e dados

Reutilizar `/api/leads`, Supabase `sevilha_leads`, aba `Leads Mentoria`, RD
Marketing e RD CRM e dashboard unificado. As duas paginas ja sao classificadas
como Sessao Estrategica e devem permanecer assim. Sem nova funcao serverless.
Manter UTMs, click IDs, fbp/fbc e external_id; Pixel e CAPI usam o mesmo event_id.
Hash de contato somente no servidor, sem PII em eventos de progresso.

Validar dados da consultoria no servidor. O banco deve confirmar a gravacao antes
das integracoes. Gravar recibos em `integracoes` sem segredos ou contatos, inclusive
falha/ausencia de configuracao. Falha auxiliar nao impede a inscricao salva.
Reenvios da mesma submissao nao podem duplicar cadastro/deal/linha/conversao.
Se for necessario indice exclusivo de event_id para consultoria, preparar migracao
aditiva e verificar duplicatas antes de aplicar; preservar dados antigos.

## Verificacao e limites

Testes offline do endpoint cobrem validacao, banco indisponivel, entrega parcial,
retentativa e deduplicacao. Testes de navegador cobrem as duas paginas, desktop e
mobile, navegacao, teclado, erros, payload, UTMs, par Pixel/CAPI e baixo porte.
Rodar lint raiz e Biome, testes pertinentes, typecheck e build do subprojeto Next.
Raiz estatica nao possui build ou typecheck canonicos.

Confirmar credenciais/recursos reais por leitura antes de testes externos. Os
testes reais autorizados devem usar identidade claramente de teste, evitar
mensagens/automacoes a contatos reais e ter recibos/readback. Nao afirmar entrega
live usando mocks. Publicacao, push e alteracao de campanhas nao foram solicitados;
preparar tudo e relatar a necessidade de publicar ao concluir caso aplicavel.

## Escopo

Nao otimizar campanhas, criar editor de formularios, adicionar perguntas ou mudar
as paginas do Clube. Preservar as alteracoes anteriores do usuario no checkout.
