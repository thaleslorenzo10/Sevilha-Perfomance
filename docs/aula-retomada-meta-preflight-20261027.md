# Retomada da aula de Gestão Operacional — 27/10/2026, 19h30

Preflight consultado ao vivo em 14/10/2026. Conta `act_1676714556216146`, BRL, `America/Sao_Paulo`. Nenhuma escrita remota foi feita durante a preparação.

## Plano exato

- Reutilizar campanhas HOT `120253257675000526` e COLD `120253257675140526`, ambas pausadas.
- Orçamento diário de R$100 em cada campanha: R$200/dia configurados no total da aula. As campanhas de sessão estratégica não entram neste orçamento e não são alteradas.
- Reutilizar os conjuntos `120253257680250526` e `120253257680570526`, evento Purchase, pixel `657178423444244`, Brasil, otimização de conversões.
- Substituir o criativo de V02 e V03 em cada conjunto por novos criativos com 27 de outubro, 19h30 (Brasília), mantendo os IDs dos anúncios. Pausar os outros 12 anúncios dessas duas campanhas.
- Ajustar encerramento dos conjuntos para 27/10/2026 às17h30 de Brasília.
- Preservar nomes históricos de campanhas/conjuntos/anúncios para manter continuidade dos cruzamentos UTM. Isso significa que os nomes internos antigos ainda contêm referências à edição anterior. A mensagem e título exibidos serão atualizados.
- Remover13 entradas de públicos indisponíveis em cada conjunto (12 `operation_status422` sem atividade recente;1 `delivery_status300` muito pequeno), mantendo53 públicos elegíveis HOT e as mesmas53 exclusões COLD. Nenhum público novo criado.
- Destino limpo: https://sevilha-perfomance.vercel.app/aula-gestao-operacional/
- `url_tags`: `utm_source={{placement}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`. Os anúncios antigos embutiam macros na URL; o plano migra para o campo correto.
- Demais campanhas AULA, incluindo ÉHOJE, ficam pausadas.

## Evidências de escolha

Período20/09–13/10, atribuição Meta, não conciliação financeira: V02 registrou13 compras HOT com R$1.132,21 (CPA R$87,09) e22 compras COLD com R$1.771,34 (CPA R$80,52). V03 teve1 compra HOT (R$101,88) e nenhuma COLD (R$19,38). Usar V02 como criativo comprovado e V03 como segunda variação; divisão100/100 simples com público frio também historicamente convertendo.

V02 (`1832385324597949`) e V03 (`1764313131353001`) baixados do source original via Graph, frames de toda a duração examinados e áudio transcrito integralmente localmente com faster-whisper smallCPU. Nenhum preço nem data antiga identificado. Transcrições e SHA256 estão no plano. Arte e vídeo originais não foram editados.

## Execução e verificação

`python3 scripts/aula-retomada-20261027.py` faz GET da conta e imprime o resumo; não escreve na Meta.

`--apply` exige página HTTP200 com27 de outubro,19h30 e data2026-10-27, sem2026-10-06. Mantém campanhas pausadas, pausa anúncios antigos, ajusta budgets/públicos/encerramento, cria criativos e os associa aos4 anúncios escolhidos. Esses4 anúncios passam a statusACTIVE sob campanhasPAUSED, sem liberação de tráfego. Cada escrita tem snapshot e readback; o script verifica os objetos e preserva o histórico em `docs/aula-retomada-meta-audit-20261027.json`.

`--activate` exige preparação concluída, página válida novamente, soma de budgets20000 centavos, criativos/data/UTMs, públicos utilizáveis, conjuntos esperados, antigos pausados e nenhuma outra campanhaAULA ativa. Só então ativa as duas campanhas por último. Falha de ativação ou readback causa pausa das duas para interromper gasto.

Testes locais com API simulada passaram: dry-run sem escritas; preparo repetido sem criar duplicatas; campanhas mantidas pausadas; retomada e repetição idempotentes; anúncios antigos pausados. Compilação Python passou. O teste não substitui readback real nem prova aprovação/entrega pela Meta.

Antes de declarar entrega, coordenador deve revisar plano/script, executar a preparação, ler estado, ativar e ler estado final. `PENDING_REVIEW` é revisão, não entrega comprovada. Verificar substituição real de UTM após clique/lead efetivo; gravar o template correto não prova substituição em uma conversão real.

Rollback: pausar as duas campanhas. Os before snapshots preservam IDs, budgets, públicos, encerramentos e criativos anteriores. Não reativar anúncios antigos com6/10 durante rollback.
