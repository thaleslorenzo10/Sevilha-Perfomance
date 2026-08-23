---
target: mentoria/index.html
total_score: 21
max_score: 36
na_heuristics: 7
p0_count: 2
p1_count: 2
timestamp: 2026-08-23T15-28-06Z
slug: mentoria-index-html
---
**Method: dual-agent** (A: revisão de design · B: detector + navegador, isolados, em paralelo)

## Design Health Score

| # | Heurística | Nota | Problema central |
|---|---|---|---|
| 1 | Visibilidade do status | 2/4 | `SP_handleSubmit` chama `onSuccess()` no `.catch` — mostra "Solicitação enviada" quando o POST falhou. |
| 2 | Sistema ↔ mundo real | 3/4 | Três nomes para a mesma coisa: "Sessão Estratégica" / "diagnóstico" / "reunião". |
| 3 | Controle e liberdade | 2/4 | Redirect para o WhatsApp em 800ms sem cancelar. Modal sem focus trap nem restauração de foco. |
| 4 | Consistência e padrões | 2/4 | Quatro rótulos de CTA para uma ação; `href="#"` na sticky e na final vs `#agendar` nas outras. |
| 5 | Prevenção de erro | 1/4 | Formulário aceita "De 0 a 4" e "De 5 a 9" numa página que promete 10+ em quatro lugares. Dispara Lead. |
| 6 | Reconhecer em vez de lembrar | 3/4 | Card "Como funciona" bom, mas some no resto da página; modal nunca repete R$ 0,00. |
| 7 | Flexibilidade e eficiência | n/a | Funil de ação única em superfície Persuade. |
| 8 | Estética e minimalismo | 2/4 | 7.836px de scroll no mobile; seis cards de pilar sem CTA no trecho. |
| 9 | Recuperação de erro | 1/4 | Não existe estado de erro. Nenhuma `.form-error`, nenhum branch de falha, nenhum retry. |
| 10 | Ajuda e documentação | 3/4 | FAQ responde as cinco objeções reais; colapsada e ~6.000px depois da ansiedade. |
| **Total** | | **21/36** | Bem argumentada, mal encanada |

Heurísticas de apresentação (2, 6, 10) tiram 3; heurísticas de transação (5, 9) tiram 1.

## Design Specificity

Template com skin de marca. Copy autoral, design não: sete seções, todas módulo de estoque, na ordem de estoque. A consultoria vende diagnóstico estrutural e a página não tem nenhuma estrutura desenhada. Seis emoji como sistema de ícones.

Detector: exit 2, 1 achado (`dark-glow`, sem número de linha) — falso positivo, as sombras são elevação com offset em superfície clara. Dois ignores persistidos aplicados.

Divergência A vs B em axe: B mediu 0 violações no desktop e 1 no mobile (`region` na `.sticky-cta`), e resolveu na mão os 34 "incomplete": falhas reais de contraste em `.modal-tag` (2,46:1), `.tick` (~2,46:1), `.sym` ✓ (2,73:1), `+` da FAQ (2,73:1), `.sym` ✕ (4,20:1). Todas ancoradas em `--green-d: #22b524` e `--red: #e04141` como cor de texto.

## O que funciona

1. Coluna de desqualificação como ativo de conversão — sinaliza mais demanda que capacidade e lisonjeia quem está do lado certo da linha.
2. R$ 0,00 renderizado como preço ocupa o slot visual onde o olho espera um número; três registros sem fadiga.
3. Arquitetura de CTA no mobile: CTA do hero cai em y=797 numa viewport de 844px; a barra fixa é a única ação alcançável.

## Problemas prioritários

**[P0] Tranquilização abaixo da dobra no momento de risco máximo.** Modal de 902px em viewport de 844px; botão cortado, linha do cadeado fora da tela. Fix: faixa de confiança acima dos campos, `max-height: calc(100dvh - 32px)` com scroll interno e botão fixo, cortar `focus()` no touch. → /impeccable polish

**[P0] O formulário aceita quem a página desqualifica.** Sub-10 é aceito e dispara Lead, degradando a otimização do Meta. Fix: ramificar no select, rotear para o Clube da Performance que já existe no repo. → /impeccable harden

**[P1] Sucesso mostrado quando o envio falha; não existe estado de erro.** `onSuccess()` dentro do `.catch` em tracking.js. Fix: estado de erro com retry + link direto de WhatsApp. → /impeccable harden

**[P1] Emoji e retratos de 92px destroem as seções de credibilidade.** Fotos de 281×358px renderizadas a 92px com anel verde; rostos com ~30px. Fix: SVG inline no lugar dos emoji; card horizontal com retrato de 140–160px e papel específico de cada consultor. → /impeccable typeset + layout

**[P2] Contraste reprovando em 6 grupos + defeitos de a11y no modal.** Sem focus trap, sem restauração de foco, `.sticky-cta` fora de landmark, FAQ sem `aria-expanded`, ✕ com 17×22px. → /impeccable audit

## Persona red flags

**Marcelo, 52, 24 colaboradores, iPhone, 21h40:** fecha a aba na faixa de emoji; abandona no quarto campo do modal; "35+ anos" vs "duas décadas" vs "20 anos" lê como desleixo numa consultoria de performance.

**Patrícia, 38, sócia-gerente de 14:** três fichas verdes sem saber qual consultor a atenderia; zero prova social verificável; duração da sessão não aparece em lugar nenhum.

**Eduardo, 45, escritório de 8:** avisado quatro vezes que não qualifica, aceito pelo formulário, recusado por humano; é lead qualificado para outro produto do mesmo repo e é descartado.

## Observações menores

Modal de 853px corta em laptop 1440×800. `.hero-card` centralizado deixa vazio no topo direito. `--teal` é quarta cor de marca só para eyebrow. `loading="lazy"` na única prova social. `gtag` com placeholder literal `AW-XXXXXXXXXX` disparando requisições reais. Botão "Abrir o WhatsApp" é UI morta. Sem og:image/og:title, favicon 404. Peso ~679KB, Meta Pixel 534KB (79%). LCP 260–296ms, CLS 0–0,02, console limpo, zero overflow horizontal.

## Perguntas

1. Vende diagnóstico estrutural e não desenha nenhuma estrutura — por quê?
2. O visitante sub-10 é refugo ou ativo?
3. O que cortaria se a página tivesse que caber em uma tela mais uma rolagem?
