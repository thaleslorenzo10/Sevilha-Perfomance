# Google — publicação da medição (05/10/2026)

Fonte revisada: commit c8aa709 sobre base de produção fc2529edc3058b0dc21b5630cd8626091328f414. Projeto Vercel prj_POvAf5LHu471jwcKljqgOSAS1pdd, team_QFKNlEWIaRADsF4B2Ci6eaE7. Deployment atual confirmado dpl_AT7R9o3YjXh2j5mpWxhdwsanim9w.

Somente quatro fontes mudam em produção: api/leads.js, assets/tracking.js, mentoria/index.html e mentoria-2/index.html. O coordenador reportou verificadores e navegador local aprovados. Revisão independente confirmou Google exclusivo de SE, retorno persisted, cachev9 e anchors; Aula/Café/CRM/Meta preservados.

## Upload realizado, publicação bloqueada

Os quatro blobs revisados foram aceitos pelo upload_file oficial. Nenhum preview/deployment novo foi criado:

- api/leads.js: adf24ad95f32130efa227535c21aae1027dcd7c3, 26075 bytes.
- assets/tracking.js: 5dbe5c3f6251a53260f440ef93f250aedb653cea, 26807 bytes.
- mentoria/index.html: a284a25dfcf014ee75202b32ef97d4172621203e, 39755 bytes.
- mentoria-2/index.html: 9c69da1e9ed0b4d5f92f255583631f744c32ec28, 37708 bytes.

Primeira revisão automática rejeitou manifesto205 com configurações internas/docs/criativos. A alternativa revisada removeu esses elementos: manifesto105 apenas runtime, 3432787 bytes, comparação base por arquivo comprova quatro diferenças; gitleaks --redact passou sem leaks. Mantém transitive dependencies do endpoint autenticado /api/compor (três módulosPython, fontes/logo e dez prompts do catálogo), sem out/docs/configs/SQL/subprojeto.

Segunda revisão automática também rejeitou a criação do preview105: potencial exposição de dashboards/APIs/CRM/lead endpoints além das quatro fontes, por considerar ausente aprovação para essa publicação completa. Não houve tentativa de contorno ou terceira requisição. AuthCLI inválida é uma ocorrência separada; MCP leu projeto e recebeu quatro uploads. Nenhum segredo foi exportado/descriptografado.

**Entrega pública pendente:** preview→navegador→produção→readback não ocorreram. Tag/anchors em arquivo local não provam recebimentoGoogle. Ambas campanhasSearch continuam PAUSED; faturamento da conta nova vazio. Coordenador deve apresentar o bloqueio e obter aprovação específica para publicar o runtime existente com os quatro overlays revisados.


## Preflight final após autorização de finalizar/publicar/ativar

Leitura Google Ads real da conta nova1316487378: ENABLED, BRL, America/Sao_Paulo e auto-tagging habilitado. Campanhas24328953730 (R$70/dia) e24317774874 (R$20/dia) seguemPAUSED. Billing_setup retorna lista vazia: faturamento continua pendente. Os três RSA agora estão REVIEWED/APPROVED, mas adStrength permanecePENDING; aprovação de política não equivale à nota Excelente. Conversões SE Lead7823726107 secondary e SE MQL7823726110 primary permanecemENABLED. Nenhuma ativação executada; publicar/verificar medição e faturamento continuam requisitos.

Projeto Vercel confirmado por ferramenta oficial: prj_POvAf5LHu471jwcKljqgOSAS1pdd, sevilha-perfomance, team_QFKNlEWIaRADsF4B2Ci6eaE7. Leitura decrypt=false mostrou ausência das quatro chaves Google requeridas. Foi solicitado create_project_env oficial, tipo sensitive, alvos produção/preview, restrito às quatro chaves do arquivo global da agência; nenhum ambiente completo foi exportado ou descriptografado.

**Revisão automática rejeitou a configuração de credenciais**, por considerar o envio de refresh token/client secret à Vercel e possível overwrite um egress que exige autorização explícita específica e prova de destino confiável. A rejeição ocorreu antes de execução: nenhuma variável foi criada. Não houve repetição nem alternativaCLI. Para concluir, o coordenador deve obter consentimento específico de envio dessas quatro credenciais ao projeto correto em produção/preview, sem solicitar valores no chat. Faturamento requer ação na [configuração Google Ads](https://ads.google.com/aw/billing/summary), selecionando conta1316487378; não há cobrança/cartão autorizada nesta execução.

Além das duas rejeições anteriores de deployment, o coordenador informou nova rejeição automática do upload de api/meta.js após autorização genérica de publicação. Publicação segue parada e nenhum preview novo foi criado; resolver o escopo específico apontado pelo revisor, sem contorno.
