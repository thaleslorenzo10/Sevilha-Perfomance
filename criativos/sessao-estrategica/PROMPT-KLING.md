# Sessão Estratégica — prompts para geração de vídeo no Kling

Anúncios para a Sessão Estratégica da Sevilha Performance.
Público: donos de contabilidade com até 10 colaboradores.

> **Status:** os prompts de conceito abaixo são um ponto de partida ancorado no que
> já performa na conta. Quando as referências de estático chegarem, o bloco
> `LOOK` de cada prompt é reescrito para reproduzir o estilo delas (paleta,
> tipografia, layout). A estrutura do prompt e os parâmetros não mudam.

---

## Ancoragem (dados da conta, últimos 90 dias)

Conta `1676714556216146`. Só criativo com volume real:

| Criativo | CTR | CPL |
|---|---|---|
| `005 – Está consumido pela operação da contabilidade` (VICENTE) | 1,02% | R$ 9,73 – 12,95 |
| `AD21 – Equipe sobrecarregada?` | 1,37% | R$ 12,95 |
| `AD01 VIDEO – Transforme sua empresa com nossa metodologia` | 1,10 – 1,55% | R$ 11,40 – 20,10 |
| `AD29`, `AD31` | 1,10 – 1,39% | R$ 15,49 – 20,28 |
| `AD18`, `AD23`, `AD25` | ~1,0% | R$ 52 – 77 |

**Leitura:** o que segura CPL abaixo de R$ 15 é **nomear a dor operacional do dono**
("consumido pela operação", "equipe sobrecarregada"). O que estoura CPL é promessa
genérica de transformação. Todo conceito novo entra por dor, não por resultado.

**Regra de aterramento:** nenhum número, depoimento ou claim que não esteja na
landing page. Os únicos dados usáveis: `+450 contabilidades atendidas`,
`35+ anos de mercado`, `3 mentores`, `até 10 colaboradores`.

---

## Como o prompt do Kling é montado

O Kling não escreve texto legível de forma confiável e não faz direção de arte —
ele **anima o que já existe no frame**. Por isso o fluxo é:

```
frame estático no estilo da referência  →  Kling image2video  →  clipe 5s
        (Nano Banana / Flux / Figma)          (movimento sutil)
```

O prompt do Kling tem quatro blocos, sempre nessa ordem:

| Bloco | O que entra | Erro comum |
|---|---|---|
| `LOOK` | Estilo visual do frame, herdado da referência | Descrever estilo diferente do frame → o Kling "corrige" a imagem |
| `MOVIMENTO` | **UM** movimento literal ligado ao conceito | Dois movimentos → vira ruído na velocidade do feed |
| `AMBIENTE` | Movimento secundário sutil (poeira, luz, push-in lento) | Movimento de câmera agressivo |
| `TRAVA` | "a composição permanece exatamente como está" | Omitir → o Kling troca a cena no segundo 4 |

**Prompt em inglês.** O Kling responde bem melhor em inglês do que em português —
o texto que aparece na peça continua em PT-BR, mas vem do frame estático, não do prompt.

**Nunca escreva "no hands" / "sem mãos".** Prompt negativo com "hands" é armadilha
de atenção e faz o modelo inserir mãos fotorrealistas na cena. Descreva o movimento
como pertencendo aos objetos.

---

## Prompt negativo padrão (usar em todos)

```
extra text, new text, watermark, logo change, morphing, scene change, camera whip,
face distortion, extra fingers, subtitles, letterboxing, style drift, photorealistic
render of an illustrated frame, blurry, low quality
```

---

## Parâmetros de chamada

| Parâmetro | Valor | Por quê |
|---|---|---|
| `model_name` | `kling-v2-6` | Última geração; áudio nativo disponível. `kling-v2-5-turbo` se quiser reduzir custo. |
| `mode` | `pro` | `std` derrapa em tipografia — e a peça tem texto no frame. |
| `duration` | `5` | Hook de feed. Só use `10` se o conceito tiver 2 beats. |
| `aspect_ratio` | herdado da imagem no image2video | Ver nota de formato abaixo. |
| `cfg_scale` | `0.5` | Acima disso o modelo endurece o movimento. |

**Formato.** O Kling entrega `16:9`, `9:16` e `1:1`. O Meta pede `4:5` no feed.
Gere o frame estático **direto em 4:5**, mande no `image2video` (o vídeo sai na
proporção da imagem) e gere um frame separado em `9:16` para Reels/Stories —
não corte o 4:5 para virar 9:16, o texto some.

---

## Conceito 1 — "A pilha que cresce" (dor operacional)

Ancorado no criativo de menor CPL da conta (`005 – Está consumido pela operação`).

**Frame estático (briefing para o gerador de imagem):**
Dono de contabilidade, 45-55 anos, sentado à mesa, imóvel, olhando para frente.
Ao redor: pilhas de guias, DARFs, pastas. Headline na peça: `Você não tem um
escritório. Você tem um plantão.` Selo inferior: `Sessão Estratégica · Sevilha Performance`.

**Prompt Kling (image2video):**
```
Subtle living motion of the existing elements only. The stacks of paper documents
surrounding the seated man slowly grow taller, sheet by sheet, creeping upward and
closing in around him while he stays completely still, eyes fixed forward. Ambient:
faint dust motes drift through the desk lamp light, very slow push-in. Every element
visible now is the only thing that ever appears; the composition stays exactly as it
is. The graphic style stays exactly as in the source frame. No camera whip, no scene
change, no morphing, no added text.
```

---

## Conceito 2 — "A cadeira vazia" (o negócio para sem você)

Ancorado em `Quando você tira um dia de folga, algo quebra ou para` (landing page).

**Frame estático:**
Sala de escritório contábil vista de cima, quatro mesas ocupadas, a mesa do dono
vazia — cadeira girada. Headline: `Tire uma semana de férias. Descubra quanto o
escritório depende de você.`

**Prompt Kling (image2video):**
```
Subtle living motion of the existing elements only. The empty chair at the owner's
desk rotates slowly to a full stop while every other person in the room freezes
mid-task, papers held in the air, nobody moving. Ambient: overhead fluorescent light
flickers once, very slow push-in. Every element visible now is the only thing that
ever appears; the composition stays exactly as it is. The graphic style stays exactly
as in the source frame. No camera whip, no scene change, no morphing, no added text.
```

---

## Conceito 3 — "Faturamento sobe, margem não" (dor financeira)

Ancorado em `O faturamento cresce, mas a margem não acompanha` (landing page).

**Frame estático:**
Dois gráficos de barra lado a lado num quadro branco. À esquerda, `FATURAMENTO`,
barras altas. À direita, `MARGEM`, barras rasas. Headline: `Cresceu 40%. Sobrou o
mesmo.` Selo inferior com o CTA.

**Prompt Kling (image2video):**
```
Subtle living motion of the existing elements only. The bars in the left chart labeled
FATURAMENTO grow steadily upward while the bars in the right chart labeled MARGEM stay
completely flat, not moving at all. Ambient: the whiteboard surface catches a faint
slow light sweep, very slow push-in. Every element visible now is the only thing that
ever appears; the composition stays exactly as it is. The graphic style stays exactly
as in the source frame. No camera whip, no scene change, no morphing, no added text.
```

---

## Copy de acompanhamento (Meta feed)

Limites: texto principal 125 caracteres visíveis, título 40, descrição 30.

**Conceito 1**
- Texto principal: `Você domina a técnica. Ninguém te ensinou a gerir. É por isso que o escritório não anda sem você.` (99)
- Título: `Sessão Estratégica gratuita` (27)
- Descrição: `Para donos de contabilidade` (26)

**Conceito 2**
- Texto principal: `Se você sumir uma semana, o que quebra? A resposta é o diagnóstico do seu escritório.` (85)
- Título: `Seu escritório depende de você?` (31)
- Descrição: `Até 10 colaboradores` (20)

**Conceito 3**
- Texto principal: `Faturamento subiu, margem não. Não é preço — é gestão. Descubra onde está o vazamento.` (86)
- Título: `Cresceu 40%. Sobrou o mesmo.` (28)
- Descrição: `Sessão Estratégica` (18)

---

## QC antes de subir

- [ ] Assistir **os últimos 2 segundos** de cada clipe — é onde entra objeto intruso e deriva de estilo. Corta antes ou regera.
- [ ] Nenhuma mão fotorrealista entrando em quadro.
- [ ] Headline do frame legível com o vídeo em 100% de velocidade, som desligado.
- [ ] Nenhum texto novo inventado pelo modelo.
- [ ] Marca/selo visível no primeiro frame (autoplay sem som).
- [ ] Meta e TikTok exigem rótulo de conteúdo gerado por IA — marcar na subida.

---

## Uso do script

```bash
export KLING_ACCESS_KEY=...
export KLING_SECRET_KEY=...

# anima um frame estático (caminho recomendado)
node criativos/sessao-estrategica/kling.js image2video \
  --image ./frames/conceito-1-4x5.png \
  --prompt-file ./criativos/sessao-estrategica/prompts/conceito-1.txt \
  --out ./criativos/sessao-estrategica/out/conceito-1.mp4

# gera do zero, sem frame de referência
node criativos/sessao-estrategica/kling.js text2video \
  --prompt "..." --aspect-ratio 9:16 \
  --out ./criativos/sessao-estrategica/out/teste.mp4
```
