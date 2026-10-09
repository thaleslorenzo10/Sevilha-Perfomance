# Formulario proprio de consultoria: validacao

## Entrega local

As paginas `/mentoria` e `/mentoria-2` usam o mesmo formulario conversacional:
colaboradores, cargo, escritorio opcional, nome, email e telefone. A oferta,
as faixas de porte e a qualificacao existentes foram preservadas. O formulario
tem voltar, validacao por etapa, teclado, foco, progresso e confirmacao antes
do botao de WhatsApp. O dashboard continua lendo `sevilha_leads`.

O cadastro precisa ser confirmado no banco antes de responder sucesso. Cada
destino possui recibo persistido; uma falha auxiliar nao apaga a inscricao.
O `event_id` e compartilhado por Pixel/CAPI e preservado em reenvios.
Envios ambiguos nao sao repetidos automaticamente.
Claims interrompidas podem ser retomadas por CAS apos 330s, acima do limite
de execucao: somente destinos pendentes ou com falha confirmada seguem;
destinos `processando/incerto` precisam de readback antes de outro POST.

## Verificado

- `npm run lint`: exit 0; 732 avisos na raiz e 2 no Next. Baseline: 781 e 2.
- `npm run lint:biome`: exit 0; 5 avisos existentes, sem rebaixar regras.
- Typecheck Next: `clube-da-performance/node_modules/.bin/tsc --noEmit -p clube-da-performance/tsconfig.json`, exit 0 apos build.
- `npm --prefix clube-da-performance run build`: exit 0. Raiz HTML/serverless nao possui build ou typecheck canonicos.
- Testes offline: `test-consultoria-leads`, `test-consultoria-form-ui`, `test-form-passos`, `test-leads-unificados`, `test-sessao-estrategica`, `test-eventos-pagina`, `test-pageview`, `test-leads-capi`, `test-lead-qualificado`.
- `agent-browser`: desktop 1440x900 e mobile 390x844; ambas as LPs, radios por label/setas, validacao, contatos no final e respostas preservadas. Submissao de navegador simulada para nao acionar automacoes externas.
- Erro/reenvio no navegador preservou o mesmo ID; sucesso disparou um Pixel Lead com esse ID. Nenhum Pixel no erro.
- Console e page errors vazios; scripts, CSS, logo e foto responderam HTTP 200.
- Axe do modal: zero violacoes; contraste parcialmente inconclusivo no simbolo de fechar e texto com fundos sobrepostos, conferidos visualmente.
- Vitals locais da variante 2: LCP 296ms, CLS arredondado 0, TTFB 2ms. Nao sao metricas de producao.
- Banco real: POST 201; CAS JSONB aplicado e comparacao obsoleta recusada; retry e duas chamadas concorrentes mantiveram uma unica linha. Cleanup DELETE 200 removeu exatamente a linha sintetica, GET confirmou zero restantes.

O teste real usa `scripts/test-consultoria-banco-live.js --execute`, identidade
TESTE e email `example.invalid`. Guard impede qualquer envio fora da tabela
e do evento exclusivos; Sheets/CRM/Marketing/Meta ficam desligados no processo.
O indice existente `leads_event_id_key UNIQUE(event_id)` e a coluna
`integracoes jsonb` foram conferidos; nenhuma migracao foi necessaria.
Teste real repetido depois das correcoes finais: exit 0, cleanup de uma linha
confirmado e zero chamadas aos destinos externos.
Revisao independente encontrou bloqueio por claim interrompida; correcao de
retomada e isolamento de funil CRM foi re-revisada, sem novos bugs encontrados.
Gitleaks staged com `--redact`: nenhuma exposicao de segredo encontrada.

Screenshots: [desktop](evidencias/formulario-consultoria/desktop.png) e
[mobile](evidencias/formulario-consultoria/mobile.png).

## Integracoes externas e publicacao

Implementadas no codigo, mas entrega externa completa ainda NAO comprovada:

- Sheets: email/chave de conta de servico locais sanitizados; permissao EDITOR e append nao verificados.
- RD Marketing: OAuth renovado, GETs autorizados funcionam. Chave de conversao sanitizada; workflows reais existem e supressao de contato de teste nao foi comprovada.
- RD CRM: token e recursos respondem. Producao atual nao tem `RD_CRM_STAGE_ID_SE` e encaminha ao Clube; etapa Consultoria/Novos Leads verificada: `68d152fa949ae20022df32cd`. Novo codigo impede fallback para o Clube e usa `nao_configurado` sem etapa SE. Campanha SE ausente e omitida, nunca substituida pela campanha do Clube.
- Meta: pixel `657178423444244` respondeu GET; token CAPI local sanitizado e codigo de teste ausente. Testes offline verificam normalizacao/hash, contrato de erro e mesmo event ID, nao recebimento real pela Meta.
- Vercel: projeto correto e producao READY conferidos por GET. Nenhum push/deploy foi autorizado ou executado; as URLs publicas ainda servem a versao anterior.

O endpoint usa `maxDuration: 300`, cobrindo o envelope conservador de chamadas
sequenciais (~249,5s); medir no runtime publicado continua pendente.
Referencia: [duracao das Vercel Functions](https://vercel.com/docs/functions/configuring-functions/duration).

`.env.local` ignorado pelo Git foi preparado com comentarios de origem das
credenciais faltantes. Supabase foi restaurado da fonte compartilhada cujo
projeto corresponde exatamente; etapa CRM SE foi preenchida somente localmente.
Codigo Meta de teste esta vazio e marcado exclusivamente local: nunca propagar
para producao. Credenciais administrativas da Vercel nao foram postas no runtime.

## Limites

Nao houve alteracao de campanhas, envio de email/WhatsApp, inscricao em
automacao ou gasto. Graphify nao esta disponivel no PATH, portanto o grafo
existente nao foi atualizado. Node local 22 diverge do engine 24 declarado;
framework e dependencias nao foram atualizados nesta tarefa.
O build/typecheck simultaneos disputaram arquivos `.next/types`; repeticao do
typecheck depois do build passou, sem alterar o projeto.
