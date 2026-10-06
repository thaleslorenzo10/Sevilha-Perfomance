# Sessão Estratégica — execução, metas e próximos passos

Atualização: noite de 05/10/2026, horário de São Paulo. Este relatório distingue configuração criada, implementação local, publicação e veiculação. A autorização final permitiu publicar o runtime e ativar campanhas novas. O runtime está publicado em produção READY; conteúdo Bruno está configurado ativo, com os três anúncios ACTIVE/ACTIVE no readback final de 23h41min42s BRT. Captação nova e Google permanecem pausados pelos bloqueios concretos abaixo.

## Objetivo e orçamento

Meta comercial: **30 sessões estratégicas/mês**, aproximadamente **7/semana**, com **80–90 MQL/mês**. MQL mantém o critério existente de escritório com **10 ou mais colaboradores**. Sessão agendada e realizada precisam de fonte de agenda; lead e negócio no CRM não substituem sessão.

Orçamento total exclusivo de SE: **R$ 14.000/mês**, incluindo captação, conteúdo e Google. Custo combinado de referência: R$ 155,56–175/MQL e R$ 466,67/sessão. Para 30 sessões, 33,3–37,5% dos MQL precisam chegar à sessão; isso é requisito do funil, não taxa já alcançada.

| Frente | Alocação planejada por dia | Situação |
|---|---:|---|
| Meta captação fria/quente, novas campanhas | R$ 320 | Preparação pausada; depende da entrega de leads |
| Conteúdo novo de Bruno, somente Instagram | R$ 40 | Campanha/conjunto ACTIVE; três anúncios ACTIVE/ACTIVE; entrega não comprovada |
| Google Search genérico | R$ 70 | Criada, pausada |
| Google Search de marca | R$ 20 | Criada, pausada |
| Total | R$ 450 | Nominal até R$ 13.896: Meta 31 dias + Google 30,4 dias |

A captação Meta anterior foi reduzida para **R$ 410/dia** antes da ativação de conteúdo Bruno de **R$ 40/dia**, totalizando **R$ 450/dia configurados**. Os R$ 320 de captação nova e R$ 90 de Google permanecem pausados; sua futura ativação exige reduzir/substituir a captação anterior para manter o teto. ACTIVE/ACTIVE não comprova alcance, gasto ou leads dos anúncios de conteúdo. Limite diário nominal não é trava financeira mensal; controlar gasto acumulado de SE, sem limitar outras ofertas da conta.

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

Implementação publicada a partir da branch **codex/se-captacao-google-20261005**, source **cb8079e**, preservando mudanças recentes de Aula e Café. Produção **dpl_EBqu1eMmpKQKjYmQhNBWSG8Ye2yX**, estado **READY**, alias https://sevilha-perfomance.vercel.app. As quatro credenciais Google existentes da agência foram configuradas como sensíveis em produção e preview, com autorização resolvida; valores não integram este relatório. A projeção pública retorna agregados e erro genérico, sem dados pessoais de contatos.

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

[Plano e posts selecionados](bruno-distribuicao-2026-10-05.md). Público Bruno não criado: a regra de engajamento retornou erro de evento inválido (2654/1713151). Os conjuntos quentes novos ainda não foram criados, pois não cumpririam a inclusão de Bruno. Campanha de conteúdo válida **120253414357780526**, conjunto **120253414358070526**, ambos **ACTIVE**, R$ 40/dia. Os três anúncios estão **ACTIVE/ACTIVE** na leitura final de 23h41min42s BRT; alcance, gasto e leads ainda não comprovados. A campanha inicial **120253414251620526** continua **PAUSED**, vazia, após a incompatibilidade de meta de desempenho. Os journals registram os objetos criados e os estados relidos.

## Respondi

Teste planejado com nova campanha e verba realocada dentro dos R$ 320/dia de captação, nunca adicional. Usar os mesmos cinco conceitos e comparar custo/MQL e entrega no CRM, não só CPL. Destino histórico: https://form.respondi.app/gvz4UKQr. Só ativar depois de verificar formulário, UTMs, planilha e CRM no fluxo Respondi. A nova campanha Respondi ainda não foi criada/ativada.

## Validação e limites de entrega

- 16 testes offline passaram: tracking, persistência, CAPI, classificação de formatos, fontes indisponíveis, deduplicação por oferta, recibos, Google e dashboard, incluindo regressões Aula.
- Lint dos 34 arquivos JS/HTML alterados no código de produção: **0 erros, 170 avisos**. Lint canônico do projeto: **0 erros, 781 avisos na raiz e 2 no Clube**; Biome **0 erros e 5 avisos**. Nenhum teto foi aumentado.
- Typecheck e build do Clube passaram (Next 14.2.5, quatro páginas estáticas); a raiz HTML/serverless não tem build canônico.
- Agent-browser local desktop e mobile: navegação, filtro e tabelas conferidos com dados sintéticos; sem submissão ou chamada externa. Preview READY **dpl_FzsX5LXDrgH7dii7VceH9DT6xNH5** está protegido por SSO, que impede validar o app nesse destino. A revisão automática rejeitou um link temporário de bypass; nenhum bypass foi realizado. Validação HTTP da produção concluída; verificação visual em produção concluída em desktop/mobile com dados reais, com limitação de verificação do filtro de sete dias.
- Gitleaks com redação: nenhum segredo no runtime revisado. Não houve atualização de framework nem dependência nova.

## Bloqueios concretos e próxima execução

1. **Publicação:** concluída em produção READY, source cb8079e. Leitura pública confirmou `/dashboard`, `/assets/tracking.js`, `/assets/js/dash/aquisicao-se.js`, `/mentoria`, `/aula-gestao-operacional` e `/cafe-com-sevilha` com HTTP 200 e SHA1 exato da fonte; `/api/leads` GET retornou 405 esperado. A verificação visual por browser está concluída, com limitação de verificação do filtro de sete dias.
2. **Credenciais Google:** quatro variáveis configuradas sensíveis em produção e preview; autorização resolvida. Não existe pendência de configuração dessas credenciais.
3. **Google:** completar faturamento da nova conta (leitura retornou lista vazia), reler força dos anúncios ainda PENDING e validar conversões antes de ativar dentro da alocação de R$ 90/dia. `/api/google-ads` público retornou disponível, conta 1316487378, duas campanhas PAUSED e gasto zero em 1–5/out.
4. **Meta nativo:** comprovar callback/CRM/Sheets e URL de privacidade própria do anunciante; se a plataforma exigir novo formulário para ajustar essa URL, duplicá-lo e atualizar os anúncios antes de ativar. Só então trocar a captura antiga pela nova. Formulário publicado pela plataforma não equivale a cadeia de entrega pronta.
5. **Agenda:** definir fonte de agendamentos, comparecimento e motivo de perda; responsável comercial precisa retornar desfechos. Sem isso, otimização mede MQL, mas não as 30 sessões.
6. **Ritmo operacional:** revisar por formato os MQL pagos, custo/MQL, agendamentos e comparecimento; acompanhar acumulado de verba; realocar com janela e amostra comparáveis. Antes de cortar criativo, considerar defasagem comercial. Metas semanais: aproximadamente 19–21 MQL e 7 sessões.

## Responsabilidades para concluir

**Nossa equipe:** identificar/conectar o callback do formulário novo; validar uma inscrição controlada nos três destinos sem disparos indesejados; finalizar públicos quentes de Bruno; conferir revisão/qualidade e trocar campanhas antigas pelas novas dentro do teto; reconciliar resultados no dashboard.

**Cliente:** concluir faturamento Google com o responsável da conta; fornecer ou validar a URL de política de privacidade do anunciante; alinhar agenda, capacidade de atendimento e retorno dos desfechos comerciais. Credenciais nunca devem ser coladas no chat.

A primeira janela de comparação começa após integração comprovada e veiculação. Campanhas pausadas e telas de teste não entram como resultado. Revisar MQL por formato e sessões efetivas, mantendo os períodos iguais e registrando ausência de rastreio.

## Publicação e readback

Produção READY **dpl_EBqu1eMmpKQKjYmQhNBWSG8Ye2yX**, alias https://sevilha-perfomance.vercel.app, source **cb8079e**. Preview READY **dpl_FzsX5LXDrgH7dii7VceH9DT6xNH5** permanece protegido por SSO. A revisão automática rejeitou a criação de link temporário para bypass; nenhum bypass foi feito. Esse limite não impede conferir o destino público de produção.

[Registro de produção](sessao-estrategica-producao-readback-2026-10-05.json): `/api/leads-unificados` retornou 200 com agregados de Forms, Respondi, Supabase e CAFE, sem erro de fonte; `/api/rd-stats` retornou 200. A resposta pública não contém campos email, phone, telefone ou contacts. Isso valida disponibilidade e projeção agregada, não comprova callback nem entrega de um novo lead nativo em CRM/Sheets. Browser de produção concluído: APIs e Chart CDN/fontes responderam 200, console vazio e sem overflow mobile; tabelas têm rolagem. No filtro de sete dias, a espera usou o seletor de SE enquanto a aba Formatos estava aberta e expirou; o DOM final mostrou o quadro preenchido (31/31). Essa captura não certifica o filtro nem o intervalo temporal exibido, e não permite concluir que houve falha ou lentidão do produto. Favicon 404 preexistente, sem erro JavaScript.

## Mensagem pronta para o cliente

> Publicamos as integrações e o dashboard da Sessão Estratégica, com investimento total planejado de R$ 14 mil/mês. A leitura pública confirmou as páginas e APIs esperadas, incluindo dados agregados sem informações pessoais. Conferimos o dashboard e a página da sessão em desktop e celular com dados reais. O quadro final ficou preenchido; a captura do filtro de sete dias tem limitação de verificação do intervalo, registrada no relatório.
>
> A captação anterior está configurada em R$ 410/dia e o conteúdo de Bruno em R$ 40/dia, dentro da soma de R$ 450/dia. A campanha e o conjunto de conteúdo estão ativos, e os três anúncios foram confirmados ativos pela plataforma; ainda não temos comprovação de alcance, gasto ou leads dessa frente. A nova captação Meta de R$ 320/dia e as duas campanhas Google de R$ 70 e R$ 20/dia permanecem pausadas.
>
> Para ativar as próximas frentes, precisamos comprovar o callback do novo formulário Meta e sua chegada ao CRM e às planilhas, validar a política de privacidade própria do anunciante e concluir o faturamento Google. A força dos anúncios Google ainda está pendente. Os novos públicos quentes de Bruno não foram criados e Respondi continua apenas planejado.
>
> A meta de trabalho é 80–90 leads qualificados e 30 sessões/mês, sem promessa de volume. O próximo passo é concluir esses pontos, alinhar os registros de agenda e comparecimento e substituir a verba antiga gradualmente, mantendo o teto total. O teste controlado autorizado deve comprovar a chegada do novo formulário aos destinos antes da ativação da captação nova.

**Readback Meta final, 23h41min42s BRT:** os quatro controladores de orçamento estão ACTIVE/ACTIVE, com 12059 + 13265 + 15676 + 4000 = 45000 centavos/dia. Os primeiros três somam R$ 410/dia de captação anterior; o quarto corresponde a R$ 40/dia de conteúdo. Três anúncios de conteúdo ACTIVE/ACTIVE; estado efetivo não comprova entrega. Agent-browser concluiu a validação pública de produção em desktop/mobile, com limitação de verificação do filtro de sete dias.

## Evidência visual de produção

Cinco capturas reais, sem fixtures:

- [Formatos desktop](evidencias/sessao-estrategica-dashboard-2026-10-05-producao-formatos-desktop.png).
- [Sessão Estratégica desktop](evidencias/sessao-estrategica-dashboard-2026-10-05-producao-se-desktop.png).
- [Sessão Estratégica mobile](evidencias/sessao-estrategica-dashboard-2026-10-05-producao-se-mobile.png).
- [Mentoria mobile](evidencias/sessao-estrategica-dashboard-2026-10-05-producao-mentoria-mobile.png).
- [Mentoria desktop](evidencias/sessao-estrategica-dashboard-2026-10-05-producao-mentoria-desktop.png).

O quadro de SE mostrou cinco linhas e sete colunas; Google mostrou duas campanhas pausadas com gasto zero. Mentoria foi verificada sem submissão, com `internal=1` e sem envio de analytics Meta/Google; quatro âncoras conferidas. Na janela 06/09–05/10, Meta nativo mostrou 109 contatos, 34 MQL, gasto R$ 6.325,31 e custo/MQL R$ 186,04. Os demais formatos não são comparáveis nessa leitura; não foi declarado vencedor.
