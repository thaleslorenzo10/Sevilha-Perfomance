# Sessão Estratégica: ingestão e recibos — 05/10/2026

Backend implementado na base de produção; publicação sob responsabilidade do coordenador. A migração de recibos foi aplicada nesta etapa após autorização explícita de finalizar/publicar. Nenhum lead de teste, envio ou campanha foi ativado por este agente.

## Rotas comprovadas e limites

- Web /mentoria e /mentoria-2: POST /api/leads → Supabase public.sevilha_leads → planilha configurada Leads Mentoria + RD CRM + RD Marketing + CAPI. O banco salva primeiro; cada integração retorna estado explícito. O painel lê Supabase e fontes de planilha.
- Respondi: workflow ativo 5CbvxrwEUylBQUXF recebe respostas, escreve planilha de eventos e cria oportunidade RD CRM. Seu filtro de etapa é order=1, sem prova de destino específico. O endpoint local /api/respondi envia evento qualificado; não substitui essa ingestão externa.
- Meta Forms: painel lê linhas duráveis da planilha Central. PageSevilha possui leadgen subscribed app 1268751301361567. O callback da aplicação e seu eventual filtro por form_id não puderam ser inspecionados. A chegada do formulário novo 1776305790272614 ao CRM continua sem prova. Nenhum receptor novo foi inventado.

## Destino comercial web

GET autenticado de metadados RD /deal_pipelines confirmou Consultoria 68d152fa949ae20022df32cb contendo Novos Leads 68d152fa949ae20022df32cd. Por decisão do coordenador, essa é a etapa padrão da Sessão Estratégica quando RD_CRM_STAGE_ID_SE está ausente; override explícito continua válido. SE não herda etapa nem campanha do Clube da Performance. As demais ofertas mantêm seus padrões. O fluxo comercial e o recebimento real nesta etapa precisam ser conferidos antes da ativação. Origem Google e Outros Buscadores 68d152fa949ae20022df32c5 foi confirmada por metadados; UTMs preservam o detalhe pago.

## Persistência com recibos

Migração aplicada via Supabase Management API existente: supabase/migrations/20261005_sevilha_leads_integracoes.sql, projeto hojcntkggnwrvbvmcwxe, tabela public.sevilha_leads. Metadata confirmou tabela/colunas antes; releitura confirmou integracoes jsonb depois. Journal: sessao-estrategica-receipts-migration-2026-10-05.json. A coluna integracoes jsonb guarda estados attempted/accepted/verified/status, sem contato. O PATCH exige ID e event_id, exatamente uma linha e releitura dos campos. Se a coluna não existir, inscrição continua e delivery_status_durable=false; leitura do painel faz fallback sem perder leads.

Google conversion_ready exige banco confirmado, recibo de linha planilha, CRM com contato confirmado e recibos persistidos. Sem qualquer prova, não dispara conversão Google. HTTP 200 isolado não comprova entrega. RD Marketing é somente accepted, verified=false. A gravação Sheets é comprovada pelo updatedRange/updatedRows da resposta append, sem GET independente.

## Contrato do painel

por_formato_aquisicao_se tem cinco formatos: META_FORMS, RESPONDI, GOOGLE_SEARCH, META_SITE, SITE_SEM_ATRIBUICAO. por_campanha_formato_se preserva campaign_id como string. Contadores crm_confirmados, planilha_confirmados e entrega_sem_recibo não contêm contatos. Nativos/Respondi têm planilha_confirmados igual às linhas deduplicadas lidas; CRM e sem recibo são null por ausência de prova. Web sem schema e fonte indisponível têm três null. MQL permanece 10+ independente da saúde da entrega. IDs numéricos com precisão perdida não são utilizados como IDs confiáveis.

Dedupe é por contato/oferta e precede o recorte de período, usando a janela histórica lida (180 dias). O crédito descritivo fica na primeira data de entrada da oferta. Em empate no mesmo dia, a ordem estável é Meta Forms → Respondi → Supabase, seguida da ordem original da fonte; o desempate não compara horário. Portanto uma mesma pessoa Forms+Google recebe somente um formato segundo esse método, sem provar que ele causou a conversão. Reenvios com primeira entrada anterior ao período não contam como novos. Isso representa atribuição operacional de registros, não vencedor causal de mídia; o total representa contatos/ofertas, não pessoas globais. Falha de fonte e gasto sem reconciliação são indisponíveis, não zero. Custos Google não são preenchidos com investimento Meta; custos por formato somente mediante conciliação explícita no mesmo período e base paga.

## Pendências para entrega operacional

Publicar backend e tracking; validar um registro real autorizado nos três destinos e reconciliar no painel; confirmar callback native leadgen e política do anunciante. Os anúncios novos permanecem pausados até essa evidência. A chave opcional RD_CRM_STAGE_ID_SE foi preparada vazia no .env.local ignorado da raiz, sem alterar valores existentes; configurações Vercel não foram exportadas.


## Releitura native atual

Novo formulário 1776305790272614: leads_count=0. Planilha Central gid1331027312 tem 997 linhas de dados e zero linhas desse formulário. PageSevilha mantém app 1268751301361567 inscrito em leadgen. Consulta de assinaturas do app respondeu HTTP400/code104: exige credencial de aplicação indisponível no arquivo Ads (somente token de usuário). Portanto callback/filtro por form_id permanecem desconhecidos. Importador de planilha → RD CRM QUHr7JRIIhGrOgOY está inativo. MCP não disponibilizou detalhes, mas GET REST autenticado existente permitiu inspeção: gatilhos Manual/Webhook leem outro spreadsheet 148Gt4pctbsWIiiH-TNCfxgXErkvemPKczmggtpUDl6Q (gids0/857728296), filtram e-mail, deduplicam e criam deals RD CRM. Não recebe leadgen nem possui filtro do formulário novo; nenhum node de WhatsApp/Evolution foi detectado. É uma importação histórica, não prova da rota nova; não foi ativado/executado. Workflow ativo Respondi é distinto. Nenhuma evidência de entrega do novoform a Sheets/CRM; zero leads ainda impede validação passiva. Não foi enviado lead de teste para evitar disparo de WhatsApp.
