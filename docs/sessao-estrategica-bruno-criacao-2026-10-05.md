# Meta SE e Bruno — criação e readback

Atualização de ativação: **2026-10-05T23:30:17-03:00**. Conta1676714556216146, BRL, America/Sao_Paulo. Conteúdo Bruno configurado ACTIVE após redução confirmada dos três orçamentos antigos; entrega dos três anúncios ainda pendente de processamento.

## Conteúdo criado e ativação solicitada

Campanha **120253414357780526**, **[SE] [BRUNO] [IG] [CONTEÚDO PERFIL] 2026-10-05**, objetivo **OUTCOME_TRAFFIC**, orçamento **R$40/dia**, estado solicitado **ACTIVE** após transição. Conjunto **120253414358070526**, meta **VISIT_INSTAGRAM_PROFILE**, BR25–60, interesse contabilidade financeira, Instagram feed/stories/reels exclusivamente; públicos/exclusões e expansão preservados do modelo frio validado.

A criação de campanha, conjunto, criativos e anúncios passou primeiro por `validate_only` e depois por criação/readback. A otimização de visita ao perfil foi comprovada em conjunto de distribuição existente; a nova combinação de objetivo/meta foi validada pela própria API. Essa é distribuição dos posts existentes, sem formulário ou conversão de lead no destino.

| Post existente | Media ID | Creative ID | Ad ID |
|---|---|---|---|
| [Liderança e resultado](https://www.instagram.com/reel/Dd6fYcsOfjV/) |17910884640537456|2003735993633999|120253414359770526|
| [Definir resultado](https://www.instagram.com/reel/Dd1sffWiY3a/) |17977204748918220|1088048704001716|120253414362440526|
| [Organizar antes de contratar](https://www.instagram.com/reel/DdtqySRunlo/) |18115610558043965|958753126733052|120253414364330526|

Os três criativos foram relidos com Página Bruno106292094924513, Instagram17841446823336862, `source_instagram_media_id` correspondente e tags exatas:

```
utm_source={{placement}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```

No readback de ativação, campanha e conjunto estavam **ACTIVE/ACTIVE**; os três anúncios estavam **status ACTIVE / effective_status IN_PROCESS**. `IN_PROCESS` não prova aprovação ou entrega. Estados finais estão no journal; campanhas em preparação não representam resultado de teste. A campanha tentativa **120253414251620526** (OUTCOME_ENGAGEMENT) continua pausada e vazia, sem anúncios. Ela não deve ser ativada nem somada ao orçamento operacional reservado.

## Orçamento preservado

Captura nova **120253413819760526** ajustada36000→32000centavos; último estado PAUSED/PAUSED e R$320/dia. Captação antiga foi reduzida antes da ativação:13235→12059,14559→13265 e17206→15676centavos, com escrita/readback individual e soma41000 confirmada antes de ativar anúncios/conjunto. Campanha de conteúdo ativada por último. Controladores mantiveram statusACTIVE; dois estavam effective_statusIN_PROCESS e WarmACTIVE no readback final. **Atual nominal: R$410 captação antiga + R$40 conteúdo Bruno = R$450/dia**, confirmado23:30:17BRT. Não é teto mensal rígido nem prova de entrega.

Reserva futura: R$320 captura + R$40 conteúdo + R$90 Google = R$450/dia, condicionada à prova de ingestão e transição coordenada. Valores pausados não são gasto nem se somam ao orçamento ativo. A transição410captura antiga+40conteúdo foi executada e relida; migração futura320captura nova+40conteúdo+90Google continua condicionada ao formulário comprovado. Distribuições antigas e demais ofertas foram preservadas.

## Bloqueios remanescentes

- Público Bruno: regra de engajamento existente com fonte `ig_id47014896777` confirmada foi rejeitada antes de criar ID, **2654/1713151**, nome de evento inválido. Nenhum público Bruno foi criado; nenhum conjunto HOT novo foi criado sem essa inclusão. Documentação oficial de engagement custom audiences retornou429; não se repetiram variantes sem prova.
- O primeiro conjunto POST_ENGAGEMENT/OUTCOME_ENGAGEMENT foi rejeitado **100/2490408**. Validar VISIT_INSTAGRAM_PROFILE naquela mesma campanha também falhou. A segunda campanha OUTCOME_TRAFFIC descrita acima resolveu esse bloqueio de conteúdo; ativação solicitada após transição, anúncios ainda IN_PROCESS.
- Novo formulário1776305790272614 ainda não tem prova de recebimento nos destinos (0leads e0linhas na planilha relidos pelo backend owner). AssinaturaPage presente não comprova CRM/Sheets. Captura nova continua pausada.

[Journal sanitizado](sessao-estrategica-bruno-criacao-2026-10-05.json) · [Preflight](sessao-estrategica-meta-ativacao-preflight-2026-10-05.json). Nenhum post novo, conceito adicional, contato teste, envio CRM ou mensagem criado por esta execução.

Visitas ao perfil e seus anúncios de distribuição não persistem UTM em um formulário por si. Tags nos criativos foram relidas3/3, mas não demonstram atribuição de MQL assistido nem resolução downstream de macros.


Readback posterior, 05/10/2026 23:41:42 BRT: três anúncios de conteúdo 120253414359770526, 120253414362440526 e 120253414364330526 passaram a **ACTIVE/ACTIVE**. Os quatro controladores estão ACTIVE/ACTIVE, com 12059 + 13265 + 15676 + 4000 = 45000 centavos/dia (R$410 captação antiga + R$40 conteúdo). Isso atualiza os estados IN_PROCESS do snapshot23:30, preservado acima como histórico; estado efetivo não comprova impressões, gasto ou MQL assistido. Captura nativa nova R$320 permanece pausada até prova de ingestão. Fonte: production_stage_readback no journal de criação.
