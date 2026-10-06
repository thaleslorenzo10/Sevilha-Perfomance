# Dashboard SE — comparação de formatos e validação em produção

Implementado inicialmente no clone de produção `/private/tmp/sevilha-search-livebase-20261005`; a etapa local abaixo antecedeu a publicação posterior pelo coordenador. A publicação no domínio público foi concluída e conferida no navegador, conforme a seção final. As abas **Formatos de campanha** e **Sessão Estratégica** reutilizam o comparativo de formulário nativo Meta, Respondi, Google Search, site atribuído à Meta e site sem rastreio. Imagem e vídeo não são a dimensão deste comparativo.

## Métricas e limites

O quadro apresenta investimento, contatos únicos dentro de SE, MQL de porte 10+, taxa MQL, CPL e custo/MQL. Canal, identidade e público só aparecem quando conhecidos. Custos usam contatos/MQL pagos completos, campanha por ID string ou nome unívoco, fonte saudável e intervalo idêntico. O adapter reutiliza a resposta Meta já carregada e a fonte Google opcional; não adiciona chamada Meta.

Ausência de fonte, gasto não mapeado, IDs imprecisos, nomes ambíguos, período divergente ou base paga incompleta tornam o custo indisponível. A correção alcança também o resumo executivo, as tabelas legadas de SE e origem e o gráfico de custo, impedindo custos zero ou verdes produzidos por uma fonte ausente. O total de investimento legado continua explicitamente **Meta**, sem misturá-lo com o investimento Google do novo quadro.

A indicação de menor custo/MQL é descritiva, acompanhada de contatos, MQL e período; não proclama vencedor estatístico. O crédito operacional usa a primeira data por contato e oferta na janela histórica de 180 dias, antes do recorte solicitado. Empates no mesmo dia priorizam Meta Forms → Respondi → site; horário não é comparado. Contatos anteriores de SE não são recontados como novas captações. Essa regra não demonstra causalidade entre canais. O resumo global usa **registros por oferta**, pois a mesma pessoa em ofertas distintas não representa uma pessoa única global.

Google aparece com catálogo de campanhas, status e gasto somente quando a fonte está disponível e corresponde à janela. Zero de campanha pausada é permitido após confirmação saudável de catálogo e métricas pelo provider. Insights Meta não constituem catálogo completo das entidades sem entrega; essa limitação está escrita no painel. Campanha em preparação/pausada não representa resultado de teste.

CRM, planilha e ausência de recibo durável ficam separados de performance. Uma linha histórica em planilha não prova CRM ou persistência nos três destinos. O recebimento do novo formulário nativo nos três destinos ainda precisa ser comprovado antes da ativação. Sessões agendadas e realizadas permanecem indisponíveis sem fonte de agenda verificada. As metas 80–90 MQL e 30 sessões/mês são objetivos comerciais, sem promessa de resultado e sem comparar uma seleção de 7 dias ao denominador mensal.

## Verificação

- `test-dash-cruzamento.js`, `test-dash-aula.js`, `test-dashboard-main.js` e `test-dash-aquisicao-se.js`: exit 0.
- Teste novo em VM Node, sem rede: reconciliação Meta e Google, mesma janela, base paga, IDs/string e nomes unívocos, gasto sem rota, erro de provider, zero confirmado sem falso custo/MQL zero, resumo/tabelas de origem, recibos e fetch Google opcional em período atual/anterior. Catálogo com janela divergente é ocultado.
- ESLint nos arquivos UI alterados e teste: exit 0, **0 erros e 9 avisos** (logs de diagnóstico/testes e complexidade preexistente de `grupo.renderKpis`). Nenhuma regra ou limite foi alterado.
- `git diff --check`: exit 0.
- Revisão independente pelo agente Google preflight: adapter/fetch aprovados; ajuste solicitado para condicionar o catálogo à mesma janela aplicado e testado.

## Evidências visuais: exclusivamente teste sintético

Agent-browser local, desktop 1440×900 e mobile 390×844. API interceptada pelo servidor local com agregados fictícios, sem contato ou PII; nenhuma submissão ou chamada a APIs externas. As capturas trazem a marca **TESTE LOCAL · dados sintéticos, sem PII**. Números, nomes e resultados nessas imagens **não são produção**.

No cenário fictício, Meta nativo tem R$ 1.200 / 25 MQL = R$ 48, Respondi R$ 600 / 5 MQL = R$ 120; Google pausado possui gasto zero confirmado e nenhum MQL, portanto custo/MQL indisponível. Isso valida a apresentação e o cálculo, não a performance real.

Conferidos cliques nas abas e filtro de 7 dias, atualização da janela, ausência de overflow horizontal da página e rolagem interna da tabela no mobile. Recursos externos: zero; console do contexto final sem mensagens. A biblioteca de gráficos CDN é deliberadamente excluída do fixture sem rede, com fallback de tabelas preservado; isso não valida o carregamento CDN em produção.

- [Desktop — quadro e recibos](evidencias/sessao-estrategica-dashboard-2026-10-05-desktop.png)
- [Mobile — formatos e investimento](evidencias/sessao-estrategica-dashboard-2026-10-05-mobile.png)
- [Mobile — custos com rolagem da tabela](evidencias/sessao-estrategica-dashboard-2026-10-05-mobile-custos.png)

Publicação e conferência da fonte real no ambiente de destino permanecem a cargo do coordenador. Nenhuma ativação de campanha decorre desta alteração de painel.

## Revalidação após proteção dos endpoints públicos

Após o backend owner concluir a remoção de dados pessoais das respostas públicas, o contrato de agregados da UI permaneceu igual. As quatro VMs UI listadas acima foram executadas novamente com exit0. Busca no código do painel confirmou ausência de dependência de e-mail, telefone ou chave pessoal para renderizar métricas.

Agent-browser local reaberto com fixture sintético sem PII: desktop1440×900, mobile390×844, sete colunas, zero recursos externos, console vazio, overflow da página false e tabela móvel com rolagem interna. Capturas novas inspecionadas: [desktop pós-proteção](evidencias/sessao-estrategica-dashboard-2026-10-05-pos-privacy-desktop.png) e [mobile pós-proteção](evidencias/sessao-estrategica-dashboard-2026-10-05-pos-privacy-mobile.png). Servidor local e navegador encerrados. Essa evidência valida a interface com agregados fictícios; a proteção efetiva do endpoint e a resposta em produção dependem dos testes backend e do readback de publicação do coordenador.

## Preview protegido: aplicação não validada

Deployment `dpl_FzsX5LXDrgH7dii7VceH9DT6xNH5`, host `sevilha-perfomance-77sx968jo-tplorenzo45-6512s-projects.vercel.app`: o navegador foi redirecionado para Login Vercel, DOM "Log in to Vercel". A aplicação, suas APIs e mentoria não ficaram acessíveis para validação. Não se afirma preview aprovado.

A operação oficial `get_access_to_vercel_url` foi rejeitada pela revisão automática por criar link compartilhável que contorna autenticação sem autorização específica. Nenhum link/cookie alternativo ou login foi aplicado. Sessão de preview encerrada; as evidências locais anteriores continuam exclusivamente sintéticas. A conferência no domínio público existente só ocorrerá após publicação separada pelo coordenador, usando `?sp_interno=1` (parâmetro efetivamente lido por tracking.js), sem submissão de formulário.


## Produção pública — conferência posterior concluída

Deployment READY `dpl_EBqu1eMmpKQKjYmQhNBWSG8Ye2yX`, domínio https://sevilha-perfomance.vercel.app, conferido em 05/10/2026 após 23:41 BRT. Agent-browser em sessão nomeada, sem fixtures ou substituição de respostas, com `sp_interno=1` e armazenamento `_sp_interno=1`. Nenhum formulário foi preenchido ou enviado.

Abas FormatOS de campanha e Sessão Estratégica abertas por clique em desktop 1440×900; tabela com cinco formatos e sete colunas. SE mobile 390×844 sem overflow horizontal da página e tabela com rolagem própria. Mentoria aberta nos dois tamanhos, texto, imagem Bruno, opções de porte e CTA visíveis; tracking `v=9`, form-steps `v=4` e quatro âncoras presentes. Não houve requisições Google/Meta de analytics no contexto interno.

Na janela real 06/09–05/10/2026, o readback posterior do quadro SE mostrou nativo Meta: R$ 6.325,31, 109 contatos, 34 MQL, CPL R$ 58,03 e custo/MQL R$ 186,04. A primeira captura da aba Formatos registra a atualização anterior de mídia (R$ 6.322,41); as duas fotografias têm momentos distintos e não são exportação estática. Site Meta teve 7 contatos/6 MQL e sem rastreio 1/1, com custos indisponíveis. Respondi e Search 0/0 na janela; gasto Search R$ 0 confirmado pela fonte saudável e catálogo das duas campanhas pausadas. Comparação de menor custo/MQL ficou indisponível por haver menos de duas rotas reconciliadas. CRM, agenda e entrega do novo formulário nos três destinos continuam sem certificação por esta visita.

APIs de Meta, leads unificados, RD, stats e Google responderam HTTP 200 no período atual; as quatro consultas de comparação anterior também responderam 200. Chart.js CDN, scripts, CSS, imagens e fontes responderam 200. Console vazio nas visitas completas; única falha de recurso observada foi `/favicon.ico` HTTP 404 preexistente. Na troca posterior para 7 dias, a espera pelo seletor específico do quadro SE expirou após 25 segundos na aba Formatos. A leitura DOM final mostrou o quadro de Formatos preenchido e planilha nativa 31/31, sem overflow; não foi registrada captura nem verificado o texto exato de intervalo desse recorte. O filtro teve resposta tardia observada, sem certificação de tempo ou período por esta execução. Não foram forçados números, respostas ou fixtures.

Capturas reais abaixo foram abertas e inspecionadas; exibem somente métricas agregadas e conteúdo público, sem contatos pessoais:

- [Formatos — desktop produção](evidencias/sessao-estrategica-dashboard-2026-10-05-producao-formatos-desktop.png)
- [SE — desktop produção](evidencias/sessao-estrategica-dashboard-2026-10-05-producao-se-desktop.png)
- [SE — mobile produção](evidencias/sessao-estrategica-dashboard-2026-10-05-producao-se-mobile.png)
- [Mentoria — mobile produção](evidencias/sessao-estrategica-dashboard-2026-10-05-producao-mentoria-mobile.png)
- [Mentoria — desktop produção](evidencias/sessao-estrategica-dashboard-2026-10-05-producao-mentoria-desktop.png)

Publicação posterior concluída pelo coordenador e telas públicas conferidas com dados reais; preview SSO permanece não validado, a conferência do filtro real de 7 dias tem o limite acima, e nenhuma submissão real ou comprovação de ingestão decorre desta validação visual.
