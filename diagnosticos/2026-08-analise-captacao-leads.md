# Análise da Captação de Leads — Sevilha Educação

**Conta:** Sevilha Educação - Ueslei (3451731371506645)
**Janela analisada:** jan/2025 a ago/2026 (a captação de leads rodou efetivamente de jul/2025 a dez/2025)
**Data da análise:** 06/08/2026
**Complementa:** [Diagnóstico Meta Ads mai–ago/2026](2026-08-diagnostico-meta-ads.md)

---

## 1. Resumo executivo

- **A captação de leads está desligada desde o fim de dezembro/2025** (~7 meses). Desde então a conta só rodou venda direta do low-ticket (IHO, junho/26). O evento `Lead` do pixel hoje não tem volume.
- O projeto de captação real foi o **SE-HOLDING** (ago–dez/25): **R$ 22,8 mil investidos → ~1.770 leads → CPL médio R$ 12,87**, com landing page performando muito melhor que formulário nativo.
- **O CPL nunca foi o problema — a qualidade foi.** O custo por lead ficou entre R$ 4,68 e R$ 16 o tempo todo, mas a taxa de MQL despencou de **30% (ago/25) para 6,5% (out/25)** e o custo por MQL foi de R$ 29,72 para R$ 104,54 sem que criativo ou público fossem renovados.
- **Agosto/2025 é o blueprint:** LP + otimização em Lead MQL + criativos frescos = 45 MQLs no frio a R$ 29,72 cada, com 30% de taxa de qualificação. É esse setup que deve ser religado — com as correções de fadiga abaixo.

### Consolidado por campanha (ciclo completo)

| Campanha | Período | Invest. | Leads | CPL | MQLs | Custo/MQL | Taxa MQL | Freq. acum. |
|---|---|---|---|---|---|---|---|---|
| [SE-HOLDING] [LEAD] [COLD] (LP) | ago–dez/25 | R$ 8.579,92 | 987 | **R$ 8,69** | 148 | R$ 57,97 | 15,0% | 2,83 |
| [SE-HOLDING] [LEAD] [HOT] (LP) | ago–dez/25 | R$ 6.418,37 | 396 | R$ 16,21 | 70 | R$ 91,69 | 17,7% | **6,45** ⚠️ |
| [SE-HOLDING] [FORMS NATIVO] [COLD] | out–dez/25 | R$ 4.515,97 | 216 | R$ 20,91 | não medido | — | — | 2,33 |
| [SE-HOLDING] [FORMS NATIVO] [HOT] | out–dez/25 | R$ 3.270,78 | 171 | R$ 19,13 | não medido | — | — | 4,27 |
| Iterações jul/25 (6 recriações) | jul/25 | ~R$ 2.470 | ~119 | R$ 12–25 | ~26 | variado | — | — |
| HOLDING_DEZ24 (cadastro) | dez/24–jan/25 | R$ 1.226,83 | — | — | 4 EndForm | R$ 167,81 | — | — |
| **Total captação** | | **≈ R$ 26,3 mil** | **≈ 1.953** | **≈ R$ 13,48** | ~244 | ~R$ 68 (nas 2 principais) | | |

---

## 2. A história em 5 atos

### Ato 1 — Julho/25: o falso começo (R$ 2,4 mil queimados em resets)
Em 8 dias (16 a 23/jul) a campanha de teste foi **recriada 6 vezes**, cada vez otimizando para um evento diferente: `Website leads` → `EndForm` → `Lead quente` → `Lead morno` → `Lead MQL`. Cada troca de evento reseta o aprendizado do algoritmo — nenhuma versão chegou a acumular sinal. Lição: **o evento de otimização se escolhe uma vez, antes de ligar.**

### Ato 2 — Agosto/25: o mês que funcionou (blueprint)
Estabilizado em `Lead MQL` com landing page:

| Métrica (COLD, ago/25) | Valor |
|---|---|
| Investimento | R$ 1.337,19 |
| Leads | 151 (CPL R$ 8,86) |
| MQLs | 45 → **custo/MQL R$ 29,72** |
| **Taxa MQL** | **29,8%** |
| CTR | 2,09% |

O HOT somou mais 26 MQLs a R$ 46,92. Melhor mês da captação em toda a história da conta.

### Ato 3 — Set–Nov/25: CPL estável, qualidade derretendo
Evolução mensal do COLD (LP):

| Mês | Invest. | Leads | CPL | MQLs | Custo/MQL | Taxa MQL | CTR |
|---|---|---|---|---|---|---|---|
| Ago/25 | R$ 1.337 | 151 | R$ 8,86 | 45 | R$ 29,72 | **29,8%** | 2,09% |
| Set/25 | R$ 2.122 | 234 | R$ 9,07 | 31 | R$ 68,45 | 13,2% | 1,68% |
| Out/25 | R$ 1.150 | 168 | R$ 6,85 | 11 | **R$ 104,54** | **6,5%** | 1,93% |
| Nov/25 | R$ 1.552 | 146 | R$ 10,63 | 24 | R$ 64,68 | 16,4% | 2,30% |
| Dez/25 | R$ 309 | 66 | R$ 4,68 | 6 | R$ 51,49 | 9,1% | 3,01% |

O padrão é clássico de **fadiga de criativo com drift de audiência**: o CPL cai e o CTR até sobe (dez: CTR 3,01%, CPL R$ 4,68 — os melhores números "de vaidade" da série), mas o algoritmo passa a entregar para bolsões de clique barato que não qualificam. **Os mesmos 2 criativos (AD04 e AD01) rodaram os 5 meses inteiros sem renovação.**

No HOT, o mesmo filme com agravante de saturação: frequência mensal chegou a **4,10 em setembro** (6,45 acumulada) num público de só 17 mil pessoas — custo/MQL foi a R$ 115–145.

### Ato 4 — Out–Dez/25: o teste de Forms Nativo (perdeu para a LP)
| | LP (COLD) | Forms Nativo (COLD) |
|---|---|---|
| CPL | R$ 8,69 | R$ 20,91 (**2,4× mais caro**) |
| Medição de qualidade | Lead MQL no pixel | **nenhuma** (`leadgen.other`) |

Contra-intuitivo (forms nativo costuma baratear o lead bruto) — aqui encareceu e ainda tirou a visibilidade de qualificação. Provável combinação de: formulário "Mais volume" sem fricção qualificadora, menos variedade criativa (praticamente só AD01/AD02) e sem integração com CRM para devolver o sinal de MQL. **Veredito: a LP venceu com folga.**

### Ato 5 — Jan/26 em diante: captação desligada
A operação pivotou para venda direta low-ticket (IHO, jun/26 — ver diagnóstico anterior). Resultado: a conta hoje **compra compradores mas não constrói lista**, e os ~400 abandonos de checkout/mês do IHO não são capturados como leads.

---

## 3. Criativos: o que os dados dizem

| Criativo | Invest. total | Leads | CPL | MQLs | Custo/MQL | Leitura |
|---|---|---|---|---|---|---|
| **AD04 — "Holdings Assessoria Prática para Impulsionar"** | R$ 5.137,67 | 653 | **R$ 7,87** | 91 | R$ 56,46 | Cavalo de batalha: 60% dos leads do projeto. CTR 1,6–2,3% |
| AD01 (LP) | R$ 3.622,78 | 265 | R$ 13,67 | 48 | R$ 75,47 | Rodou até freq. 5,30 no HOT — saturado, não pausado |
| AD03 — "Proteja seu patrimônio e planeje o futuro" | ~R$ 310 | 28 | R$ 6,34–12,38 | 7 | ~R$ 44 | **Melhor CTR da conta (2,6–3,0%) e subtestado** — candidato nº 1 do relance |
| AD05 — "Holdings" | ~R$ 481 | 45 | R$ 7,87–19 | 9 | ~R$ 53 | Decente, subtestado |
| AD02 | ~R$ 970 | 63 | R$ 10–16 | 11 | R$ 97,71 (principal) | Perdedor relativo em qualidade |
| AD01/AD02 (Forms) | R$ 3.545 | 192 | R$ 17,50–32 | — | — | Todo o teste de forms rodou com 2 criativos |

Ângulo vencedor claro: **"assessoria prática" (AD04)** para volume + **"proteção patrimonial" (AD03)** como desafiante de qualidade. O portfólio inteiro foram ~5 conceitos em 5 meses — o mesmo déficit de volume criativo apontado no diagnóstico de vendas.

---

## 4. O problema estrutural: volume de sinal

No pico, a captação gerava **~14 MQLs/semana** — muito abaixo das ~50 conversões/semana que o algoritmo precisa para sair da fase de aprendizado otimizando por `Lead MQL`. Com R$ 80/dia de orçamento, a campanha viveu permanentemente em learning limitado.

Caminhos possíveis no relance (escolher um):
1. **Otimizar para `Lead` padrão** (~45–50/semana no histórico — no limiar) e qualificar via página/formulário, usando Lead MQL como métrica de avaliação semanal, não de otimização; **ou**
2. Manter otimização em MQL com orçamento dimensionado para ~50 MQL/semana (custo/MQL alvo R$ 45 → ~R$ 2.250/semana ≈ R$ 320/dia); **ou**
3. Híbrido: começar em `Lead` até acumular sinal e migrar para MQL quando o volume permitir.

⚠️ **Auditar o gatilho do evento `Lead MQL`** antes de religar: é um evento custom e a queda de taxa MQL entre meses pode misturar qualidade real com mudança de critério/disparo. O EMQ do evento Lead está sem dados (sem volume desde dez/25) e sem advanced matching — mesma correção de tracking do diagnóstico anterior.

---

## 5. Plano de ação da captação

### 🔴 Para religar (semana 1)
1. **Reconstituir o setup de ago/25:** LP (não forms), público frio amplo 35–54, campanha COLD como motor (~80%) e HOT como suporte (~20%, não o contrário).
2. **Criativos de largada:** iteração do AD04 (ângulo "assessoria prática") + AD03 escalado (ângulo "proteção patrimonial") + 2 conceitos novos. Nunca menos de 4 ativos.
3. **Evento de otimização definido antes de ligar** (recomendação: opção 1 ou 3 da seção 4) — e **não trocar no meio**.
4. **Corrigir tracking do funil de lead:** advanced matching (e-mail/telefone) no evento Lead, gatilho do Lead MQL auditado e, idealmente, MQL devolvido via CAPI pelo CRM.

### 🟡 Regras de operação (o que faltou em set–dez/25)
5. **Renovação de criativo a cada 14–21 dias** — o colapso de 30% → 6,5% de taxa MQL aconteceu com criativos parados por 5 meses.
6. **Kill/swap por qualidade, não por CPL:** custo/MQL > 1,5× alvo por 2 semanas = troca (o CPL baixo de out–dez/25 mascarou o problema).
7. **Teto de frequência no HOT:** ≤ 2,5/semana; ao bater, reduzir orçamento ou renovar criativo. Freq. 6,45 acumulada em 17 mil pessoas foi queima pura.
8. **Forms nativo só se:** Higher Intent + e-mail corporativo obrigatório + 2–3 perguntas qualificadoras + integração CRM em tempo real. Senão, LP.

### 🟢 Integração com a máquina de vendas (maior alavanca)
9. **Fundir as duas esteiras que hoje rodam alternadas:** lead (R$ 8–13) → tripwire IHO R$ 63 (recupera o custo do lead) → back-end high-ticket. A captação alimenta a venda; a venda paga a captação.
10. **Capturar lead no fluxo de venda:** e-mail/WhatsApp antes do pagamento no checkout do IHO transforma os ~400 abandonos/mês em leads gratuitos para remarketing e e-mail.
11. **Medir o back-end no pixel** (conversões offline/CRM) para finalmente saber quanto vale um MQL — hoje o custo/MQL de R$ 57–92 não tem referência de LTV para julgar se é caro ou barato.

### Metas do relance

| Métrica | Histórico | Meta |
|---|---|---|
| CPL frio (LP) | R$ 8,69 | ≤ R$ 10 |
| Taxa MQL | 15% (média) / 30% (pico) | ≥ 25–30% sustentado |
| Custo/MQL | R$ 58–92 | ≤ R$ 45 |
| Freq. semanal HOT | até 4,10 | ≤ 2,5 |
| Criativos novos/mês | ~1 | 6–8 |
| Conversões/semana no evento otimizado | ~14 | ≥ 45–50 |

---

*Fontes: Meta Ads API — campanhas OUTCOME_LEADS da conta 3451731371506645 (jan/2025–ago/2026), série mensal ago–dez/2025, nível de anúncio das 4 campanhas SE-HOLDING, qualidade de dataset (EMQ). CPLs de campanhas com evento custom usam o campo `lead` do pixel; "custo/resultado" usa o evento otimizado de cada campanha.*
