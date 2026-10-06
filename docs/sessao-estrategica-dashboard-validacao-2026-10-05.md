# Dashboard SE — comparação de formatos e validação local

Implementado no clone de produção `/private/tmp/sevilha-search-livebase-20261005`, sem commit ou publicação nesta etapa. As abas **Formatos de campanha** e **Sessão Estratégica** reutilizam o comparativo de formulário nativo Meta, Respondi, Google Search, site atribuído à Meta e site sem rastreio. Imagem e vídeo não são a dimensão deste comparativo.

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
