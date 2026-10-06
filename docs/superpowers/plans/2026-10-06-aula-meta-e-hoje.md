# Aula Meta — campanhas É hoje — plano autoaprovado

Escopo autorizado: Aula Gestão Operacional em 06/10/2026, conta 1676714556216146. Sessão estratégica, Café e Clube preservados.

Orçamento live 08h58: R$600/dia, CBOs cold virada250, hot virada250 e cold fase01 100. Novo total780 (+30%). Novas duas campanhas do zero: HOT351 e COLD351, juntas702 (90%); existentes32,50+32,50+13=78 (10%). Orçamento diário é nominal, não teto rígido de gasto da plataforma.

- [x] Preflight live conta, hierarquia, budgets, destino, públicos, identidade e Pixel Purchase.
- [x] Subir as12 PNGs existentes e criar24 anúncios (12 por temperatura), com UTMs no campo url_tags.
- [x] Criar duas CBOs pausadas com orçamento total de R$351 para hoje cada, objetivo Sales/Purchase; dois conjuntos por campanha: lote até16h e aula até17h30, Brasília. Respeitar inscrição2hantes da aula19h30 conforme página.
- [ ] Reutilizar públicos frios/quentes elegíveis, preservar separação HOTestrito/COLDexclusões; incluir Bruno quente se regra e propriedade confirmadas. Excluir compradores se audiência válida já existir.
- [x] Revisar objetos pausados: imagem/cópia/destino/tags/público/pixel/end_time.
- [ ] Reduzir campanhas existentes para os10%, fechar anúncios antigos de virada às16h e fase01 às17h30; ativar novas e reler hierarquia completa.
- [x] Salvar journal de IDs/antes/depois/erros/rollback e entregar orçamento real e estado de revisão. ACTIVE solicitado ou IN_PROCESS não equivale a entrega.

Execução: subagentes com escopos independentes preflight somente leitura e upload de imagens; coordenador cria/reconcilia objetos. Nunca reemitir criação com resultado incerto sem consulta por nome/ID. Antes de ativar, confirmar nenhum estado externo mudou desde snapshot.

## Decisões da execução

Meta rejeitou encerramento no mesmo dia com orçamento diário (mínimo24h). Novas CBOs usam orçamento lifetime35100centavos somente hoje; não há extensão de anúncios É hoje para amanhã. Draft diário vazio120253422648440526 ficaPAUSED e fora da verba ativa.

Execução parcial: COLD351 lifetime ativada e12ads ACTIVE/ACTIVE; HOT351 lifetime prontaPAUSED pois criação do públicoBruno foi rejeitada. Temporariamente existentes429/dia (178,75+178,75+71,50) +COLD351para hoje =780nominais. Meta permite entrega acima do orçamento diário; isso não é teto rígido do gasto real. Assim que HOT351 puder ser ativada, existentes devem cair para78/dia (32,50+32,50+13), atingindo90% nas novas. Não afirmar90% aplicado antes dessa transição.
