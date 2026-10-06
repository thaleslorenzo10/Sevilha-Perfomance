# RD Marketing: conexão por API e futuros disparos

Conexão OAuth confirmada em 06/10/2026 às 16h49 (Brasília), após consentimento real da conta Sevilha Performance. As consultas autenticadas de segmentações, fluxos e emails retornaram HTTP 200. Na fase posterior, os lembretes foram enviados/agendados pela interface RD; estados e pendências estão em [Lembretes da aula de 06/10/2026](lembretes-aula-2026-10-06.md).

## O que a API permite

A API pública de Email permite consultar campanhas e detalhes dos disparos. Não encontrei endpoint público documentado para criar uma campanha de Email Marketing, importar seu HTML ou executar seu disparo. A seção oficial descreve consulta, e a listagem usa `GET /platform/emails`. Portanto, OAuth não deve ser apresentado como um disparador arbitrário de emails. [Email](https://developers.rdstation.com/reference/email-1), [Listar emails](https://developers.rdstation.com/reference/get_platform-emails).

O caminho documentado para acionar comunicação por API é inserir contatos em um fluxo de automação já configurado: `POST /platform/workflows/{id}/leads`, com `{"leads":["email-ou-phone"]}`. O fluxo deve existir e estar ativo; a ação pode iniciar seus emails, conforme sua configuração. Não executar como teste de conexão. Limites por lote: Light/Basic 10, Pro 25, Advanced 50 contatos. [Inserir leads](https://developers.rdstation.com/reference/post_platform-workflows-id-leads-1), [Erros de fluxo](https://developers.rdstation.com/reference/mensagens-de-erro-rdsm).

As estatísticas de emails estão em `GET /platform/analytics/emails`, para Pro/Advanced, com consolidação até D-1 em UTC. Pro limita a consulta aos últimos 45 dias. Elas servem para acompanhamento posterior, sem substituir a confirmação imediata de envio no RD. [Estatísticas](https://developers.rdstation.com/reference/get_platform-analytics-emails).

## Conexão mínima recomendada

1. Criar ou reutilizar um **aplicativo privado de RD Station Marketing**, destinado à Sevilha. Credenciais de Marketing e CRM são separadas. A chave de conversão atualmente usada pelo projeto não substitui OAuth. [Autenticação](https://developers.rdstation.com/reference/autenticação), [Conversão via API Key](https://developers.rdstation.com/reference/conversao).
2. No portal de desenvolvedores, menu superior **App Publisher** → **Quero criar um aplicativo** → nome específico → **Aplicativo privado** → **Criar app** → informações e URL de callback → **Salvar e avançar**. Para app existente: App Store → **Meus apps** → menu de três pontos → **Obter credenciais**. Reutilizar callback seguro já disponível; nunca enviar o código para um serviço de terceiro como atalho. [Criar aplicativo](https://developers.rdstation.com/reference/criar-aplicativo-appstore).
3. Autorizar a conta **Sevilha Performance** pela URL `https://api.rd.services/auth/dialog?client_id=...&redirect_uri=...&state=...`. A callback precisa coincidir exatamente com o cadastro; gerar `state` aleatório e validar sua devolução. Mudanças da callback podem levar até uma hora. [Gerar code](https://developers.rdstation.com/reference/gerar-code).
4. Trocar o código, de uso único e validade de uma hora, por tokens via `POST https://api.rd.services/auth/token?token_by=code`, usando `client_id`, `client_secret` e `code`. Guardar tokens somente no armazenamento privado da integração, sem saída em logs, screenshots, documentos ou chat. [Obter tokens](https://developers.rdstation.com/reference/obter-tokens-acesso).
5. Renovar o acesso com `POST https://api.rd.services/auth/token`, usando `client_id`, `client_secret`, `refresh_token`. Usar `expires_in` retornado; documentação Marketing indica 24 horas para acesso e refresh sem expiração, sujeito a revogação. Não aplicar o contrato diferente do CRM v2. [Renovação](https://developers.rdstation.com/reference/atualizar-access-token), [FAQ](https://developers.rdstation.com/reference/faq-autenticacao).
6. Validar sem alterar contatos: `GET /platform/segmentations` e `GET /platform/emails?query=Aula`, guardar apenas status, quantidade e IDs necessários. Confirmar a conta no consentimento e conferir os nomes conhecidos de campanhas/segmentações. Renovar e repetir somente consultas em caso de expiração; não repetir inserções de leads automaticamente. [Segmentações](https://developers.rdstation.com/reference/get_platform-segmentations).

## Uso para próximos envios

- Criar no RD um fluxo específico com conteúdo, remetente, UTMs, prazo e supressões revisados antes de ativar. Cada lote/evento precisa ter janela válida; um fluxo com oferta vencida não pode receber novos contatos.
- Antes de inserir: nos lembretes da aula, incluir somente compradores confirmados; em campanhas de aquisição, excluir quem já comprou a oferta. Em ambos os casos, excluir descadastrados/suprimidos, deduplicar por email e reservar o par campanha/contato. Aceite da API não prova entrega: reconciliar histórico do fluxo e métricas antes de retentar.
- Usar os limites do plano observado: inserção Light/Basic 1 requisição/hora; Pro 10/hora; Advanced 100/hora. Não comprar upgrade para remover esse limite sem decisão específica. [Limites](https://developers.rdstation.com/reference/limite-de-requisicoes-da-api).
- Para campanhas avulsas criadas com novo HTML, manter a publicação pela interface RD enquanto não houver um endpoint oficial de escrita confirmado. A API de campanhas do **CRM** registra atribuição de negociações e não dispara Email Marketing. [Campanhas CRM](https://developers.rdstation.com/reference/crm-v2-create-campaign).

## Credenciais e estado

Campos vazios preparados em `.env.example`: `RD_MARKETING_CLIENT_ID`, `RD_MARKETING_CLIENT_SECRET`, `RD_MARKETING_REDIRECT_URI`, `RD_MARKETING_REFRESH_TOKEN`. São exclusivos deste cliente/produto. O orquestrador deve preencher o armazenamento privado pelo fluxo autorizado, sem solicitar segredo no chat.

Aplicativo privado conectado: **Sevilha — Lembretes de Aulas**, ID **44350**. Credenciais e tokens permanecem exclusivamente no `.env.local` privado. O aplicativo **Sevilha N8n**, ID **31795**, não sofreu alterações.

Concluídos: criação do aplicativo separado, callback local, consentimento OAuth real e consultas GET autenticadas de segmentações, fluxos e emails (HTTP 200). A audiência da turma de 06/10 foi sincronizada e os lembretes foram enviados/agendados em etapa posterior, registrada em [Lembretes da aula de 06/10/2026](lembretes-aula-2026-10-06.md). Pendente para próximas turmas: configuração de fluxo reutilizável e integração de novos compradores. O script OAuth faz somente autenticação e consultas; não insere contatos nem envia emails.

## Ferramenta local pronta

`scripts/rd-marketing-oauth.py` usa somente Python stdlib. Callback a cadastrar: `http://127.0.0.1:8765/rd/callback`. Não abrir servidor de callback público.

```bash
python3 scripts/rd-marketing-oauth.py self-check
python3 scripts/rd-marketing-oauth.py login
python3 scripts/rd-marketing-oauth.py verify
```

`login` abre listener local por até dez minutos, imprime a URL de autorização (sem segredo), valida `state`, troca o código uma vez e salva tokens em `.env.local` com permissão 600 e troca de arquivo atômica. Somente salva se o Git confirmar que o arquivo privado é ignorado. Não imprime código OAuth, tokens ou corpo de respostas privadas.

`verify` renova o token e faz três consultas GET: segmentações, emails e fluxos. O console mostra apenas status e contagem da primeira página; campos fora do formato esperado aparecem como `null`, sem presumir base vazia. A validação não insere contatos nem envia email. O consentimento deve ser conferido na conta Sevilha antes de continuar.

O self-check não usa rede: cobre callback válida/inválida/duplicada, leitura de variáveis, persistência e permissão 600 com mocks, resposta GET simulada e contagens de recursos. Emails usam `items` no formato `{total, items}`; segmentações e fluxos usam suas próprias chaves. Conexão real só pode ser declarada depois de `login`/`verify` autenticados.
