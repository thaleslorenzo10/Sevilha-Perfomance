# Sessão Estratégica — criativos (Kling)

Anúncios da Sessão Estratégica da Sevilha Performance, no sistema visual das
referências enviadas, com a paleta da marca.

- **Públicos:** dois segmentos, com criativos separados
  - **até 10 colaboradores** — conceitos 1, 2, 4, 5, 6
  - **mais de 10 colaboradores** — conceitos 7, 8, 9 (eyebrow qualifica o porte na peça)
- **Oferta:** sessão de diagnóstico **gratuita**
- **Destino:** https://form.respondi.app/gvz4UKQr
- **Formato:** 4:5 (feed) + 9:16 (Reels/Stories)
- **Peças prontas:** conceitos 1, 2, 4, 5, 6, 7, 8 e 9 + 4 formatos nativos em `out/`
  (4:5; o conceito 2 também em 9:16)

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

## Conceito 1 — Mentor · "quem não para é você"

Adapta a ref A (pessoa recortada à direita, rim light).

> **A pessoa da peça é sintética.** Não é o Vicente, nem nenhum dos mentores. A
> referência de rosto do Kling não preserva identidade: partindo do `Vicente.jpeg`
> (281px, abaixo do mínimo da API mesmo com upscale), fidelidade 0.6, 0.8 e 0.95
> devolveram três pessoas diferentes, nenhuma parecida com ele. A peça foi aprovada
> pelo cliente nessa condição.
>
> Consequências práticas, para quem for subir ou reaproveitar:
> - **nunca nomear a pessoa da imagem** na copy, na legenda ou no comentário
> - marcar conteúdo gerado por IA na subida (exigência de Meta e TikTok)
> - se um dia houver foto real do Vicente em fundo escuro e alta resolução, ela
>   entra no lugar do plate sem mudar mais nada da composição

**Headline:**
```
SEU ESCRITÓRIO
NÃO PARA.
QUEM NÃO PARA
É VOCÊ.           ← estas duas linhas em ACCENT
```

Plate em `prompts/plates/conceito-1-mentor.txt` · peça em `out/conceito-1-4x5.png`

O prompt do plate descreve a pessoa por atributos (idade, cabelo, óculos, blazer) e
usa `Vicente.jpeg` só como referência de tipo físico — o rosto é do modelo.

```bash
node kling.js image --prompt-file prompts/plates/conceito-1-mentor.txt \
  --aspect-ratio 3:4 --n 4 --ref vicente-ref.jpg --ref-type face --fidelity 0.8 \
  --out plates/mentor.png

python3 compor.py --plate plates/conceito-1-mentor-3x4.png --peca conceito-1 \
  --formato 4:5 --zoom 1.3 --anchor-x 0.0 --anchor-y 0.12 --coluna 0.52 \
  --out out/conceito-1-4x5.png
```

O `--anchor-y 0.12` existe porque, com o zoom que o layout pede, o recorte centrado
cortava a cabeça.

### Etapa opcional — animar para vídeo (image2video)

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

# Segmento: mais de 10 colaboradores

A dor muda de natureza. Abaixo de 10 o dono faz tudo; acima de 10 ele **tem** time e
mesmo assim tudo continua passando por ele. Os três conceitos abaixo atacam isso —
gargalo de decisão, falta de padrão entre equipes e crescimento que não virou margem.

**Eyebrow.** Essas peças levam `PARA ESCRITÓRIOS COM MAIS DE 10 COLABORADORES` acima
da headline, em ACCENT com tracking largo — mesmo padrão do `.eyebrow` da landing page.
Qualificar o porte na arte reduz clique de quem não é o público e barateia o lead.

> **Conflito a resolver.** A landing page qualifica "escritório contábil com **até 10
> colaboradores**" e coloca porte maior fora do perfil. Se a Sessão Estratégica atende
> os dois portes, a LP precisa acompanhar; senão o lead qualificado pelo anúncio se
> desqualifica sozinho ao chegar na página.

## Conceito 7 — Gargalo · decisão represada

Trocadilho visual que só funciona em português: o gargalo da garrafa entupido de papel.

**Headline:**
```
SEU TIME NÃO
ESTÁ PARADO.
ESTÁ ESPERANDO
VOCÊ DECIDIR.     ← estas duas linhas em ACCENT
```

```bash
python3 compor.py --plate plates/conceito-7-gargalo-3x4.png --peca conceito-7 \
  --formato 4:5 --zoom 1.25 --anchor-x 0.0 --coluna 0.56 --out out/conceito-7-4x5.png
```

## Conceito 8 — Caixas desiguais · falta de padrão

**Headline:**
```
CINCO EQUIPES.
CINCO JEITOS
DE FAZER
A MESMA COISA.    ← estas duas linhas em ACCENT
```

```bash
python3 compor.py --plate plates/conceito-8-padrao-3x4.png --peca conceito-8 \
  --formato 4:5 --zoom 1.0 --anchor-y 0.0 --coluna 0.58 --out out/conceito-8-4x5.png
```

O `--anchor-y 0.0` empurra as caixas para baixo do subhead. Com o recorte centrado
elas subiam e atravessavam o texto.

## Conceito 9 — Fileira de mesas · cresceu e não resolveu

Literal da landing page: `Você contratou mais gente — e os problemas só aumentaram`.

**Headline:**
```
VOCÊ CONTRATOU
MAIS GENTE.
E OS PROBLEMAS
CRESCERAM JUNTO.  ← estas duas linhas em ACCENT
```

```bash
python3 compor.py --plate plates/conceito-9-escala-3x4.png --peca conceito-9 \
  --formato 4:5 --zoom 1.2 --anchor-x 0.0 --coluna 0.56 --out out/conceito-9-4x5.png
```

---

# Formatos nativos — UI de app em código

Quatro peças que imitam uma tela de celular em vez de um anúncio. Servem como
pattern interrupt: no feed elas não parecem publicidade, parecem um print. Gerados
por `formatos.py`, não pelo Kling.

**Por que não passam pelo Kling.** Modelo generativo escreve texto embaralhado em
tela e em papel — foi o que reprovou a primeira versão do conceito 6. UI fake só
convence se for construída. `formatos.py` desenha tudo em PIL com Inter (o
substituto livre mais próximo do SF Pro da Apple).

**WhatsApp no lugar de iMessage.** O formato circula lá fora com iMessage, mas no
Brasil o dono de contabilidade vive no WhatsApp — o print de iMessage não desperta
reconhecimento nenhum aqui.

**A faixa da marca no rodapé é obrigatória.** Sem ela a peça é só um print: a marca
não aparece no autoplay e o anúncio não se identifica como anúncio.

| Peça | Superfície | Chamada |
|---|---|---|
| `nativo-notas` | Notas do iPhone, 23h47 | Se só você resolve, você não tem um time. Tem uma fila. |
| `nativo-whatsapp` | Conversa com o time, domingo 21h34 | Isso não é dedicação do time — é falta de processo. |
| `nativo-lockscreen` | Tela bloqueada, 47 notificações | Um escritório saudável não te procura no domingo à noite. |
| `nativo-busca` | Autocomplete de busca | A resposta não está no Google. Está nos seus números. |

```bash
python3 formatos.py --peca notas      --out out/nativo-notas.png
python3 formatos.py --peca whatsapp   --out out/nativo-whatsapp.png
python3 formatos.py --peca lockscreen --out out/nativo-lockscreen.png
python3 formatos.py --peca busca      --out out/nativo-busca.png
```

## Regras de honestidade destas peças

São **dramatizações** — a conversa e a nota são roteiro, não registro real. Isso é
recurso publicitário legítimo, desde que:

- nenhum nome de cliente, colaborador ou mentor real apareça (o "Marcelo · Fiscal"
  é personagem)
- nada seja apresentado como depoimento ou print vazado de conversa real
- todo dado citado seja verdadeiro da oferta
- rodem **só como anúncio pago**, onde o selo "Patrocinado" faz a divulgação —
  nunca postadas organicamente como se fossem print real
- sejam marcadas como conteúdo gerado por IA / dramatização na subida

## O que testar

O ângulo destas quatro é o mesmo dos conceitos 1-6 (dor operacional do dono), então
o teste limpo é **formato contra formato**, não ângulo contra ângulo: sobem contra
o conceito 4, que hoje carrega o ângulo de menor CPL da conta. Se o nativo ganhar,
a hipótese confirmada é a do formato, e aí vale portar os outros ângulos para ele.

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

**Conceito 1**
- Principal: `Seu escritório não trava por falta de técnica. Trava porque tudo passa por você.` (80)
- Título: `Diagnóstico gratuito` (20)
- Descrição: `Donos de contabilidade` (22)

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

### Segmento mais de 10 colaboradores

**Conceito 7**
- Principal: `Você tem time e mesmo assim tudo espera a sua decisão. Não é falta de gente, é falta de gestão.` (95)
- Título: `Tudo passa por você?` (20)
- Descrição: `Mais de 10 colaboradores` (24)

**Conceito 8**
- Principal: `Cada equipe do seu escritório faz do próprio jeito. E erra de um jeito diferente também.` (88)
- Título: `Cada equipe faz de um jeito` (27)
- Descrição: `Diagnóstico gratuito` (20)

**Conceito 9**
- Principal: `Você contratou mais gente e os problemas cresceram junto. Estruturar não é o mesmo que contratar.` (97)
- Título: `Cresceu o time, e a margem?` (27)
- Descrição: `Mais de 10 colaboradores` (24)

### Formatos nativos

**nativo-notas**
- Principal: `A lista que você escreve às 23h nunca é sobre técnica. É sempre sobre o que só passa por você.` (94)
- Título: `Só você resolve?` (16)
- Descrição: `Diagnóstico gratuito` (20)

**nativo-whatsapp**
- Principal: `Se o seu time te procura no domingo, o problema não é o time. É a falta de processo.` (84)
- Título: `Domingo, 21h34` (14)
- Descrição: `Donos de contabilidade` (22)

**nativo-lockscreen**
- Principal: `47 notificações do escritório às 23h47. Um negócio estruturado não faz isso com o dono.` (87)
- Título: `Seu escritório dorme?` (21)
- Descrição: `Diagnóstico gratuito` (20)

**nativo-busca**
- Principal: `Você já pesquisou como sair da operação. O Google não conhece os seus números — a gente olha eles.` (98)
- Título: `Já pesquisou isso?` (18)
- Descrição: `Donos de contabilidade` (22)

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

---

# Conceitos 10 e 11 — referências D e E

Duas referências novas, com estruturas que os conceitos anteriores não cobriam:
âncora de valor sobre foto em quadro cheio, e comparação antes/depois em colunas.
Ambas geradas por `oferta.py`.

## Conceito 10 — Oferta sobre foto (ref E)

9:16, foto em quadro cheio, tarja identificando o público, corpo curto e o valor
em destaque. É o formato que a ref E usa para vender sessão estratégica.

**O que eu não copiei: a âncora de preço.** A referência traz `DE R$ 997 POR
0,00`. A Sessão Estratégica nunca custou R$ 997 — anunciar um "de" sobre valor
que nunca foi praticado é propaganda enganosa, o Meta reprova e o CDC trata como
publicidade enganosa. A peça mostra o `R$ 0,00` verdadeiro sem o riscado.

O campo `de` já existe em `PECAS`, valendo `None`. **Se a sessão tiver preço real
quando vendida avulsa, basta preencher** — o riscado em vermelho aparece sozinho.

Plate em `prompts/plates/conceito-10-mentor-916.txt` (mesma ressalva do conceito
1: a pessoa é sintética e não pode ser nomeada).

```bash
python3 oferta.py --peca oferta --plate plates/conceito-10-mentor-9x16.png \
  --out out/conceito-10-9x16.png
```

## Conceito 11 — Antes & depois (ref D)

4:5, duas colunas, marcadores vermelhos contra verdes. **Não passa pelo Kling** —
é tipografia pura.

**O que eu não copiei: os prints de painel.** A ref D compara screenshots reais
do gerenciador com valores de campanha. Não existe esse dado para a Sessão
Estratégica, e fabricar antes/depois de resultado de cliente seria inventar
prova. A comparação usa as frases que a landing page já publica — a coluna
ANTES sai de "Quantas dessas situações você vive hoje?", a coluna DEPOIS sai dos
resultados prometidos em "O método".

Se um dia houver caso real de cliente com número auditável e autorização de uso,
o layout aceita: é trocar as listas em `PECAS`.

```bash
python3 oferta.py --peca antes-depois --out out/conceito-11-4x5.png
```

## Copy do Meta

**Conceito 10**
- Principal: `Diagnóstico individual do seu escritório contábil. O que travou em 2025 e o que muda em 2026.` (93)
- Título: `Sessão Estratégica` (18)
- Descrição: `Sem custo` (9)

**Conceito 11**
- Principal: `Chega cedo, sai tarde, delega e a tarefa volta. Do outro lado dessa lista tem um escritório que anda.` (101)
- Título: `Antes e depois da gestão` (24)
- Descrição: `Diagnóstico gratuito` (20)

# Conceitos 12 e 13 — referência F

A ref F (`eugkallil`, "CAPTAÇÃO DE PACIENTES HIGH TICKET / PARA MÉDICOS") traz
uma estrutura que nenhuma peça da pasta tinha: **o texto não mora num scrim
único cobrindo meia peça, mora em blocos opacos separados**, cada um do tamanho
do próprio texto, empilhados. Some o degradê, some a foto por baixo da letra, e
a leitura vira uma lista de cima para baixo. É o layout `blocos` no `oferta.py`.

Os três recursos que valem copiar:

1. **Dois blocos de headline em cores diferentes.** Um chapéu pequeno que
   qualifica, um bloco grande que grita para quem passa. Na ref são preto e
   azul-marinho; aqui seriam `#08090F` e `#0B0D22`, que a essa distância é a
   mesma cor — então inverti: chapéu no teal da marca, chamada no marinho.
2. **Corpo em monoespaçada sobre branco.** É o contraste de textura que dá o ar
   de "não é anúncio". Space Mono, também OFL, já no `fetch-fontes.sh`.
3. **Checklist com ✅ verde.** É o que a ref usa no lugar de prova social.

**O que eu não copiei: as linhas de entregável.** A ref lista "Metodologia
validada em +200 clínicas e doutores" e mais três itens de entrega. A linha
equivalente da Sevilha existe e é verdadeira (`+450 contabilidades`, `35+ anos`),
mas duração da sessão, entregável e nome de quem conduz continuam `[SLOT]` — e
`[SLOT]` não vira claim. O checklist ficou com quatro linhas conferíveis hoje.

Isso está travado no serviço, não só aqui: `api/compor.py` recusa item de
checklist que afirme duração ("60 minutos") ou entregável ("plano de ação",
"PDF"), com o motivo, para o gerador reescrever em vez de publicar.

O `✅` da ref é emoji — fonte de texto não tem o glifo e sai tofu, o mesmo erro
que derrubou a primeira versão do formato nativo do WhatsApp. Aqui o marcador é
desenhado em PIL.

## Conceito 12 — Diagnóstico de gestão (até 10)

```bash
python3 oferta.py --peca blocos --plate plates/conceito-12-dono-9x16.png \
  --out out/conceito-12-9x16.png
```

## Conceito 13 — Tudo passa por você (mais de 10)

```bash
python3 oferta.py --peca blocos-10mais --plate plates/conceito-13-openplan-9x16.png \
  --out out/conceito-13-9x16.png
```

Nas duas o assunto da foto tem que estar no terço de cima: a pilha de blocos
ocupa os dois terços de baixo. `zoom` e `anchor_y` são campos da peça.

## Copy do Meta

**Conceito 12**
- Principal: `Você não quer mais um curso. Quer saber o que está travando o escritório — e o que fazer com isso na segunda-feira.` (115)
- Título: `Diagnóstico de gestão` (21)
- Descrição: `Sem custo` (9)

**Conceito 13**
- Principal: `Dez, quinze, vinte pessoas na equipe, e nenhuma decisão anda sem passar na sua mesa. O gargalo deixou de ser o time.` (116)
- Título: `Mais de 10 colaboradores` (24)
- Descrição: `Diagnóstico gratuito` (20)
