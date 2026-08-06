# Diagnóstico Meta Ads — Sevilha Educação

**Período analisado:** 06/mai/2026 a 06/ago/2026 (últimos 3 meses)
**Contas:** Sevilha Educação - Ueslei (3451731371506645) e Sevilha Educação - Vicente (3048052985232837)
**Data do diagnóstico:** 06/08/2026

---

## 1. Resumo executivo

- Todo o investimento dos últimos 3 meses aconteceu em **um único mês (junho)**, na conta Ueslei, em 2 campanhas de captação da **Imersão Holding & Offshore** (produto de entrada, ticket médio ~R$ 63).
- **A conta está 100% pausada desde ~1º de julho** — e foi pausada exatamente na melhor semana do período (24–30/jun: ROAS 1,93 no público frio, CPA R$ 50,72).
- Resultado consolidado: **R$ 10.259,61 investidos → 171 compras → R$ 10.775,74 de receita atribuída → ROAS 1,05** (captação praticamente se pagando, padrão de funil self-liquidating).
- As maiores alavancas identificadas **não são de mídia**: vazamento de 50% entre clique e página, 70% de abandono no checkout e tracking com `fbc`/advanced matching zerados.
- A conta Vicente está dormante (nenhum gasto desde 2024) — sem impacto no período.

### Números consolidados (junho/2026)

| Métrica | Valor |
|---|---|
| Investimento | R$ 10.259,61 |
| Compras (pixel) | 171 |
| Receita atribuída | R$ 10.775,74 |
| ROAS | 1,05 |
| CPA médio | R$ 60,00 |
| Ticket médio | R$ 63,02 |
| Impressões | 214.705 |
| Cliques | 2.655 (CTR 1,24% · CPC R$ 3,86) |
| CPM médio | R$ 47,78 |
| Checkouts iniciados | 570 (custo/checkout: R$ 18,00) |
| Conversão checkout → compra | 30% |

### Por campanha

| Campanha | Invest. | Compras | CPA | ROAS | Freq. (28d) |
|---|---|---|---|---|---|
| [IHO_JUN26] [COLD] Fábrica de Criativos | R$ 7.191,84 | 109 | R$ 65,98 | 0,98 | 3,19 |
| [IHO_JUN26] [HOT] Fábrica de Criativos | R$ 3.067,77 | 62 | R$ 49,48 | 1,21 | 3,10 |

### Evolução semanal (ROAS)

| Semana | COLD | HOT |
|---|---|---|
| 03–09/jun | 0,32 | — |
| 10–16/jun | 0,65 | 1,51 |
| 17–23/jun | 0,59 | 0,73 |
| 24–30/jun | **1,93** | 1,46 |
| A partir de 01/jul | **pausado** | **pausado** |

A curva do COLD é típica de campanha saindo da fase de aprendizado: as 2 primeiras semanas pagam o aprendizado, a última colhe. A pausa em 01/jul jogou esse aprendizado fora.

---

## 2. Diagnóstico detalhado (achados com evidência)

### A. A conta apagou no melhor momento ⚠️ (crítico)
Última semana do COLD: 43 compras, CPA R$ 50,72, ROAS 1,93 — o melhor resultado do período. Pausar tudo em 01/jul significa que qualquer relançamento vai **pagar a fase de aprendizado de novo** (as duas primeiras semanas de junho custaram ~R$ 2.800 com ROAS < 0,65). Cinco semanas no escuro também esfriam as audiências de remarketing.

### B. Um único criativo segurou a campanha — e o perdedor não foi cortado
No COLD, 73% do gasto foi para 2 anúncios com destinos opostos:

| Anúncio | Gasto | CPA | ROAS | Veredito |
|---|---|---|---|---|
| AD07 | R$ 2.560,20 | R$ 55,66 | **1,52** | Herói — motor da campanha |
| AD06 | R$ 2.656,81 | R$ 94,89 | **0,56** | Vilão — gastou até o fim |
| AD01 | R$ 657,13 | R$ 43,81 | 0,81 | OK em CPA |
| AD04 | R$ 585,22 | R$ 117,04 | 0,30 | Pausado (corte correto) |

O AD04 foi pausado, mas o **AD06 continuou consumindo R$ 2,6 mil com ROAS 0,56**. Se esse orçamento tivesse migrado para o AD07 a partir da metade do mês, a receita adicional estimada seria de ~R$ 2.500 — o ROAS do período saltaria de 1,05 para ~1,30. Faltou regra objetiva de corte (kill rule).

No HOT, os dois AD08 tiveram os melhores ROAS da conta (2,02 e 1,68) com pouco orçamento — vencedores subaproveitados.

### C. Funil pós-clique vaza em dois pontos (maior alavanca de ROAS)
- **Clique → página: só 49,8%** (1.321 LPVs / 2.655 cliques). Benchmark saudável: 65–80%. Metade do clique pago não vira visita — página lenta e/ou redirecionamentos que perdem o usuário.
- **Checkout → compra: 30%** (570 checkouts → 171 compras). **399 pessoas iniciaram o checkout e não compraram** — a R$ 18 por checkout, são ~R$ 7,2 mil de mídia paga em pessoas que chegaram à última etapa e ninguém recuperou (sem campanha de carrinho abandonado ativa no período).

### D. Tracking com atribuição degradada
Qualidade do pixel principal (Pixel Sevilha Educação, 628950800951703):

| Evento | EMQ | Problema |
|---|---|---|
| Purchase | 6,9 (bom) | CAPI em tempo real ✅, mas **fbc e fbp = 0%** — a compra chega sem o identificador do clique/navegador |
| PageView / InitiateCheckout | 4,4 (médio-baixo) | **fbc = 0%**, sem advanced matching (email/telefone = 0%) |

`fbc` zerado em todos os eventos indica que o **fbclid se perde entre o anúncio e a página** (consistente com o vazamento clique→LPV do item C). Consequência: a Meta atribui menos compras ao anúncio, otimiza com menos sinal e o ROAS real é maior do que o painel mostra — mas o algoritmo aprende menos.

Além disso, há **4 datasets ativos** no business (Pixel Sevilha Educação, Backup, SEVILHADAY, SEVILHADAY 2) — fragmentação de sinal e risco de evento duplicado.

### E. Demografia: núcleo claro em 35–54, desperdício em 65+
- COLD: melhor faixa **35–44 (ROAS 1,42, CPA R$ 57,69)**; **65+ queimou R$ 795,94 com ROAS 0,45**; 45–54 medíocre no frio (0,73) mas excelente no quente.
- HOT: **45–54 é ouro (ROAS 2,14, CPA R$ 45,08)**.
- CPM sobe forte com a idade: R$ 27–38 (25–44) vs R$ 69–90 (55+).

### F. Posicionamentos: Instagram carrega o volume, Facebook é mais barato no frio
- Instagram = 83% do gasto (ROAS 1,04–1,27).
- No COLD, Facebook entregou **CPA R$ 50,78 vs R$ 71,07 do Instagram** (ROAS menor por ticket, mas custo de aquisição 29% menor).
- Audience Network/Messenger/Threads: gasto irrelevante, ok.

### G. Contexto de custo
CPM médio de R$ 47,78 no frio é salgado; CTR 1,24% é mediano. Com criativo mais nativo e copy mais longa (mais sinal de segmentação para o algoritmo), há espaço para derrubar CPM/CPA. Frequência semanal ~1,9–2,2 em prospecção fria está no teto da banda segura — com reach de apenas 46,7 mil no COLD em 4 semanas, a audiência efetiva está estreita para uma campanha Advantage+.

### H. Higiene de conta
Dezenas de campanhas pausadas de 2021–2025 (IRPF, Simples Nacional, Caixa Preta etc.) e a conta Vicente parada desde 2024. Não afeta entrega, mas polui análise e decisão.

---

## 3. Plano de ação priorizado

### 🔴 Imediato (esta semana)

1. **Religar a captação** — a conta está no escuro há 5 semanas e a estrutura estava melhorando quando foi pausada. Estrutura recomendada (mesma audiência, orçamento protegido):
   - **Campanha de escala (CBO, ~80% do orçamento):** AD07 + AD08 (comprovados) + 1 melhor variação nova.
   - **Campanha de teste (~20%):** novos conceitos, 3–5 estáticos por semana iterando o ângulo do AD07/AD08 (hook primeiro, depois visual, formato e copy).
2. **Excluir 65+ do público frio** (ROAS 0,45) e concentrar 35–54. Manter 45–54 forte no remarketing.
3. **Campanha de recuperação de checkout** (janela 7 dias) para quem iniciou e não comprou + fluxo de WhatsApp/e-mail. São ~400 pessoas/mês nessa situação. Usar os 4 tipos de anúncio de remarketing: quebra de objeção, carrossel de prova social, outra oferta e conteúdo de valor.
4. **Consertar o tracking (1 dia de dev):**
   - Persistir o `fbclid` na landing page (cookie `_fbc`) e enviá-lo nos eventos web e no Purchase via CAPI;
   - Ativar advanced matching (email/telefone) nos eventos do navegador, especialmente InitiateCheckout;
   - Consolidar tudo no Pixel Sevilha Educação e desativar os datasets duplicados (SEVILHADAY / SEVILHADAY 2 / Backup).

### 🟡 Próximos 30 dias

5. **Regras objetivas de corte e escala** (ancoradas no ticket de ~R$ 63):
   - *Matar:* gasto ≥ R$ 190 (3× ticket) com ROAS < 0,7 — o caso AD06 teria sido cortado no dia 10, não no dia 30;
   - *Monitorar:* ROAS 0,7–1,1;
   - *Escalar:* ROAS ≥ 1,3 por 2 semanas → +20% de orçamento a cada 5 dias (nunca +30% de uma vez);
   - *Nunca pausar sem substituto pronto* — manter 2–3 iterações na fila.
6. **Landing page e checkout:**
   - Meta clique→LPV ≥ 65% (peso da página, remover redirects — mesmo problema do fbclid);
   - Meta checkout→compra ≥ 40%: Pix com desconto em destaque, prova social no checkout, garantia visível, order bump simples;
   - Espelhar a headline do AD07 no topo da LP (congruência anúncio→página).
7. **Medir o back-end:** subir as vendas da Imersão/produtos de maior ticket como conversões offline/CRM no pixel. Sem isso, o ROAS 1,05 da captação não diz se a esteira é lucrativa — e o CPA máximo permitido no frio fica no chute.
8. **Teste de posicionamento:** duplicar o vencedor com pressão maior em Facebook Feed/Reels (CPA 29% menor no frio).

### 🟢 Contínuo

9. **Cadência semanal:** segunda = decisão (dados 14d, aplicar kill rules); quarta = lançamento de testes; sexta = escala/rollback. Mensal: auditoria de criativos + revisão do CPA-teto.
10. **Fábrica de criativos de verdade:** o nome da campanha já era esse — falta o volume. 3–5 estáticos novos/semana, copy longa, estética nativa (não-anúncio), variações com keyword de identidade ("para advogados", "para contadores", "para donos de imóveis") para abrir bolsões de público.
11. **Higiene:** arquivar campanhas de 2021–2025 e definir a conta Vicente como desativada ou reserva.

---

## 4. Metas para o relançamento (30 dias)

| Métrica | Junho/26 (real) | Meta |
|---|---|---|
| CPA captação | R$ 60,00 | ≤ R$ 55 |
| ROAS front-end | 1,05 | ≥ 1,30 |
| Clique → LPV | 49,8% | ≥ 65% |
| Checkout → compra | 30% | ≥ 40% |
| Criativos novos/semana | ~0 (após lançamento) | 3–5 |
| Receita back-end rastreada | R$ 0 (não medido) | 100% das vendas da Imersão no pixel |

**Racional:** só a combinação "cortar AD06 no tempo certo + excluir 65+ + recuperar 10% dos checkouts abandonados" já teria levado o mesmo orçamento de junho para ROAS ~1,4–1,5, sem nenhum criativo novo.

---

*Fontes: Meta Ads API (insights de campanha/conjunto/anúncio, breakdowns por idade e posicionamento, série semanal, qualidade de dataset/EMQ, Opportunity Score) — contas 3451731371506645 e 3048052985232837, período 06/05/2026–06/08/2026.*
