# Sessão Estratégica — cinco criativos históricos selecionados

Consulta GET em 05/10/2026 na conta 1676714556216146, Graph v 23.0. Nenhuma alteração em anúncios ou planilhas.

O histórico máximo disponível contém 421 anúncios SE com gasto total de R$ 130.802,86. A API responde com janela 13/02/2025–05/10/2026; o primeiro gasto SE encontrado é 03/04/2025. Portanto, a seleção não ficou limitada a janeiro–abril.

Qualidade cruzada por **ID original real**, não por nome: duas abas FORMS, 1.800 registros SE e 1.692 contatos únicos de 21/12/2025 a 05/10/2026. O ad_id tem prefixo ag:, removido como texto; não foi convertido em número. Deduplicação global nas duas abas por e-mail normalizado/telefone, com primeiro registro atribuído ao respectivo anúncio; testes excluídos. Nenhum contato individual integra os arquivos.

Os cinco abaixo equilibram volume e custo por MQL 10+ observado. Cada origem escolhida tem pelo menos 18 MQL. Não constituem garantia de resultado futuro nem ranking de vendas comerciais. AD21 tem uma segunda instância forte 120244151199590526 com 83 únicos/32 MQL, sustentando o conceito além da origem de melhor custo.

| Ordem | Original | ID do anúncio | Gasto na cobertura FORMS | Únicos | MQL 10+ | Dono/sócio 10+ | Custo/MQL |
|---|---|---|---:|---:|---:|---:|---:|
|1|AD21|120241218311660526|R$ 1.000,45|67|18|15|R$ 55,58|
|2|AD16|120235361806360526|R$ 3.390,85|243|47|36|R$ 72,15|
|3|AD - Vídeo - Como saber onde usar Inteligência — Cópia|120252914643230526|R$ 2.570,17|65|23|15|R$ 111,75|
|4|AD29|120248782837860526|R$ 5.262,64|121|32|27|R$ 164,46|
|5|005 - Está consumido pela operação da contabilidade VICENTE|120244151199580526|R$ 7.362,36|176|40|36|R$ 184,06|

O gasto da tabela usa 21/12/2025–05/10/2026, alinhado à base de contatos. Para AD16, usar o gasto lifetime R$ 4.347,94 contra 47 MQL seria incorreto: o gasto comparável é R$ 3.390,85. A instância AD16 registra 331 leads onsite lifetime, dos quais 243 na cobertura FORMS. Os campos de pixel permanecem separados no JSON e não substituem pessoas registradas.

AD11 teve 547 leads onsite nas suas instâncias lifetime; 489 vieram de dois IDs cuja entrega foi quase toda anterior à cobertura FORMS. Esses dois têm apenas 5 contatos observáveis e 0 MQL no período disponível. Uma cópia posterior tem 41 únicos/9 MQL, porém volume menor de qualidade confirmada. Não inventamos MQL antigos para classificá-lo acima dos cinco selecionados. AD01 original 120244151443220526 tem 116 únicos/26 MQL a R$ 217,50 por MQL e ficou abaixo dos escolhidos.

Os assets são distintos e reaproveitados: AD16 é o vídeo PERFORMANCE REFORMA TRIBUTÁRIA; AD21 é Captions_688E02; AD29 é Existe alguém na sua empresa que vc tem medo; IA é Como saber onde usar Inteligência Artificial; Vicente é Está consumido pela operação da contabilidade, com versões feed/storie no mesmo conceito. IDs de vídeo, criativo, post, origem e templates sanitizados constam no JSON. Títulos são os metadados existentes; conteúdo audiovisual não foi regravado nem integralmente revisado nesta análise.

Para montar cinco anúncios com formulário novo, ler novamente cada source_creative_id e preservar vídeos, imagens/hashes, textos, títulos e regras de placement. Trocar apenas lead_gen_form_id em object_story_spec.video_data.call_to_action.value e, quando presente, asset_feed_spec.call_to_actions[].value. Vicente usa feed com duas versões de vídeo e imagem auxiliar; conservar seus labels/regras. O formulário antigo é 1836784071025712. Criar novo creative/post: reutilizar o object_story_id antigo conserva o formulário antigo. URLs temporárias de imagem/thumbnail foram omitidas; devem ser lidas novamente no momento de copiar. A capacidade de leitura dos assets foi confirmada; criação deve ser testada pausada pelo executor.

Preservar nomes dos anúncios/assets e todas as campanhas históricas. Nomes novos pertencem somente às novas campanhas. Todo anúncio novo exige utm_source={{placement}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}. O limite autorizado é R$ 14.000/mês **somando Meta e Search**; este documento não decide a divisão nem aumenta orçamento.

Fontes: Graph API autenticada/insights level=ad, date_preset=maximum paginado; insights diários dos IDs escolhidos e mensais/dia inicial de campaign; ad/creative e títulos dos vídeos; abas FORMS 1542463586 e 1331027312 da fonte documentada em lib/sheets.js. Qualificação segue lib/porte.js. A auditoria de 29/09 segue como comparação datada, sem limitar o lookback atual.

Limites: a cobertura máxima retornada pela API não prova inexistência de histórico anterior apagado/indisponível; não há MQL por ID de LP porque suas UTMs usam nomes; o corte 10+ é operacional, não reunião realizada; 05/10 está em andamento e diferença de centavos entre leituras reflete snapshots distintos.
