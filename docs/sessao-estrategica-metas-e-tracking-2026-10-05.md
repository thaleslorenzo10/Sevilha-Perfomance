# Sessão Estratégica — metas, orçamento e rastreio, 05/10/2026

Objetivo comercial: **80–90 MQL e 30 sessões por mês**, aproximadamente **19–21 MQL e 7 sessões por semana**. O usuário não definiu se as 30 sessões são agendadas ou realizadas. Registrar as duas métricas separadamente; não atribuir sessão a um submit ou MQL. Se agenda não estiver disponível no painel, mostrar **indisponível**.

| Indicador | Meta/fórmula |
|---|---|
| MQL/mês | 80–90 contatos únicos, porte 10+ |
| MQL/semana | 18,5–20,8, usando 52/12 semanas/mês |
| Sessões/mês e semana | 30 e 6,9 |
| Custo total/MQL | R$14.000÷90 a ÷80 = **R$155,56–175,00** |
| Custo total/sessão | R$14.000÷30 = **R$466,67** |
| Razão sessão/MQL condicional | 30÷90 a ÷80 = **33,3–37,5%**, somente com coortes e definição compatíveis |
| Conversão de agendamento | Agendadas÷MQL da mesma coorte |
| Comparecimento | Realizadas÷agendadas da mesma coorte |

Esses custos incluem toda a verba SE, inclusive conteúdo. Não são CPL de plataforma nem previsão garantida. Se a meta for 30 realizadas, serão necessários mais agendamentos conforme comparecimento observado; não inventar essa taxa.

## Orçamento e distribuição

| Frente | Antes da transição (preflight) | Atual configurado (23:30 BRT) | Futuro planejado |
|---|---:|---:|---:|
| Meta captação | R$450 | R$410 | R$320 |
| Conteúdo Instagram Bruno | R$0 | R$40 | R$40 |
| Google Search genérico | R$0, pausado | R$0, pausado | R$70 |
| Google Search marca | R$0, pausado | R$0, pausado | R$20 |
| Total | **R$450 ativos** | **R$450 configurados ACTIVE** | **R$450 propostos** |

A transição **foi executada e relida às23:30:17BRT**: os três controladores antigos foram reduzidos primeiro a12059+13265+15676=41000centavos; depois conteúdo Bruno4000 foi solicitadoACTIVE. Campanha120253414357780526 e conjunto120253414358070526 ACTIVE/ACTIVE; três anúncios ACTIVE/IN_PROCESS, sem entrega confirmada. Captura nova120253413819760526 permanecePAUSED32000; Google continuaPAUSED. Fonte:[journal de criação/ativação Bruno](sessao-estrategica-bruno-criacao-2026-10-05.json). O journal de distribuição anterior permanece evidência histórica de zero mutações naquela etapa. Futuro320+40+90 exige prova de ingestão e redistribuição, sem empilhar orçamento.

Leitura mais recente registrada no [preflight Bruno](bruno-distribuicao-preflight-2026-10-05.json) e [relato Bruno](bruno-distribuicao-2026-10-05.md): **R$2.112,22** de captação [SE] em 01–05/10, substituindo o snapshot anterior de R$1.961,61 para pacing. O arquivo-fonte foi gravado em **06/10/2026 01:31:31 UTC (05/10 22:31:31 BRT)**; esse é timestamp do arquivo, pois o horário exato da resposta API não foi salvo. Saldo de R$14.000 menos essa captação: **R$11.887,78**, ainda sujeito à definição de inclusão dos R$438,18 da distribuição antiga e ao gasto após a leitura. A conta inteira soma R$5.884,59 e inclui outras ofertas; não usar esse valor como gasto SE.

Mês nominal máximo de 31 dias: Meta R$360×31 + Google R$90×30,4 = **R$13.896**. É cálculo nominal, não hard cap. Aplicar saldo real de R$14.000 menos gasto SE do mês e conferir pacing; diário pode variar. Google pausado não adiciona R$90 ao gasto ativo. Nova captação substitui orçamento legado, sem empilhar os dois. Somar orçamento no nível correto CBO/ABO. Aula, Café e Clube ficam fora da verba e das metas desta oferta.

Ranking preservado: **AD21, AD16, IA, AD29 e Vicente**, com MQL por ID real e custo no intervalo compatível conforme [ranking histórico](sessao-estrategica-ranking-historico-2026-10-05.md). Dez instâncias Sevilha/Bruno representam cinco conceitos.

## Auditoria UTM e nomes

O readback local de hoje dos **dez anúncios novos pausados** contém exatamente `utm_source={{placement}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}` em `creative.url_tags`: 10 canônicos, nenhum ausente nesse conjunto. IDs e nomes estão no JSON sanitizado associado.

A releitura remota GET recebeu **code 17/2446079** ao consultar conjuntos da nova campanha, indicando excesso de chamadas. Novas chamadas foram interrompidas. A cobertura fresca dos anúncios ativos de captura/HOT/conteúdo e a substituição downstream continuam **pendentes**; não declarar todos auditados nem apontar UTMs ausentes sem prova. Este documento não efetuou nenhuma mutação Meta ou CRM.

Macro literal no campo `creative.url_tags` é a configuração esperada; macro literal gravada em uma UTM do lead indica substituição quebrada. Para formulários nativos, o export dispõe de `ad_id`, `adset_id` e `campaign_id`; `url_tags` sozinho não atribui o lead. `lib/planilha-leads.js` reconhece essas colunas mas emite agregados por nomes, descartando os IDs. O ranking usou o export original e removeu `ag:` como texto, sem converter IDs em número. Não foi feita nova leitura de dados pessoais nesta auditoria.

| Objeto | Nome/identificação existente | Alias semântico recomendado |
|---|---|---|
| Campanha 120253413819760526 | [SE] [FORMS] [MAIOR INTENÇÃO] [IDENTIDADE] 2026-10-05 | SE · Captação · Forms maior intenção · Frio · Identidades |
| Conjunto 120253413819880526 | Contabilidade financeira · Sevilha · 2026-10-05 | Frio · Contabilidade financeira · IG Sevilha |
| Conjunto 120253413820840526 | Contabilidade financeira · Bruno · 2026-10-05 | Frio · Contabilidade financeira · IG Bruno |
| Campanha HOT 120235128444610526 / conjunto 120243440924150526 | IDs históricos confirmados; nome live não relido | SE · Captação · Forms · Quente / Quente · Engajamento/site |

Usar aliases de relatório ou padrão para campanhas futuras; **nenhum rename live foi aplicado**. Nomes em UTMs sustentam a comparação histórica e uma troca exige mapeamento explícito antes da execução. HOT e conteúdo Bruno permanecem sob responsabilidade do agente de funil.

## Teste futuro do Respondi

**Planejado, sem ativação:** testar novamente a rota histórica [formulário Respondi](https://form.respondi.app/gvz4UKQr), URL exata presente nos CTAs dos criativos históricos. A auditoria de 29/set identifica a LP antiga como Respondi. A abertura pública nesta etapa não retornou conteúdo acessível; o status e tracking atuais do formulário externo não estão comprovados. LPs pausadas permanecem pausadas.

Reutilizar os mesmos cinco conceitos e recortar o teste **dentro dos R$320/dia futuros de Meta captação**, sem verba extra. A parcela concreta depende de saldo, ingestão e disponibilidade; ainda não foi definida nem aplicada. Comparar custo por MQL único 10+ em intervalo equivalente, qualidade, agendamento e comparecimento separados. Relatar contagens e janela; amostra pequena não permite declarar vencedor nem poder estatístico conhecido, e menor CPL isolado não basta.

Antes de lançar: conferir formulário, perguntas/corte 10+, privacidade e UTMs; persistência durável antes do redirecionamento; ad identity e dedupe de contatos no CRM. Confirmar Pixel/CAPI com mesmo event_id nesse fluxo externo — o Respondi não herda automaticamente a instrumentação de `/mentoria`. Verificar entregas das integrações e isolar mensagens em eventual teste autorizado. Não alterar follow-up, scheduler ou campanhas nesta etapa.

## Recuperação comercial existente

Acompanhar o funil **MQL → contatado → agendado → realizado** com contato deduplicado, tempo de primeira resposta e motivo de perda, quando disponíveis no CRM. Reutilizar o processo existente; esta revisão não cria automação, envia mensagem ou altera follow-up. Ausência de dados dessas etapas é indisponibilidade de medição, não zero.

30 sessões de 45 minutos demandam **22,5 horas/mês** de agenda do Bruno, sem preparo. 80–90 MQL não garantem 30 realizadas: se o objetivo for 30 agendadas, requer conversão de agendamento de 33,3–37,5%; se for 30 realizadas, agendamentos necessários = 30÷comparecimento observado, elevando a necessidade conforme essa taxa. Não há taxa de comparecimento comprovada nesta revisão.

## Feito e pendente

Feito nesta revisão: metas/fórmulas, proposta futura, plano atualizado, dez url_tags da nova captura e três tags do conteúdo Bruno relidos, plano do Respondi e transição410+40 executada. Conteúdo configuradoACTIVE, anúncios aindaIN_PROCESS; não se afirma entrega nem MQL assistido por visitas ao perfil. Pendente: cobertura GET de todos os ativos após cooldown, evidência de substituição downstream/agenda, validade e rastreio do Respondi e aprovação/ingestão das substituições antes de ativar. A nomenclatura é recomendação; não foi publicada.

Fontes locais: [journal Meta](sessao-estrategica-meta-execucao-2026-10-05.json), [auditoria anterior](auditoria-sessao-estrategica-2026-09-29.md), [plano atualizado](superpowers/plans/2026-10-05-sessao-estrategica-meta-search.md), contrato export `lib/planilha-leads.js`. [Dados sanitizados desta revisão](sessao-estrategica-metas-e-tracking-2026-10-05.json).


Readback posterior, 05/10/2026 23:41:42 BRT: três anúncios de conteúdo 120253414359770526, 120253414362440526 e 120253414364330526 passaram a **ACTIVE/ACTIVE**. Os quatro controladores estão ACTIVE/ACTIVE, com 12059 + 13265 + 15676 + 4000 = 45000 centavos/dia (R$410 captação antiga + R$40 conteúdo). Isso atualiza os estados IN_PROCESS do snapshot23:30, preservado acima como histórico; estado efetivo não comprova impressões, gasto ou MQL assistido. Captura nativa nova R$320 permanece pausada até prova de ingestão. Fonte: production_stage_readback no journal de criação.
