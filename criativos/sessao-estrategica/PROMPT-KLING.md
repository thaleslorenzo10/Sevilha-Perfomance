# Sessão Estratégica — criativos (Kling)

Anúncios da Sessão Estratégica da Sevilha Performance, no sistema visual das
referências enviadas, com a paleta da marca.

- **Público:** donos de contabilidade com até 10 colaboradores
- **Oferta:** sessão de diagnóstico **gratuita**
- **Destino:** https://form.respondi.app/gvz4UKQr
- **Formato:** 4:5 (feed) + 9:16 (Reels/Stories)
- **Peças prontas:** conceitos 2, 4, 5 e 6 em `out/` (4:5; o conceito 2 também em 9:16)

## Lacunas a preencher antes de gerar

Marcadas como `[SLOT]` nos prompts. Não inventar — cada uma vira claim no criativo.

| Slot | O que é |
|---|---|
| `[DURACAO]` | Duração da sessão (30 min? 45? 1h?) — a ref B constrói a peça inteira em cima disso |
| `[QUEM_CONDUZ]` | Quem atende: Vicente? os 3 mentores? o time? |
| `[ENTREGAVEL]` | O que o dono sai com na mão (relatório? plano? nada formal?) |
| `[PERGUNTAS_FORM]` | O que o formulário pergunta — define a promessa da peça |

Fatos já confirmados e usáveis: `+450 contabilidades atendidas`, `35+ anos de mercado`,
`3 mentores`, `até 10 colaboradores`, `gratuita`.

---

## Ancoragem (conta 1676714556216146, últimos 90 dias)

| Criativo | CTR | CPL |
|---|---|---|
| `005 – Está consumido pela operação da contabilidade` (VICENTE) | 1,02% | **R$ 9,73 – 12,95** |
| `AD21 – Equipe sobrecarregada?` | 1,37% | R$ 12,95 |
| `AD01 VIDEO – Transforme sua empresa com nossa metodologia` | 1,10 – 1,55% | R$ 11,40 – 20,10 |
| `AD18`, `AD23`, `AD25` | ~1,0% | R$ 52 – 77 |

**Leitura:** o que segura CPL abaixo de R$ 15 é nomear a dor operacional do dono.
Promessa genérica de transformação estoura o CPL. Os três conceitos entram por dor.

---

## Sistema visual (extraído das referências)

Layout das refs A e B, paleta da Sevilha.

| Token | Valor |
|---|---|
| `FIELD` | `#0B0D22` — navy `#1a1c48` escurecido, com vinheta radial |
| `INK` | `#FFFFFF` na headline · `rgba(255,255,255,0.72)` no subhead |
| `ACCENT` | `#2BBFA0` na frase-chave da headline e na rim light |
| `CTA` | gradiente `#3DD63A → #2BBFA0 → #29B4F6` (é o `.btn` da landing page), texto branco |
| `TYPE` | headline em condensada bold uppercase (Anton / Oswald Bold), leading 0.85, tracking −2%, alinhada à esquerda · subhead em Poppins 500 |
| Composição | headline no terço esquerdo · sujeito recortado à direita sangrando na borda · logo topo-esquerdo mono branco · CTA na base |

Sobre a tipografia: a marca é Poppins, mas o impacto das referências vem da
**condensada**. Poppins não é condensada. Recomendação: Anton só na headline,
Poppins no resto — a marca continua legível e a peça mantém o soco da referência.

---

## Pipeline — por que em camadas

O Kling é modelo de vídeo: ele **deforma texto**. Essas peças são 70% tipografia.
Jogar o anúncio montado no `image2video` derrete a headline.

```
   prompt de cena
        ↓  etapa 1: Kling images/generations
   PLATE — cena escura, SEM NENHUM TEXTO
        ↓
        ├─ estático: compor.py desenha a tipografia vetorial  → .png 4:5 / 9:16
        └─ vídeo:    Kling image2video anima o plate (5s)
                     → overlay da mesma tipografia via ffmpeg → .mp4
```

O texto nunca passa pelo modelo generativo — nem na imagem, nem no vídeo. É o que
garante headline nítida, acento na cor certa e CTA no gradiente da marca.

---

## Conceito 1 — Vicente · "quem não para é você"

Adapta a ref A (pessoa recortada à direita, rim light).

**Headline (camada de tipografia, não vai no prompt):**
```
SEU ESCRITÓRIO
NÃO PARA.
QUEM NÃO PARA
É VOCÊ.            ← esta linha em ACCENT
```
**Subhead:** `[DURACAO] com quem já acompanhou +450 contabilidades. Diagnóstico do seu escritório contábil.`
**CTA:** `AGENDAR DIAGNÓSTICO`

### Etapa 0 — plate a partir da foto do Vicente

A foto enviada é retrato corporativo em fundo branco. Precisa virar cena escura antes
de animar. Prompt de edição (Nano Banana Pro, com a foto do Vicente como referência):

```
Relight this man for a dark cinematic stage scene, preserving his exact facial
features, hair, and identity. Replace the white background with a deep near-black
navy void (#0B0D22) with a soft radial vignette. Keep him in the same navy blazer and
light blue open-collar shirt. Add a soft teal rim light (#2BBFA0) tracing the right
edge of his head, shoulder and jaw, separating him from the background. Low-key key
light from the front left, deep shadows. Reframe as a three-quarter body shot, subject
positioned on the RIGHT side of a 4:5 vertical frame, cropped so his shoulder bleeds
off the right edge, with the entire left half of the frame left as empty dark
background. Photographic, sharp, editorial. No text, no logo, no graphics anywhere in
the image.
```

> A metade esquerda vazia é obrigatória — é onde a headline entra na etapa 2.
> Uma foto real do Vicente em palco escuro bate qualquer edição. Se existir, usa.

### Etapa 1 — prompt Kling (image2video)

```
Subtle living motion of the existing elements only. The man breathes, blinks
naturally, and makes one small confident turn of his head toward the camera, his
expression steady and serious. Ambient: the teal rim light along his shoulder shifts
slowly, faint dust motes drift through the dark air, very slow push-in. Every element
visible now is the only thing that ever appears; the composition stays exactly as it
is, the left half of the frame stays empty dark background. Photographic and sharp
throughout. No camera whip, no scene change, no morphing, no added text.
```

---

## Conceito 2 — Ampulheta · o custo de não decidir

Adapta a ref B (objeto simbólico com spotlight). É a que mais performa como formato
de agendamento — mecanismo de contraste de tempo, palavras próprias.

**Headline** (fechada — não depende de nenhum slot):
```
UMA CONVERSA
OLHANDO OS
SEUS NÚMEROS.
OU MAIS UM ANO
NO ACHISMO.       ← estas duas linhas em ACCENT
```
**Subhead:** `Diagnóstico gratuito do seu escritório, com quem já acompanhou +450 contabilidades.`
**CTA:** `AGENDAR DIAGNÓSTICO`

Com a duração confirmada, a primeira linha vira `30 MINUTOS` / `45 MINUTOS` — é o
mecanismo original da ref B e fica mais forte. O texto vive em `PECAS` no `compor.py`.

### Etapa 0 — plate

```
A tall elegant hourglass standing on a dark reflective wooden surface, most of the
sand already fallen to the bottom bulb. Deep near-black navy background (#0B0D22) with
a strong narrow spotlight beam falling from directly above, catching the glass and the
sand. The sand glows warm amber against the cold dark field; a soft teal (#2BBFA0)
edge light traces the left curve of the glass. Long soft shadow on the surface. Object
positioned on the RIGHT side of a 4:5 vertical frame, the entire left half left as
empty dark background. Photographic, cinematic, high contrast, shallow depth of field.
No text, no logo, no graphics anywhere in the image.
```

### Etapa 1 — prompt Kling (image2video)

```
Subtle living motion of the existing elements only. Sand falls from the upper bulb of
the hourglass in a thin steady continuous stream, grains settling into the growing
cone below. Ambient: fine dust motes drift slowly through the overhead spotlight beam,
very slow push-in. Every element visible now is the only thing that ever appears; the
composition stays exactly as it is, the left half of the frame stays empty dark
background. Photographic and sharp throughout. No camera whip, no scene change, no
morphing, no added text.
```

---

## Conceito 3 — Mockup do diagnóstico

Adapta a ref C (banner de nicho + mockup inclinado + barra de revelação). Ancoragem
em tempo, não em preço — a sessão é gratuita e sem venda, então não há valor a ancorar.

**Banner topo:** `EXCLUSIVO PARA DONOS DE CONTABILIDADE` (faixa ACCENT, texto branco)
**Headline:** `O RAIO-X QUE VOCÊ NUNCA FEZ NO PRÓPRIO ESCRITÓRIO`
**Subhead:** `[ENTREGAVEL] em [DURACAO]. Onde a sua margem está vazando.`
**CTA:** `AGENDAR AGORA`

### Etapa 0 — plate

```
A clean document page shown on a laptop screen, tilted in perspective and floating,
seen from a low three-quarter angle. The document is a business diagnostic report with
section headings and simple bar charts, rendered small and out of focus so no text is
legible. Deep near-black navy background (#0B0D22) with a soft radial vignette and a
faint teal (#2BBFA0) glow behind the screen. Positioned in the UPPER portion of a 4:5
vertical frame, the lower half left as empty dark background. Photographic product
mockup, crisp edges, subtle reflections. No readable text, no logo, no graphics
anywhere in the image.
```

> Texto ilegível de propósito: o Kling embaralha qualquer letra pequena. A barra de
> revelação e os rótulos entram na camada de tipografia.

### Etapa 1 — prompt Kling (image2video)

```
Subtle living motion of the existing elements only. The tilted screen drifts in a slow
gentle parallax, as if floating, while a soft light reflection sweeps once across its
surface from left to right. Ambient: the teal glow behind the screen pulses very
faintly, very slow push-in. Every element visible now is the only thing that ever
appears; the composition stays exactly as it is, the lower half of the frame stays
empty dark background. Photographic and sharp throughout. No camera whip, no scene
change, no morphing, no added text.
```

---

## Conceito 4 — Pilha de papel · "plantão"

O ângulo de menor CPL da conta (`005 – Está consumido pela operação`), traduzido em
objeto. Sem pessoa, então não depende de foto de ninguém.

**Headline:**
```
VOCÊ NÃO TEM
UM ESCRITÓRIO.
VOCÊ TEM
UM PLANTÃO.       ← estas duas linhas em ACCENT
```

Plate em `prompts/plates/conceito-4-pilha.txt` · peça em `out/conceito-4-4x5.png`

```bash
python3 compor.py --plate plates/conceito-4-pilha-3x4.png --peca conceito-4 \
  --formato 4:5 --coluna 0.58 --out out/conceito-4-4x5.png
```

---

## Conceito 5 — Cadeira vazia · "o que para sem você"

Ancorado em `Quando você tira um dia de folga, algo quebra ou para` (landing page).

**Headline:**
```
TIRE UMA SEMANA
DE FÉRIAS.
VEJA O QUE
PARA.             ← estas duas linhas em ACCENT
```

Plate em `prompts/plates/conceito-5-cadeira.txt` · peça em `out/conceito-5-4x5.png`

```bash
python3 compor.py --plate plates/conceito-5-cadeira-3x4.png --peca conceito-5 \
  --formato 4:5 --zoom 1.1 --anchor-x 0.0 --coluna 0.54 --out out/conceito-5-4x5.png
```

---

## Conceito 6 — Funil · margem que vaza

Ancorado em `O faturamento cresce, mas a margem não acompanha` (landing page).

A primeira tentativa foi "pilha alta de notas ao lado de pilha baixa de moedas" — não
funcionou: o modelo devolveu pilhas de altura parecida e o contraste não lia. O funil
transbordando que pinga uma moeda só resolve, porque a desproporção é do próprio objeto.

**Headline:**
```
O FATURAMENTO
SUBIU.
A MARGEM NÃO
SAIU DO LUGAR.    ← estas duas linhas em ACCENT
```

Plate em `prompts/plates/conceito-6-margem.txt` · peça em `out/conceito-6-4x5.png`

```bash
python3 compor.py --plate plates/conceito-6-margem-3x4.png --peca conceito-6 \
  --formato 4:5 --zoom 1.15 --anchor-x 0.0 --coluna 0.58 --out out/conceito-6-4x5.png
```

---

## Prompt negativo (todos os conceitos)

```
text, letters, words, watermark, logo, subtitles, extra text, morphing, scene change,
camera whip, face distortion, extra fingers, letterboxing, style drift, blurry,
low quality, cartoon, illustration
```

Note que `text` e `letters` entram no negativo: o plate tem que sair limpo.
**Nunca colocar `hands` no negativo** — citar mãos é armadilha de atenção e faz o
modelo enfiar mãos fotorrealistas no quadro.

---

## Parâmetros

| Parâmetro | Valor | Por quê |
|---|---|---|
| `model_name` | `kling-v2-6` | Última geração. `kling-v2-5-turbo` se quiser cortar custo. |
| `mode` | `pro` | `std` derrapa em rosto e em vidro. |
| `duration` | `5` | Hook de feed. |
| `cfg_scale` | `0.5` | Acima disso o movimento endurece. |
| proporção | herdada do plate | Ver abaixo. |

**Formato.** O Kling entrega 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3 e 21:9 — **não tem
4:5** (a API rejeita com `code 1201`). Para o feed do Meta: gere o plate em **3:4** e
recorte para 1080×1350 no `compor.py`. Para Reels, gere um plate **separado** em 9:16
— não corte o 4:5, o enquadramento do objeto quebra.

---

## Etapa 2 — compor a tipografia

Exporte a camada de texto do Figma/Canva como PNG com alpha, no mesmo tamanho do
vídeo (1080×1350 para 4:5), com a metade/terço reservado no plate ficando livre.

```bash
ffmpeg -i plate-animado.mp4 -i tipografia.png \
  -filter_complex "[0:v]scale=1080:1350,setsar=1[bg];[bg][1:v]overlay=0:0" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -an \
  conceito-1-4x5.mp4
```

Para loop de 10s sem gerar 10s no Kling (metade do custo), duplique com pingue-pongue:

```bash
ffmpeg -i conceito-1-4x5.mp4 -filter_complex \
  "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 conceito-1-4x5-10s.mp4
```

---

## Copy de acompanhamento (Meta feed)

Limites: texto principal 125 caracteres visíveis · título 40 · descrição 30.

**Conceito 1**
- Principal: `Seu escritório contábil não trava por falta de técnica. Trava por falta de gestão. Vamos olhar o seu?` (101)
- Título: `Diagnóstico gratuito` (20)
- Descrição: `Donos de contabilidade` (22)

**Conceito 2**
- Principal: `Uma sessão olhando seus números. Ou mais um ano decidindo no achismo. O diagnóstico é gratuito.` (95)
- Título: `Ou mais um ano no achismo` (25)
- Descrição: `Agende sua sessão` (17)

**Conceito 3**
- Principal: `Onde sua margem está vazando? O diagnóstico é gratuito e feito por quem já viu +450 contabilidades.` (99)
- Título: `+450 contabilidades atendidas` (29)
- Descrição: `Diagnóstico gratuito` (20)

**Conceito 4**
- Principal: `Você chega cedo, sai tarde e ainda leva trabalho pra casa. Isso não é dedicação, é falta de gestão.` (99)
- Título: `Diagnóstico gratuito` (20)
- Descrição: `Donos de contabilidade` (22)

**Conceito 5**
- Principal: `Tire um dia de folga e algo quebra. Um escritório que depende de você não é um ativo, é um emprego.` (99)
- Título: `O que para sem você?` (20)
- Descrição: `Agende seu diagnóstico` (22)

**Conceito 6**
- Principal: `Faturamento subindo com margem parada é vazamento, não preço. Descubra onde está o seu.` (87)
- Título: `Margem parada?` (14)
- Descrição: `Diagnóstico gratuito` (20)

CTA do Meta: `Cadastre-se` ou `Saiba mais` · destino `https://form.respondi.app/gvz4UKQr`

---

## QC antes de subir

- [ ] **Últimos 2 segundos de cada clipe** — é onde entra objeto intruso e deriva de estilo. Corta antes ou regera.
- [ ] Nenhuma mão fotorrealista entrando em quadro.
- [ ] Plate saiu **sem nenhum texto** antes do overlay.
- [ ] C1: o rosto do Vicente continua o rosto do Vicente nos 5 segundos inteiros.
- [ ] Nenhum texto embaralhado sobrou no plate (o modelo insiste em escrever em papel e tela — foi o que reprovou a primeira versão do conceito 6).
- [ ] Headline legível em velocidade normal, som desligado, na tela do celular.
- [ ] Logo Sevilha visível no primeiro frame (autoplay sem som).
- [ ] Rótulo de conteúdo gerado por IA marcado na subida (exigência de Meta e TikTok).
- [ ] Nenhum claim fora dos fatos confirmados na seção de lacunas.

---

## Uso do script

Autenticação: `KLING_API_KEY` sozinha (enviada como Bearer) ou o par
`KLING_ACCESS_KEY` + `KLING_SECRET_KEY` (assinado em JWT). O script cobre as duas.

```bash
./criativos/sessao-estrategica/fetch-fontes.sh ./fonts
pip install Pillow

# 1. plate limpo, sem texto
node criativos/sessao-estrategica/kling.js image \
  --prompt-file criativos/sessao-estrategica/prompts/plates/conceito-2-ampulheta.txt \
  --aspect-ratio 3:4 --n 4 --out plates/ampulheta.png

# 2. tipografia por cima
python3 criativos/sessao-estrategica/compor.py \
  --plate plates/ampulheta-1.png --peca conceito-2 --formato 4:5 \
  --zoom 1.4 --anchor-x 0.0 --coluna 0.58 \
  --out out/conceito-2-4x5.png

# 3. opcional: animar o mesmo plate para a versão em vídeo
node criativos/sessao-estrategica/kling.js image2video \
  --image plates/ampulheta-1.png \
  --prompt-file criativos/sessao-estrategica/prompts/conceito-2.txt \
  --out out/conceito-2-plate.mp4
```

### Comandos que geraram as peças em `out/`

```bash
# 4:5 — feed
node kling.js image --prompt-file prompts/plates/conceito-2-ampulheta.txt \
  --aspect-ratio 3:4 --n 4 --out plates/ampulheta.png
python3 compor.py --plate plates/conceito-2-ampulheta-3x4.png --peca conceito-2 \
  --formato 4:5 --zoom 1.4 --anchor-x 0.0 --coluna 0.58 --out out/conceito-2-4x5.png

# 9:16 — Reels/Stories, plate próprio (recortar o 4:5 quebra o enquadramento)
node kling.js image --prompt-file prompts/plates/conceito-2-ampulheta.txt \
  --aspect-ratio 9:16 --n 3 --out plates/ampulheta-916.png
python3 compor.py --plate plates/conceito-2-ampulheta-9x16.png --peca conceito-2 \
  --formato 9:16 --coluna 0.55 --headline-y 0.115 --out out/conceito-2-9x16.png
```

O `--zoom` com `--anchor-x 0.0` amplia o plate e descarta o excedente pela direita,
empurrando o objeto para fora da coluna de texto. Sem isso a headline atravessa a
ampulheta — foi exatamente o que aconteceu na primeira composição.
