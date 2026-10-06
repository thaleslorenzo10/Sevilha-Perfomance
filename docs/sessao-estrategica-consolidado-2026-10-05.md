# Sessão Estratégica — execução, metas e próximos passos

Atualização: noite de 05/10/2026, horário de São Paulo. Este relatório distingue configuração criada, implementação local, publicação e veiculação. A autorização final foi publicar e ativar todas as campanhas novas; os bloqueios abaixo impediram concluir essas duas últimas etapas.

## Objetivo e orçamento

Meta comercial: **30 sessões estratégicas/mês**, aproximadamente **7/semana**, com **80–90 MQL/mês**. MQL mantém o critério existente de escritório com **10 ou mais colaboradores**. Sessão agendada e realizada precisam de fonte de agenda; lead e negócio no CRM não substituem sessão.

Orçamento total exclusivo de SE: **R$ 14.000/mês**, incluindo captação, conteúdo e Google. Custo combinado de referência: R$ 155,56–175/MQL e R$ 466,67/sessão. Para 30 sessões, 33,3–37,5% dos MQL precisam chegar à sessão; isso é requisito do funil, não taxa já alcançada.

| Frente | Alocação planejada por dia | Situação |
|---|---:|---|
| Meta captação fria/quente, novas campanhas | R$ 320 | Preparação pausada; depende da entrega de leads |
| Conteúdo novo de Bruno, somente Instagram | R$ 40 | Preparação; dentro do teto, sem verba adicional |
| Google Search genérico | R$ 70 | Criada, pausada |
| Google Search de marca | R$ 20 | Criada, pausada |
| Total | R$ 450 | Nominal até R$ 13.896: Meta 31 dias + Google 30,4 dias |

A configuração ativa anterior mantém **R$ 450/dia somente em captação Meta**, soma dos CBOs R$ 132,35 + R$ 145,59 e ABO R$ 172,06. A distribuição futura não foi adicionada por cima desse gasto. A migração deve reduzir/substituir a verba antiga antes de ativar conteúdo e Google. Limite diário nominal não é trava financeira mensal; controlar gasto acumulado de SE, sem limitar outras ofertas da conta.

## Alterações realmente realizadas

- Campanha Meta de landing page quente pausada; fria já estava pausada. Outras ofertas, como Aula, Café e Clube, preservadas.
- Novo formulário Meta de maior intenção criado: **1776305790272614**. Seis campos mantêm a compatibilidade da planilha: colaboradores, cargo, escritório, nome, e-mail e telefone. Não aceita leads de distribuição orgânica do formulário. O formulário existe, mas seus anúncios novos estão pausados.
- Nova campanha Meta **120253413819760526**, criada do zero, orçamento ajustado e relido em **R$ 320/dia, PAUSED**, com conjuntos frios Sevilha e Bruno e **cinco conceitos históricos**, reproduzidos nas duas identidades. Nenhuma afirmação de que todas as campanhas ativas já usam só esses cinco: a transição continua pendente.
- Cinco conceitos selecionados por custo/MQL reconciliado no mesmo intervalo e por contatos únicos: **AD21, AD16, IA, AD29 e Vicente**. O ranking não cruza custo de toda a vida com MQL de uma janela menor.
- Nova conta Google **1316487378**, BRL/São Paulo, vinculada ao gerenciador da agência e com auto-tagging. Conta antiga de Sevilha Contabilidade preservada.
- Search genérico **24328953730**, R$ 70/dia; Search de marca **24317774874**, R$ 20/dia. RSAs completos com 15 títulos e 4 descrições, sem fixação, sitelinks e frases de destaque. Marca contempla Sevilha Contabilidade, Performance/Perfomance e variações previstas. As três RSAs foram aprovadas, mas a força do anúncio permanece **PENDING**; conferir novamente após o processamento da plataforma e iterar se não chegar à nota máxima; não foi certificada como Excelente.
- Conversões Google Lead secundária e MQL primária criadas. A implementação só dispara conversão após confirmação durável de banco, planilha e CRM; falha não trava o formulário.
- Coluna **public.sevilha_leads.integracoes**, tipo jsonb, aplicada no projeto Supabase correto e relida. Não houve teste com contato real, mensagem ou disparo de WhatsApp.

## CRM, planilhas e rastreamento

Implementação pronta na branch **codex/se-captacao-google-20261005**, baseada na versão exata que está em produção, preservando mudanças recentes de Aula e Café. Commits: c8aa709 (tracking), 23616f5 (ingestão/recibos), 4240f29 (fonte Google), 60dc9d3 (dashboard).

Cada inscrição do site registra resultado por integração: Supabase, Sheets, RD Marketing e RD CRM. Confirmação da planilha depende do recibo do append; confirmação de CRM depende de releitura do negócio e correspondência do contato. A resposta aceita pelo provedor e a entrega verificada são estados separados. E-mail/telefone não vão para nomes de campanhas nem UTMs.

Para SE, o padrão do RD CRM será **Consultoria → Novos Leads**, quando não houver substituição explícita em RD_CRM_STAGE_ID_SE. Esse destino foi confirmado na estrutura do CRM; não usar o estágio do Clube nem Disparos WhatsApp. A configuração da variável permite outro destino operacional quando definido pelo cliente.

UTM Meta: `utm_source={{placement}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`. Google usa google_search, nome do grupo/campanha/anúncio e `{keyword}`. Nomes novos são estáveis. IDs Meta são preservados como texto. Depois da veiculação, conferir substituição real das macros e os registros gravados; configuração por API não prova o clique até o CRM.

**Novo formulário nativo ainda sem entrega comprovada nos três destinos.** Inscrição nativa não passa automaticamente pela API do site. A assinatura do aplicativo na Page não prova o callback nem a integração desse novo form. A releitura encontrou zero leads e zero linhas do novo formulário; o importador Sheets → RD CRM encontrado está inativo, foi inspecionado e lê outra planilha, sem gatilho leadgen nem filtro desse form. Ativá-lo não conectaria o formulário novo. Por isso a captação nova não deve ser ativada antes dessa comprovação. O fluxo Respondi existente é outro produtor e não comprova o nativo.

## Dashboard implementado

Comparação de **Meta nativo, Respondi, Google Search, site atribuído à Meta e site sem rastreio**. Métricas: investimento, contatos únicos de SE, MQL 10+, taxa MQL, CPL e custo/MQL. Exibe separadamente CRM/planilha confirmados e ausência de recibo; informação indisponível não vira zero.

Google tem fonte própria de custo e catálogo/status de campanhas. Leitura real da conta confirmou ambas pausadas e gasto zero no intervalo 01–05/10. Custos só são calculados com campanha reconciliada, base paga completa e mesma janela. Menor custo/MQL é comparação descritiva, não vencedor estatístico. O crédito usa primeira data por contato/oferta em histórico de 180 dias; empates priorizam Meta Forms, Respondi e site. Não é atribuição causal.

Agenda ainda não integrada: sessões agendadas/realizadas aparecem indisponíveis. O catálogo Meta sem entrega ainda não é completo. Imagens de teste são sintéticas e não demonstram resultados reais.

[Validação visual e screenshots](sessao-estrategica-dashboard-validacao-2026-10-05.md).

## Conteúdo e públicos Bruno

Somente Instagram, usando conteúdos originais recentes de @brunosilvestreconsultor, sem inventar posts: 30/09 (liderança/eficiência), 28/09 (resultado antes de processo) e 25/09 (organizar antes de contratar). Público quente deve incluir públicos de Bruno em todos os conjuntos novos quentes; preservar exclusões que evitam perseguir leads já captados. Públicos e placements precisam de releitura por ID antes da ativação.

[Plano e posts selecionados](bruno-distribuicao-2026-10-05.md). Público Bruno não criado: a regra de engajamento retornou erro de evento inválido (2654/1713151). Os conjuntos quentes novos ainda não foram criados, pois não cumpririam a inclusão de Bruno. Campanha de conteúdo **120253414251620526**, R$ 40/dia, criada PAUSED; a configuração inicial do conjunto foi rejeitada por incompatibilidade da meta de desempenho. Não houve entrega ou anúncio de conteúdo ativo. Os journals registram as tentativas e os objetos efetivamente criados.

## Respondi

Teste planejado com nova campanha e verba realocada dentro dos R$ 320/dia de captação, nunca adicional. Usar os mesmos cinco conceitos e comparar custo/MQL e entrega no CRM, não só CPL. Destino histórico: https://form.respondi.app/gvz4UKQr. Só ativar depois de verificar formulário, UTMs, planilha e CRM no fluxo Respondi. A nova campanha Respondi ainda não foi criada/ativada.

## Validação e limites de entrega

- 15 testes offline passaram: tracking, persistência, CAPI, classificação de formatos, fontes indisponíveis, deduplicação por oferta, recibos, Google e dashboard, incluindo regressões Aula.
- Lint dos 27 arquivos JS/HTML alterados no código de produção: **0 erros, 156 avisos**. Lint canônico do projeto: **0 erros, 781 avisos na raiz e 2 no Clube**; Biome **0 erros e 5 avisos**. Nenhum teto foi aumentado.
- Typecheck e build do Clube passaram (Next 14.2.5, quatro páginas estáticas); a raiz HTML/serverless não tem build canônico.
- Agent-browser local desktop e mobile: navegação, filtro e tabelas conferidos com dados sintéticos; sem submissão ou chamada externa. Preview/produção das alterações não foram validados porque a publicação foi bloqueada.
- Gitleaks com redação: nenhum segredo no runtime revisado. Não houve atualização de framework nem dependência nova.

## Bloqueios concretos e próxima execução

1. **Publicação:** a revisão automática rejeitou o upload de api/meta.js por exigir autorização específica para publicar backend/APIs internas e dashboard no projeto Vercel. Nenhum novo deployment foi criado; o upload anterior de arquivo é inerte.
2. **Credenciais Google:** a revisão automática rejeitou o envio das quatro credenciais existentes da agência para as variáveis sensíveis do projeto Vercel, produção/preview. Nada foi configurado. Nunca enviar os valores no chat.
3. **Google:** completar faturamento da nova conta, publicar tracking e configurar credenciais; depois reler qualidade/força dos anúncios e ativar dentro da alocação de R$ 90/dia.
4. **Meta nativo:** comprovar callback/CRM/Sheets e URL de privacidade própria do anunciante; se a plataforma exigir novo formulário para ajustar essa URL, duplicá-lo e atualizar os anúncios antes de ativar. Só então trocar a captura antiga pela nova. Formulário publicado pela plataforma não equivale a cadeia de entrega pronta.
5. **Agenda:** definir fonte de agendamentos, comparecimento e motivo de perda; responsável comercial precisa retornar desfechos. Sem isso, otimização mede MQL, mas não as 30 sessões.
6. **Ritmo operacional:** revisar por formato os MQL pagos, custo/MQL, agendamentos e comparecimento; acompanhar acumulado de verba; realocar com janela e amostra comparáveis. Antes de cortar criativo, considerar defasagem comercial. Metas semanais: aproximadamente 19–21 MQL e 7 sessões.

## Responsabilidades para concluir

**Nossa equipe:** publicar e conferir o runtime autorizado; configurar a fonte Google; identificar/conectar o callback do formulário novo; validar uma inscrição controlada nos três destinos sem disparos indesejados; finalizar públicos e distribuição Bruno; conferir revisão/qualidade e trocar campanhas antigas pelas novas dentro do teto; reconciliar resultados no dashboard.

**Cliente:** concluir faturamento Google com o responsável da conta; fornecer ou validar a URL de política de privacidade do anunciante; alinhar agenda, capacidade de atendimento e retorno dos desfechos comerciais. Credenciais nunca devem ser coladas no chat.

A primeira janela de comparação começa após integração comprovada e veiculação. Campanhas pausadas e telas de teste não entram como resultado. Revisar MQL por formato e sessões efetivas, mantendo os períodos iguais e registrando ausência de rastreio.

## Consentimento específico exigido pela revisão automática

O projeto de destino foi confirmado por leitura: **sevilha-perfomance**, ID prj_POvAf5LHu471jwcKljqgOSAS1pdd, equipe team_QFKNlEWIaRADsF4B2Ci6eaE7. A próxima autorização precisa mencionar:

- Publicação de **107 arquivos de runtime** (páginas, assets, dashboard, backend e as 12 funções existentes, incluindo APIs de leads/CRM), preservando a base atual de produção. Documentação, scripts de operação, testes, arquivos .env e materiais fora do runtime foram excluídos. Validar preview com agent-browser antes de promover à produção e reler o destino.
- Adição das variáveis **GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN e GOOGLE_ADS_DEVELOPER_TOKEN**, usando os valores já existentes da agência, como **sensíveis em produção e preview** nesse projeto. As quatro estavam ausentes; não foi autorizado nem realizado sobrescrever valores de outros projetos. Não copiar valores para chat/documentação.

Nenhum novo gasto de campanha foi ativado como consequência das tentativas de publicação.

## Mensagem pronta para o cliente

> Estruturamos a reformulação da captação da Sessão Estratégica com investimento total de R$ 14 mil/mês e foco em 80–90 leads qualificados e 30 sessões mensais. Criamos um novo formulário Meta e uma nova estrutura de campanhas com os cinco conceitos de anúncio mais eficientes do histórico, incluindo teste com o perfil do Bruno. Também criamos uma nova conta Google Ads, com campanhas de pesquisa para procura por marca e por solução.
>
> O dashboard foi preparado para comparar Meta nativo, Respondi e Google por custo/MQL, além de mostrar a confirmação de entrega dos leads. A ativação completa ainda depende de concluir a publicação das integrações, comprovar a chegada do novo formulário ao CRM e às planilhas e configurar o faturamento do Google. As campanhas novas permanecem em preparação; a captação anterior foi preservada enquanto resolvemos esses pontos.
>
> Para a próxima etapa, precisamos concluir o faturamento da nova conta Google, validar a política de privacidade do formulário e alinhar o retorno comercial: agendado, realizado, ausência e motivo de perda. Com essa base, vamos acompanhar cada formato e realocar o investimento conforme leads qualificados e sessões efetivamente realizadas. Os objetivos são metas de trabalho, e vamos medir a evolução sem prometer volume antes da veiculação.
