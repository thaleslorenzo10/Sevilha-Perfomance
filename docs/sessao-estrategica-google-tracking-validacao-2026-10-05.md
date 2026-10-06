# Validação Google Ads — Sessão Estratégica, 05/10/2026

## Validação final na base de produção

Esta seção substitui as referências anteriores a `v=6` e à validação no checkout antigo. A implementação pronta para publicação está no clone `/private/tmp/sevilha-search-livebase-20261005`, branch `codex/se-captacao-google-20261005`, sobre a base de produção `fc2529edc3058b0dc21b5630cd8626091328f414`. Sem commit, deploy ou submissão real nesta etapa.

O diff de fontes contém somente `api/leads.js`, `assets/tracking.js`, `mentoria/index.html` e `mentoria-2/index.html`, mais os dois novos testes Google/persistência. Ambos os HTMLs usam `tracking.js?v=9` e preservam `form-steps.js?v=4`. Comparação determinística com o HTML da base confirmou apenas a versão de tracking e os três IDs da primeira variante; todo o restante do HTML foi preservado.

A produção inclui Aula e Café no beacon `INSTRUMENTADA`. Essa lista continua intacta. Google possui guarda SE explícita independente (`GOOGLE_SE`) nos dois pontos: inicialização e conversão. `/aula-gestao-operacional` e `/cafe-com-sevilha` não configuram nem enviam conversões Google; os testes cobrem ambas. Os requisitos de persistência, deduplicação, porte e exclusão interna descritos abaixo permanecem válidos.

Seis testes offline passaram com exit 0 no clone: `test-google-tracking.js`, `test-leads-persistencia.js`, `test-leads-capi.js`, `test-lead-qualificado.js`, `test-ofertas-cafe.js` e `test-leads-aula.js`. A rede das simulações é substituída por mocks. `git diff --check` passou. Os lints canônicos registrados ao final foram executados no checkout raiz e não equivalem a um lint completo deste clone.

`agent-browser` local no clone: `/mentoria` e `/mentoria-2` em 1440×900 e 390×844, com `?sp_interno=1`; quatro screenshots abertos e inspecionados, console vazio, nenhum overflow horizontal identificado. DOM confirmou tracking v9, form-steps v4, quatro âncoras na primeira variante e zero scripts Google nas visitas internas. Não houve submissão. Navegador e servidor local foram encerrados.

Evidências temporárias: `/tmp/se-livebase-mentoria-desktop.png`, `/tmp/se-livebase-mentoria-mobile.png`, `/tmp/se-livebase-mentoria2-desktop.png`, `/tmp/se-livebase-mentoria2-mobile.png`; logs legados em `/tmp/se-livebase-{capi,qualificado,cafe,aula}.log`. Patch de quatro fontes para integração: `/tmp/sevilha-google-livebase-source.patch`. Os dois novos testes estão no diretório `scripts` do clone.

Publicação, conferência das versões públicas e recebimento real de eventos continuam sob responsabilidade do coordenador. Nenhuma conversão real foi afirmada.

## Registro anterior no checkout raiz

Implementado localmente, sem deploy, commit ou submissão real. Conta Google Ads de referência: 1316487378; tag AW-18496635417. Não houve alteração de campanhas nesta etapa.

- Lead secundário: `AW-18496635417/3aj1CJus0pIdEJmE8fNE`.
- MQL primário: `AW-18496635417/Yza4CJ6s0pIdEJmE8fNE`.
- Somente `/mentoria` e `/mentoria-2`, inclusive barra final. O script remoto entra após dois frames, preservando o primeiro paint; `sp_interno` bloqueia configuração, carregamento e conversão.
- Lead exige resposta HTTP bem-sucedida com `ok: true` e `persisted: true`. O endpoint informa persistência verdadeira somente após aceite da gravação pelo Supabase; configuração ausente, HTTP de erro ou exceção retornam `persisted: false`, mantendo a inscrição e os fluxos Meta/RD existentes.
- MQL exige adicionalmente porte 10+, equivalente à regra existente de `lib/porte.js`. Cargo não cria um corte novo. O teste confronta os formatos canônicos e casos ambíguos com o helper do servidor.
- `event_id` vai ao Google como `transaction_id`. Payload de conversão contém somente `send_to` e `transaction_id`; nome, e-mail e telefone não são enviados. Enhanced conversions permanece desativado; contexto Google usa URL sem query e referrer vazio.
- Falha no POST não dispara Google, inclusive quando o handler legado sem `onError` prossegue para a tela de sucesso. Falha do próprio gtag também não bloqueia inscrição. A fila/retry existente continua preservada.

Cache atualizado para `tracking.js?v=6` nas duas variantes. Em `/mentoria`, IDs foram adicionados aos blocos existentes: `como-funciona`, `para-quem`, `bruno-silvestre`; `agendar` já existia. Nenhuma reforma visual.

Verificações offline executadas e aprovadas:

1. `node scripts/test-google-tracking.js`: sucesso, falha HTTP, resposta sem persistência, corte de porte, duas rotas, outras ofertas, interno, deduplicação, ausência de dados pessoais no evento, ordem de paint, bloqueador gtag, versões e âncoras.
2. `node scripts/test-leads-persistencia.js`: handler real em VM, Supabase aceito/ausente/HTTP de erro/exceção, resposta `persisted` verdadeira/falsa, fluxo Meta preservado. Todas as dependências de rede são mocks.
3. `node scripts/test-leads-capi.js` e `node scripts/test-lead-qualificado.js`: caracterização legada de Meta aprovada, sem rede real.
4. ESLint nos seis arquivos de implementação/teste alterados: zero erros; `git diff --check`: aprovado. Os avisos/gates existentes não foram rebaixados.

Navegador `agent-browser`, sessão isolada `google-se-5764b0e9a7a9`: ambas as variantes locais em 1440×900 e 390×844, com `?sp_interno=1`; modal da primeira variante aberto por porte 10 a 19, sem informar contatos nem enviar. Screenshots foram abertos e inspecionados: sem corte da headline, sobreposição do modal ou imagens ausentes; segunda variante sem overflow horizontal. Console vazio nas duas páginas. DOM confirmou `?v=6` nas duas, quatro âncoras na primeira e zero scripts Google durante visita interna.

Capturas locais temporárias: `/tmp/se-google-desktop.png`, `/tmp/se-google-mobile.png`, `/tmp/se-google-mobile-modal.png`, `/tmp/se-google-mentoria2-mobile.png`, `/tmp/se-google-mentoria2-desktop.png`. Navegador e servidor estático de teste foram encerrados.

Limite da validação: Google foi simulado nos testes para evitar conversões reais; o navegador conferiu renderização e exclusão interna. Publicação e recebimento dos eventos pela conta Google Ads ainda exigem validação no ambiente de destino pelo coordenador. Não foi afirmada conversão real nesta etapa.

## Quality gates canônicos após build

A varredura de saídas geradas do subprojeto (`clube-da-performance/.next`) e cópias de worktrees produzia erros alheios aos fontes atuais. Ajuste mínimo aplicado aos arquivos de configuração já modificados: no ESLint, acrescentados somente `**/node_modules/**`, `**/.next/**` e `.superpowers/worktrees/**`; no Biome, acrescentados somente `!!**/node_modules`, `!!**/.next` e `!!.superpowers/worktrees`. Todo o conteúdo anterior, regras, severidades e teto de 350 linhas foi preservado. O código `clube-da-performance/app` permanece analisado pelo lint canônico do subprojeto.

A sintaxe `!!` foi confirmada na [documentação oficial do scanner e files.includes](https://biomejs.dev/reference/configuration/#filesincludes): exclusão simples pode permitir descoberta de configurações aninhadas; force-ignore impede indexação desses caminhos. A instalação local é Biome 2.5.12.

Execuções completas em 05/10/2026:

- `npm run lint`: exit 0; raiz com 0 erros/790 avisos, seguido do Clube com 0 erros/2 avisos.
- `npm run lint:biome`: exit 0; 139 arquivos conferidos, 0 erros/5 avisos, nenhuma correção automática aplicada.
- `git diff --check -- eslint.config.mjs biome.json`: aprovado.

Logs temporários: `/tmp/se-quality-lint-2026-10-05.log` e `/tmp/se-quality-biome-2026-10-05.log`. Os quatro testes funcionais já registrados não foram repetidos nesta etapa porque nenhuma lógica de aplicação mudou. Sem commit ou deploy.
