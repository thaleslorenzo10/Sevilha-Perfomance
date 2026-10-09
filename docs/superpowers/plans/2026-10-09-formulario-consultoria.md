# Formulario Consultoria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. O usuario exige ondas paralelas com arquivos disjuntos. Subagentes nao commitam.

**Goal:** Entregar o formulario proprio nas duas LPs com contato no final e fluxo completo de integracoes verificavel.

**Architecture:** Manter HTML e JS compartilhado nas rotas existentes e reutilizar `/api/leads`. Persistir recibos por submissao no Supabase antes de mostrar sucesso e preservar a classificacao de consultoria no dashboard.

**Tech Stack:** HTML, CSS, JavaScript, Node serverless, Supabase, RD Station, Google Sheets, Meta CAPI; agent-browser para validacao.

**Spec:** `docs/superpowers/specs/2026-10-09-formulario-consultoria-design.md`

## Global Constraints

- Seis etapas: colaboradores, cargo, escritorio, nome, email, WhatsApp.
- Preservar valores/nomes atuais; escritorio opcional; demais campos obrigatorios.
- Sem nova dependencia, funcao serverless ou alteracao de campanha.
- Arquivos novos ate 350 linhas; nao aumentar a divida existente.
- Nao commitar alteracoes anteriores do usuario nem expor credenciais.
- Publicacao e mensagens externas nao autorizadas; testes externos exigem identidade de teste e readback.

## Review Focus

- Enter nao pode enviar antes do ultimo passo ou validar campos invisiveis.
- Fechar/reabrir e voltar nao apagam respostas nem criam outro event_id em retry.
- Porte pequeno e cargo operacional podem concluir sem virar Clube ou MQL incorreto.
- Banco falhando nao pode responder sucesso; falha auxiliar salva recibo sem bloquear lead.
- Reenvio nao cria dois negocios/linhas nem dois eventos Meta.

### Task 1: Formulario compartilhado nas duas LPs

**Files:** `mentoria/index.html`, `mentoria-2/index.html`, `assets/form-steps.js`, novo `assets/consultoria-form.css`, `scripts/test-form-passos.js`; teste de UI se necessario `scripts/test-consultoria-form-ui.js`.
**Depends-on:** Nenhuma; paralela com Task 2.
**Interfaces:** Consumir `SP_handleSubmit(event, form, onSuccess, onError)`, `SP_marcar(evento, valor)`, `SP_populateHiddenFields(form)`. Manter `openModal`, `closeModal`, `submitForm`, `toggleFaq`, formulario `sessao-form`, botao `submit-btn`.

- [ ] Ler os contratos e criar teste das seis etapas nas duas paginas, campos e IDs usados.
- [ ] Implementar experiencia de uma pergunta por vez com layout de marca Sevilha, logo/foto reais, progresso, voltar, foco, erros e responsividade.
- [ ] Preservar avisos de porte/cargo, atalhos de porte e todos os campos de tracking. Manter nomes/valores existentes para backend/dashboard.
- [ ] Validar por etapa; escritorio pode ser pulado; Enter avanca apenas e somente a ultima etapa envia.
- [ ] Conferir testes offline e lint dos arquivos alterados. Reportar arquivos e resultados; sem commit.

### Task 2: Persistencia e recibos de integracao

**Files:** `api/leads.js`, `assets/tracking.js`, helper novo `lib/consultoria-leads.js` ou `lib/lead-integracoes.js`, testes novos `scripts/test-consultoria-leads.js`, ajustes necessarios em `scripts/test-leads-capi.js`, `scripts/test-lead-qualificado.js`; migracao SQL aditiva se necessaria.
**Depends-on:** Nenhuma; paralela com Task 1.
**Interfaces:** POST `/api/leads` preserva campos existentes; `ok:true` para consultoria somente apos salvar no banco. Resposta publica nao inclui contatos/segredos. `integracoes` recebe recibos com estado e IDs de destino, nunca payloads sensiveis.

- [ ] Ler todos os chamadores/testes da funcao e criar teste offline com fetch interceptado: validacao, persistencia antes de envio, erro do banco, status de cada integracao.
- [ ] Implementar validacao server-side para `/mentoria` e `/mentoria-2`, persistencia confirmada e recibos em coluna existente `integracoes`.
- [ ] Retornar sucesso somente apos persistir. Integracoes auxiliares falham aberto, mas seus recibos explicitam pendencia/falha.
- [ ] Tornar reenvio da mesma submissao idempotente, inclusive identidade do navegador e concorrencia. Preparar indice exclusivo somente se necessario, sem aplicar SQL sem coordenação.
- [ ] Preservar comportamento das demais paginas e normalizacao CAPI. Reusar helpers existentes e conferir HTTP/corpo e vinculo CRM.
- [ ] Executar testes offline incluindo Pixel/CAPI event_id e falhas das integracoes. Reportar arquivos, testes e requisitos live; sem commit.

### Task 3: Revisao, verificacao e entrega

**Files:** Relatorio `docs/formulario-consultoria-validacao-2026-10-09.md`, eventuais correcoes exclusivamente nos arquivos das Tasks 1/2 pelo agente dono.
**Depends-on:** Tasks 1 e 2.
**Interfaces:** Codigo integrado das duas tasks; credenciais existentes do cliente usadas somente no processo servidor.

- [ ] Revisao independente de requisitos, codigo e seguranca, incluindo idempotencia/PII/falhas.
- [ ] Rodar `npm run lint`, `npm run lint:biome`, testes offline pertinentes, `clube-da-performance/node_modules/.bin/tsc --noEmit -p clube-da-performance/tsconfig.json`, `npm --prefix clube-da-performance run build`.
- [ ] Subir servidor local com funcoes; testar as duas LPs pelo agent-browser em 390x844 e 1440x900, screenshots lidos, console, acessibilidade e rede.
- [ ] Auditar recursos/credenciais reais, executar somente testes que nao disparem comunicacao externa indevida; readback de banco/planilha/CRM/CAPI quando possivel. Documentar bloqueios concretos.
- [ ] Atualizar resultado do plano, preparar entrega e commit somente dos arquivos desta tarefa apos validacao. Nao publicar sem autorizacao aplicavel.
