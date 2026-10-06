# Revisão independente — Sessão Estratégica (05/10/2026)

**Resultado: estrutura pausada confirmada; ativação ainda bloqueada.** Esta revisão usou leitura independente via Graph API e Google Ads API, comparação dos contratos do formulário e leitura dos parsers existentes. Não houve mutação nesta revisão nem repetição dos testes de frontend.

## Revisão do diff local de medição

**APROVADO para deploy do diff revisado.** Não identifiquei defeito bloqueador no escopo: api/leads.js, assets/tracking.js, mentoria/index.html, mentoria-2/index.html e os dois verificadores offline novos. A aprovação de código não remove os bloqueios externos de ativação.

- saveToSupabase agora retorna booleano em todos os caminhos: segredo ausente, resposta HTTP sem sucesso ou exceção retornam false; somente POST com sucesso retorna true. O handler devolve `persisted` tanto no caminho normal quanto na exceção CAPI, sem trocar os payloads nem a ordem das integrações existentes.
- O Google exige `ok === true` e `persisted === true`. HTTP 200 com persisted false, JSON inválido, falha HTTP/retry ou chamada legada SP_fireLeadEvents sem prova de persistência não emitem conversão Google. onSuccess continua com o comportamento existente; exceção de gtag é capturada e não bloqueia inscrição.
- Os únicos parâmetros dos eventos Google são send_to e transaction_id. Nome/e-mail/telefone não são enviados; enhanced conversions estão desativadas e config remove query/referrer. transaction_id usa o event_id existente e diferencia duplicação por ação Lead/MQL.
- Inicialização e conversões Google estão restritas a /mentoria e /mentoria-2, com barra final normalizada e o filtro interno existente. O download espera dois requestAnimationFrame, após primeiro paint. No clone da base de produção, os dois HTML usam tracking.js?v=9.
- qualificadoGoogle reproduz a decisão 10+ de lib/porte.js, incluindo faixa com limite inferior, slug, acento, número direto, teto indefinido e ruído de planilha. Não adiciona elegibilidade de cargo.
- Os quatro anchors adicionados à /mentoria identificam seções reais; não criam oferta/página extra nem alteram o formulário. O conteúdo continua sessão online gratuita de 45 minutos com Bruno.
- Li os verificadores sem repeti-los: o de tracking exercita o JS real em VM, compara critérios com o helper canônico e cobre persisted false, falhas, rotas, internos, bloqueio gtag e dedupe; o da API exercita o handler real nos quatro retornos de persistência e verifica Meta preservado. Resultados e lint/browser foram reportados pelo worker; esta revisão não apresenta esses testes como execução independente.
- Antes de ativar, o coordenador ainda deve verificar em produção o recebimento do tag/labels e atribuição do clique Google via gclid/auto-tagging; mocks de gtag provam chamada, não recebimento pela plataforma.

## Base de publicação reconciliada

- A base de produção é o commit fc2529edc3058b0dc21b5630cd8626091328f414, branch chore/aula-data. O coordenador comparou os 125/125 hashes de fonte visíveis do deployment dpl_AT7R9o3YjXh2j5mpWxhdwsanim9w com essa base. O retorno MCP é truncado; esse teste comprova todos os hashes disponíveis, sem alegar leitura integral das árvores omitidas.
- Clone de publicação: /private/tmp/sevilha-search-livebase-20261005. Revisão independente do diff contra fc2529: somente api/leads.js, assets/tracking.js e os dois HTML recebem alterações de produção; dois verificadores ficam em scripts/, excluído pelo .vercelignore. Nenhum payload CRM/Meta, integração da Aula/Café, pageview ou microevento dessas ofertas foi alterado. O novo guard GOOGLE_SE é separado de INSTRUMENTADA para preservar o conjunto maior de páginas da produção.
- Manifesto completo deve nascer deste clone, com exclusões scripts/, .git, .vercel, .env* e .DS_Store. Manifesto antigo baseado no HEAD foi descartado. Publicação e validação no destino ainda pendentes; nenhum upload foi realizado nesta etapa de revisão.

## Google Search

- Conta nova **1316487378**, Sevilha Performance, sob Lorenzo **3844411205**, BRL e America/Sao_Paulo. Leitura e escrita autorizadas foram confirmadas; a conta contábil antiga não recebeu mudanças.
- Campanha genérica **24328953730** permanece **PAUSED**, agora **R$70/dia**. Marca **24317774874** criada/readback PAUSED com **R$20/dia**. TotalGoogleR$90/dia dentro da mesma reserva; Maximize Clicks com teto de CPC **R$ 5,50**, somente Google Search, sem parceiros/display, Brasil por presença e idioma português.
- Dois RSA com 15 títulos/4 descrições, sem pin; seis keywords exact/phrase, quatro sitelinks e cinco destaques associados. Sufixos reais nos dois grupos incluem os quatro campos UTM e keyword.
- **SE Lead 7823726107 é secondary**; **SE MQL 7823726110 é primary**. Labels em assets/tracking.js correspondem exatamente ao readback. O helper de MQL mantém o critério existente de 10+ colaboradores, sem novo filtro de cargo; browser faz a mesma classificação do lib/porte.js.
- Evento Google no browser exige resposta API `ok === true && persisted === true`, além de página instrumentada, evento identificável e visita não interna. Não conta falha de persistência como Lead/MQL Google.
- Não há billing_setup na conta nova. Ambos os anúncios têm **adStrength PENDING**, aprovação **UNKNOWN** e análise em andamento. Custo, impressões e cliques são zero.
- Os quatro IDs de seção estão agora presentes localmente em /mentoria: como-funciona, para-quem, bruno-silvestre e agendar. Publicação/readback e validação visual permanecem responsabilidade do coordenador; presença local não confirma produção.

## Meta: formulário e identidade

- Leitura Graph independente confirmou o formulário **1776305790272614**, ACTIVE, `is_optimized_for_quality=true`, página **131476997004991**. ACTIVE do formulário não significa campanha em entrega.
- Seis campos em ordem: porte; cargo; nome do escritório; full_name; email; phone_number. Perguntas e opções preservam o contrato histórico. O registro exportado continua com 23 colunas, conforme lib/planilha-leads.js e api/eventos-qualificados.js.
- Os parsers encontram porte/cargo/e-mail pelo formato da resposta; nome fica antes de e-mail e o telefone continua campo Meta phone_number. Esta comparação confirma compatibilidade estrutural, mas **não prova chegada do novo formulário à planilha/RD CRM**. O documento de staging declara native_callback_verified=false e native_to_sheet_crm_verified=false; essa prova ainda é obrigatória antes de ativar.
- Instagram Bruno **17841446823336862**, username brunosilvestreconsultor, consta entre contas disponíveis do anunciante; a página Bruno **106292094924513** também liga esse mesmo Instagram. O anúncio rank5 com identidade Bruno foi aceito e relido com esse instagram_user_id.
- Os dez anúncios, cinco Sevilha e cinco Bruno, apontam para o formulário novo em todas as referências de CTA disponíveis no readback e têm a UTM obrigatória exata. Status configurado PAUSED; effective_status IN_PROCESS significa pendência de análise, não ativação.

## Orçamento e conceitos históricos

- Campanha nova Meta **120253413819760526** confirmada PAUSED/effective PAUSED, com orçamento **CBO R$ 360/dia**. Adsets Sevilha **120253413819880526** e Bruno **120253413820840526** confirmados PAUSED; sem budgets ABO próprios. Não somar R$ 360 para cada conjunto.
- As campanhas históricas continuam fora do escopo desta revisão de criação. Seu agregado anterior R$ 450/dia não deve ser somado à estrutura nova após ativação: antes de trocar a entrega, reconciliar controladores ativos CBO/ABO e custo acumulado do mês dentro de R$ 14.000.
- O ranking seleciona cinco conceitos por anúncio original e custo por MQL de contatos persistidos, alinhando gasto à cobertura FORMS. Não usa CPL de plataforma como MQL nem compara gasto lifetime com contatos de período menor. AD21, AD16, IA, AD29 e Vicente são assets distintos.
- **Execução final confirmada:** dez anúncios foram relidos independentemente por ID após a correção image_url/image_hash; todos estão configurados PAUSED, com formulário novo, UTM exata e Instagram correspondente. Oito vídeos dos ranks 1–4 mantêm os IDs fonte. No criativo adaptável Vicente, o Meta devolveu quatro IDs novos: cada um foi lido e conserva os títulos feed/storie e a duração 74,442 s da fonte. As regras de personalização por placement e os nomes dos labels foram comparados ao payload e estão preservados. Essa evidência sustenta reutilização/cópia automática; o conteúdo audiovisual não foi assistido novamente nesta revisão.

## Pendências para aprovação de entrega

1. Concluído: cinco conceitos nas duas identidades, dez anúncios/CTAs/UTMs/identidade/status conferidos por ID. A revisão Meta/policy permanece pendente.
2. Provar entrada do formulário nativo novo no fluxo e persistência/CRM sem envio a clientes; preservar deduplicação e status das integrações.
3. Resolver política de privacidade própria do anunciante: URL Facebook é referência de staging, não aprovação de privacidade da operação.
4. Publicar/verificar tag Google e os quatro destinos reais, configurar faturamento da conta nova e aguardar/iterar ad strength para EXCELLENT.
   Publicação bloqueada: upload oficial dos quatro arquivos concluído, mas create_deployment foi rejeitado duas vezes pela revisão automática, inclusive alternativa runtime105 sem segredos/docs/configs. Nenhum preview foi criado. Detalhes em sessao-estrategica-google-validacao-2026-10-05.md; precisa aprovação específica do usuário para o escopo de runtime/publicação apontado pela revisão.
5. Reconciliar orçamento acumulado e controladores antes de qualquer ativação; não ativar a campanha LP Meta.

Fontes: Graph GET autenticado de campaign/adsets/ads/form desta estrutura em 05/10/2026; Google Ads API v24 validateOnly e readbacks por ID; docs/sessao-estrategica-google-preflight-2026-10-05.json; docs/sessao-estrategica-ranking-historico-2026-10-05.md; docs/sessao-estrategica-form-bruno-staging-2026-10-05.json; lib/porte.js; lib/planilha-leads.js; api/eventos-qualificados.js; assets/tracking.js.

## Comparação por formato e garantia de ingestão — diagnóstico independente

Escopo novo em andamento no clone de produção. Esta seção registra contratos anteriores à implementação dos workers; não declara defeitos corrigidos nem resultados de testes que não foram revistos.

- /api/leads-unificados lê FORMS, RESPONDI e Supabase; a classificação binária FORMS/LP não separa Respondi, formulário próprio e Google Search. Origem da aquisição e mecanismo de formulário são dimensões diferentes: Google chega pelo formulário próprio. Campanha/UTM/gclid devem sustentar a classificação e casos incertos precisam permanecer explícitos.
- O select Supabase anterior não carrega gclid/event_id/utm_term. O export nativo tem IDs nas colunas2/4/6/8, mas o parser anterior só preserva nomes; Respondi deixa adset vazio. A junção por nome no ranking pode colidir entre campanhas/canais, e o primeiro formato de um agrupamento não prova todos os registros.
- /api/meta usa insights, que omitem novas campanhas pausadas sem entrega. Um catálogo de recursos pode mostrar essas campanhas com zero histórico conhecido, separado da disponibilidade de métricas no período. Não existe endpointGoogle de gasto no runtime anterior: readback administrativo datado da conta1316487378 confirma ambas campanhaspausadas, mas não substitui integração futura de custo. Erro/ausência de fonte não é zero.
- A faixa executiva anterior divide gasto totalMeta por todos os leads unificados; após Google isso mistura numerador e denominador. Comparações devem usar mesmo canal/oferta/período/cobertura, preservar semrastreio e indicar custo indisponível. Qualificação continua helper canônico10+, sem somar Lead e MQL como pessoas distintas.
- Dedupe anterior usa contato global antes do recorte e da oferta. Pode eliminar uma Sessão Estratégica por contato já visto em Aula/Café; o indicador global de pessoas únicas não equivale ao funil individual de cada oferta.
- Browser captura5UTMs e gclid da URL/sessionStorage, preenche formulário e servidor grava Supabase. RDMarketing recebe5UTMs; CRM recebe4UTMs em customfields, mas a origemdeal tem fallbackFacebook fixo. Um leadGoogle não deve ser rotuladoFacebook por esse fallback. Gclid não tem cookie próprio na implementação anterior: persistência é URL/sessionStorage, sem promessa multissessão.
- persistedtrue da API confirma Supabase, não entregaSheets/RDCRM. Os sends anteriores não devolvem estadosduráveis; garantir ingestão exige status verificável e dedupe/retry que não duplica contato, planilha oudeal. Nenhum leadreal foi enviado nesta revisão.
- Produção continua bloqueada pelas duas rejeições de create_deployment já registradas. Novo escopo de dashboard não representa aprovação para repetir publicação; aguardar aprovaçãofinal explícita do usuário. Aula/Café e seus endpoints/fluxos permanecem requisitos de preservação.

Fontes locais desta leitura: lib/leads-fontes.js, lib/leads-unificados.js, lib/planilha-leads.js, lib/posicionamento.js, lib/meta.js, lib/sessao-estrategica.js, api/meta.js, api/leads.js, assets/tracking.js, assets/js/dash/api.js e assets/js/dash/cruzamento.js, na basefc2529 com overlaysc8aa709.

## Google click attribution — limite da evidência

O config sanitiza page_location para origin+pathname e zera page_referrer; não muda window.location.search. Gclid permanece na URL/sessionStorage, payload /api/leads e Supabase. Os eventosGoogle enviam somente send_to/transaction_id, sem contato do formulário.

A [documentação oficial de Conversion Linker](https://support.google.com/tagmanager/answer/7549390?hl=en) explica que Google tag já carrega a vinculação de clique, detecta informação da URLlanding e mantém cookies _gcl_* / armazenamento _gcl_ls. A [orientação Google Ads](https://support.google.com/google-ads/answer/7521212?hl=en) exige auto-tagging e preservaçãoGCLID até o destino. Não encontrei nessas fontes a precedência explícita do override page_location sobre a leituraURL do linker. Portanto, continuar lendo a URLdocumento é uma inferência, não validação da atribuição real nem prova de defeito.

Não foi adicionado novo tag/dependência. Cookie _gcl_aw e recebimento por Google Ads devem ser conferidos pelo coordenador em navegador/TagAssistant após publicação autorizada. Mocks e persistência do gclid no nosso banco não provam recebimentoAds; publicação permanece bloqueada.


## Revisão final independente — formatos e recibos (clone de produção)

**Código revisado sem defeito bloqueador identificado no escopo lido; entrega operacional parcial.** A leitura foi feita no clone /private/tmp/sevilha-search-livebase-20261005 contra c8aa709, preservando a base fc2529. Não executei novamente os testes reportados pelos workers, não escrevi nos arquivos deles e não enviei lead real.

- Backend: api/leads.js, lib/planilha-leads.js, lib/leads-unificados.js, lib/leads-fontes.js, lib/sheets-write.js; tracking e migração preparados. O parser conserva IDs nativos como strings e marca números inseguros, sem arredondar IDs Meta. Respondi conserva utm_medium e não inventa campanha quando falta UTM. Gclid, termo e event_id permanecem disponíveis internamente; o endpoint agregado não retorna contatos.
- Dedupe usa contato dentro de cada oferta, inclusive união transitiva por e-mail/telefone. Uma inscrição anterior em Aula/Café não remove SE. O total unificado passa a representar contatos por oferta, podendo contar a mesma pessoa em ofertas diferentes; não deve ser descrito como pessoas únicas globais. MQL continua porte 10+ canônico.
- As cinco rotas são META_FORMS, RESPONDI, GOOGLE_SEARCH, META_SITE e SITE_SEM_ATRIBUICAO. Pago, orgânico e sem atribuição ficam distintos. Fonte indisponível produz null, não zero. Período e cobertura completa da base paga são requisitos de reconciliação; a comparação não declara vencedor estatístico.
- Google só emite quando google_conversion_ready é true: Supabase aceito e relido por event_id; planilha com resposta de escrita contendo range/linhas; CRM com deal relido e contato relacionado; recibos duráveis relidos após PATCH. A prova da planilha é recibo do fornecedor, sem leitura independente de células. RD Marketing aceito não é marcado verificado. HTTP 200 com erro do fornecedor, link de contato falho e falha de recibo não autorizam conversão Google. Meta conserva seu caminho existente.
- A origem CRM Google usa o ID 68d152fa949ae20022df32c5, “Google e Outros Buscadores”, comprovado pelo worker em GET de metadados e aprovado pelo coordenador. Não troca a origem histórica Meta nem utiliza “Busca Orgânica”.
- A migração supabase/migrations/20261005_sevilha_leads_integracoes.sql foi apenas preparada. Ausência da coluna produz fallback de SELECT e schema_pendente; o formulário segue e Google falha fechado. Logo, este diff não prova ingestão durável ativa em produção. Leituras adicionais de Supabase/CRM afetam latência, embora as falhas sejam toleradas e não alterem os destinos/payloads das outras ofertas.
- UI: aquisicao-se.js, formatos.js, grupo.js, tabelas.js e dashboard.html, além das correções de cobertura em cruzamento.js, geral.js, origem.js, graficos.js e executivo.js. Sem cobertura, custos SE/global deixam de exibir zero favorável; origem/fontes também recebem a proteção. Gasto legado é rotulado Meta. Junções antigas por nome continuam nas tabelas históricas; a comparação nova rejeita IDs imprecisos, nomes ambíguos e formatos contraditórios.
- Li os novos verificadores offline: IDs grandes, cinco rotas, fonte503 versus schema ausente, dedupe entre ofertas e contato intermediário, recibos/JSONB reordenado, erros200, contato existente e falha de planilha. Worker backend reportou dez verificadores offline passando; UI reportou VM isolada e cruzamento legado passando. Estes resultados são atribuídos aos autores, não repetidos nesta revisão.

**Pendências materiais:** catálogo administrativo das campanhas novas pausadas com zero ainda não aparece no contrato revisado: por_campanha_formato_se deriva de leads e insights Meta omite campanhas sem entrega. As cinco linhas de formato não substituem todas as campanhas individuais. A estrutura Google nova segue PAUSED, R$70 genérico + R$20 marca, sem faturamento e sem comprovação do tag em produção. Integração de gasto Google continua indisponível; nativo Meta continua sem callback/planilha/CRM comprovados. Sessões agendadas/realizadas são indisponíveis até fonte de agenda verificada. Migração, publicação autorizada e releitura dos destinos permanecem necessárias antes de chamar o fluxo de garantido.

As duas rejeições automáticas de create_deployment continuam vigentes. Não houve nova tentativa, preview nem publicação; aguarda-se aprovação final explícita do usuário sobre o escopo apontado pela revisão.


## Leitura Google Ads do painel — implementação local adicional

Endpoint público previsto /api/google-ads?since=YYYY-MM-DD&until=YYYY-MM-DD. A implementação usa lib/google-ads.js e dispatch antecipado modo=google em api/meta.js; o rewrite em vercel.json mantém as 12 funções existentes. O repositório documenta essa restrição para Hobby, mas o plano atual Vercel não foi confirmado nesta etapa. Não foi criado um 13º endpoint serverless nem alterado plano.

- Cliente fixo 1316487378, manager 3844411205 e REST v24. OAuth e headers ficam no servidor. Não existe parâmetro de cliente livre. Usa três consultas SearchStream: metadados de conta; catálogo Search não removido; custo por campanha na janela. Todos os batches são lidos. Metadados devem confirmar BRL e America/Sao_Paulo antes de qualquer gasto ser disponibilizado.
- Contrato google: campanhas com id string, nome, status, grupo SE, formato SEARCH e spend; período since/until, spend total, moeda/fuso, fonte e status. Zero só após conta/catalogo/gasto saudáveis; erroOAuth/API, stream malformado, custo ausente ou moeda/fuso incompatíveis devolvem503 e gasto/campanhas null. Catálogo separado mantém PAUSED sem entrega. Não lê conversões Ads para definir MQL.
- Datas reais de calendário, sem timestamp ou entrada GAQL arbitrária, limitadas a400dias e since<=until. Custo em micros é validado como inteiro seguro e convertido em BRL. Nunca devolve corpo/erro bruto do fornecedor, token, headers ou contato.
- Teste novo scripts/test-google-ads.js executado em VM offline: sucesso/catálogo vazio/zero confirmado, micros/IDs grandes, ausência de credencial, falhasOAuth/API/malformed, conta/moeda/fuso incompatíveis, ausência de custo, datas inválidas/injeção, dispatch rewrite com req.query ou URL e preservação do Meta padrão. Passou. Lint do escopo com configuração principal: zero erros, nove warnings de complexidade/logging/quantidade de statements incluindo legado. Gitleaks --redact dos arquivos finais de endpoint passou. Revisão independente final do helper pelo worker funil: aprovada, sem bloqueador restante.
- Correções solicitadas pela revisão independente foram aplicadas: metadados verificam moeda/fuso e stream sem results só é vazio legítimo quando contém fieldMask; [{}] vira indisponível. Testes desses caminhos passaram.

**Configuração Vercel pendente:** GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN e GOOGLE_ADS_DEVELOPER_TOKEN existem no arquivo global da agência (somente nomes conferidos). Nenhum segredo foi copiado, exportado, puxado da Vercel ou enviado ao provedor neste novo escopo. A existência local não comprova configuração do runtime. A integração UI deve buscar Google separadamente, reconciliar somente mesma janela/base paga completa e não somar gasto Google dentro do total rotulado Meta. Código local não prova leitura em produção; duas rejeições de publicação permanecem.

Referências técnicas: [Search e SearchStream](https://developers.google.com/google-ads/api/rest/common/search), [métricas zero](https://developers.google.com/google-ads/api/docs/reporting/zero-metrics).

## Revisão complementar do destino e saúde CRM

A leitura final do worker confirmou default SE Consultoria → Novos Leads (etapa68d152fa949ae20022df32cd), com override de ambiente preservado. A campaign_id CP não é usada como fallback para SE. As demais ofertas conservam destinos históricos. PATCH do recibo exige exatamente uma linha id/event_id correspondente. Agregados crm_confirmados, planilha_confirmados e entrega_sem_recibo distinguem prova disponível de schema/fonte pendente; ausência de comprovante não é “entregue”. Os testes específicos desse último diff foram reportados pelo worker, sem repetição nesta revisão.


### Confirmação real do helper Google (somente leitura)

Execução do próprio lib/google-ads.js em Node isolado, com apenas as quatro variáveis lidas diretamente do arquivo global no processo. A primeira execução em sandbox devolveu503 OAuth indisponível; execução com rede autorizada completou HTTP200. Resultado sanitizado: conta1316487378; BRL; America/Sao_Paulo; janela01/10/2026–05/10/2026; fonte disponível; gasto totalR$0; catálogo com24317774874 e24328953730, ambasPAUSED e gastoR$0. Nenhuma consulta a outro cliente, mutação, lead, export de ambiente ou configuraçãoVercel. Isso confirma o helper/API real local; a fonte em produção permanece pendente de configuração e publicação.

A revisão final do adapter UI confirmou fetchGoogle opcional nas duas janelas e reconciliação somente em mesmo período/BRL/base paga completa/campanha única no provider. Catálogo Google passa a existir localmente. O catálogo individual Meta sem entrega continua indisponível neste endpoint e é indicado no texto, em vez de receber zeros fabricados. Foram acrescentados recibos separados de performance e explicação da atribuição por primeira data/contato/oferta, sem causalidade. Solicitado ajuste do texto de catálogo para não apresentar janela diferente como selecionada; worker responsável conclui esse ajuste.


## Estado final revalidado Google / configuração Vercel

Após autorização de finalizar/publicar/ativar, leitura real confirmou conta1316487378 habilitada, genéricaR$70+marcaR$20 aindaPAUSED, billing_setup vazio, trêsRSA APPROVED/REVIEWED porém adStrengthPENDING. Mantidos Leadsecondary e MQLprimary. Nenhuma ativação ocorreu.

EnvGoogle continua pendente: create_project_env oficial, quatrochaves sensitive para produção/preview no projeto Vercel confirmado, foi rejeitado pela revisão automática por exigir consentimento específico de transferência dos segredos e possível overwrite. Nenhuma variável foi criada; não houve retry/CLIalternativa, export de ambientes ou leitura descriptografada. A medição local e o helper real validado não substituem publicação/configuração e recebimento em produção. Detalhes em sessao-estrategica-google-validacao-2026-10-05.md.

Review UI complementar concluída: catálogo agora exige mesma janela via midiaCompativel; worker reportou fixture e browser locais desktop/mobile sem overflow/console/recursos externos. Resultados atribuídos ao worker, sem repetição nesta revisão.
