#!/usr/bin/env python3
"""
Compõe a camada de tipografia sobre um plate gerado pelo Kling.

O modelo generativo não renderiza a headline condensada em PT-BR de forma
confiável — por isso o plate sai limpo (sem texto) e o texto entra aqui, vetorial.

    python3 compor.py --plate plates/ampulheta-1.png --peca conceito-2 \
        --out out/conceito-2-4x5.png --formato 4:5

Fontes esperadas em --fontes (padrão ./fonts):
    Anton-Regular.ttf, Poppins-Medium.ttf, Poppins-Bold.ttf
"""

import argparse
import os
from PIL import Image, ImageDraw, ImageFont

# ── sistema visual (extraído das referências, com a paleta da Sevilha) ───────
FIELD = (11, 13, 34)          # #0B0D22 — navy #1a1c48 escurecido
INK = (255, 255, 255)
INK_SOFT = (255, 255, 255, 184)
ACCENT = (43, 191, 160)       # #2BBFA0
CTA_GRADIENT = [(61, 214, 58), (43, 191, 160), (41, 180, 246)]  # .btn da landing page

FORMATOS = {"4:5": (1080, 1350), "9:16": (1080, 1920), "1:1": (1080, 1080)}

PECAS = {
    "conceito-2": {
        "headline": ["UMA CONVERSA", "OLHANDO OS", "SEUS NÚMEROS.", "OU MAIS UM ANO", "NO ACHISMO."],
        "accent_lines": [3, 4],   # índices das linhas em ACCENT
        "subhead": "Diagnóstico gratuito do seu escritório, com quem já acompanhou +450 contabilidades.",
        "cta": "AGENDAR DIAGNÓSTICO",
    },
    "conceito-1": {
        "headline": ["SEU ESCRITÓRIO", "NÃO PARA.", "QUEM NÃO PARA", "É VOCÊ."],
        "accent_lines": [2, 3],
        "subhead": "Diagnóstico gratuito do seu escritório, com quem já acompanhou +450 contabilidades.",
        "cta": "AGENDAR DIAGNÓSTICO",
    },
    "conceito-4": {
        "headline": ["VOCÊ NÃO TEM", "UM ESCRITÓRIO.", "VOCÊ TEM", "UM PLANTÃO."],
        "accent_lines": [2, 3],
        "subhead": "Diagnóstico gratuito do seu escritório, com quem já acompanhou +450 contabilidades.",
        "cta": "AGENDAR DIAGNÓSTICO",
    },
    "conceito-5": {
        "headline": ["TIRE UMA SEMANA", "DE FÉRIAS.", "VEJA O QUE", "PARA."],
        "accent_lines": [2, 3],
        "subhead": "Diagnóstico gratuito do seu escritório, com quem já acompanhou +450 contabilidades.",
        "cta": "AGENDAR DIAGNÓSTICO",
    },
    "conceito-6": {
        "headline": ["O FATURAMENTO", "SUBIU.", "A MARGEM NÃO", "SAIU DO LUGAR."],
        "accent_lines": [2, 3],
        "subhead": "Diagnóstico gratuito do seu escritório, com quem já acompanhou +450 contabilidades.",
        "cta": "AGENDAR DIAGNÓSTICO",
    },
    "conceito-7": {
        "eyebrow": "Para escritórios com mais de 10 colaboradores",
        "headline": ["SEU TIME NÃO", "ESTÁ PARADO.", "ESTÁ ESPERANDO", "VOCÊ DECIDIR."],
        "accent_lines": [2, 3],
        "subhead": "Diagnóstico gratuito do seu escritório, com quem já acompanhou +450 contabilidades.",
        "cta": "AGENDAR DIAGNÓSTICO",
    },
    "conceito-8": {
        "eyebrow": "Para escritórios com mais de 10 colaboradores",
        "headline": ["CINCO EQUIPES.", "CINCO JEITOS", "DE FAZER", "A MESMA COISA."],
        "accent_lines": [2, 3],
        "subhead": "Diagnóstico gratuito do seu escritório, com quem já acompanhou +450 contabilidades.",
        "cta": "AGENDAR DIAGNÓSTICO",
    },
    "conceito-9": {
        "eyebrow": "Para escritórios com mais de 10 colaboradores",
        "headline": ["VOCÊ CONTRATOU", "MAIS GENTE.", "E OS PROBLEMAS", "CRESCERAM JUNTO."],
        "accent_lines": [2, 3],
        "subhead": "Diagnóstico gratuito do seu escritório, com quem já acompanhou +450 contabilidades.",
        "cta": "AGENDAR DIAGNÓSTICO",
    },
}


# ── matéria-prima para o gerador de conceitos ───────────────────────────────
# Servida em GET /api/compor. O n8n entrega isto ao LLM toda semana, junto com
# o histórico do que já foi gerado, e recebe de volta um conceito novo.

FATOS = [
    "A oferta é a Sessão Estratégica: diagnóstico individual e gratuito do escritório contábil.",
    "Quem atende já acompanhou mais de 450 contabilidades ao longo de 35+ anos.",
    "São 3 mentores. O destino é o formulário em form.respondi.app/gvz4UKQr.",
    "Não há venda no final e não existe preço já praticado — nada de âncora 'de/por'.",
    "Dois segmentos: escritórios com até 10 colaboradores e com mais de 10.",
    "No checklist do layout `blocos` só entra fato já publicado: duração da sessão,"
    " entregável e nome de quem conduz ainda não foram confirmados.",
    "Na conta, o que segura CPL abaixo de R$ 15 é nomear a dor operacional do dono;",
    "promessa genérica de transformação estoura o CPL para R$ 52-77.",
]

# Os nove primeiros plates repetiam a mesma fórmula — objeto à direita, spotlight
# de cima, dois terços escuros à esquerda — trocando só o substantivo. Daí a
# mesmice. Estes eixos existem para o gerador combinar em vez de repetir.
EIXOS = {
    "enquadramento": [
        "macro extremo, o objeto preenchendo o quadro inteiro",
        "plano aberto, o objeto pequeno perdido num ambiente grande",
        "visto de cima, direto para baixo sobre a superfície",
        "simetria central, objeto exatamente no meio",
        "objeto encostado na borda inferior, muito espaço vazio acima",
        "primeiro plano desfocado emoldurando o objeto ao fundo",
    ],
    "luz": [
        "contraluz forte, o objeto quase em silhueta",
        "luz de janela lateral, suave e realista",
        "névoa densa atravessada por um feixe",
        "luz dura de meio-dia, sombras curtas e recortadas",
        "penumbra, quase nada iluminado além de um detalhe",
        "luz fria de monitor batendo de baixo",
    ],
    "meio": [
        "fotografia documental de escritório real",
        "natureza-morta em fundo claro, quase de catálogo",
        "still life escuro e cinematográfico",
        "macro texturizado, foco milimétrico",
        "cena com pessoa, sem rosto identificável",
    ],
}

LAYOUTS = {
    "compor": "headline condensada à esquerda, objeto à direita — 4:5 ou 9:16",
    "oferta": "foto em quadro cheio, tarja de público e valor em destaque — 9:16",
    "antes-depois": "duas colunas comparando, sem foto — 4:5",
    "blocos": "blocos opacos empilhados sobre a foto, corpo em monoespaçada e "
              "checklist de entregáveis — 9:16",
    "nativo": "UI de app recriada (notas, whatsapp, lockscreen, busca) — 4:5",
}

# Parâmetros de recorte descobertos peça a peça. Vivem aqui para o n8n não
# precisar conhecê-los — a automação pede a peça, não a geometria.
PRESETS = {
    ("conceito-1", "4:5"):  {"zoom": 1.3,  "anchor_x": 0.0, "anchor_y": 0.12, "coluna_frac": 0.52},
    ("conceito-2", "4:5"):  {"zoom": 1.4,  "anchor_x": 0.0, "coluna_frac": 0.58},
    ("conceito-2", "9:16"): {"coluna_frac": 0.55, "headline_y": 0.115},
    ("conceito-4", "4:5"):  {"coluna_frac": 0.58},
    ("conceito-5", "4:5"):  {"zoom": 1.1,  "anchor_x": 0.0, "coluna_frac": 0.54},
    ("conceito-6", "4:5"):  {"zoom": 1.15, "anchor_x": 0.0, "coluna_frac": 0.58},
    ("conceito-7", "4:5"):  {"zoom": 1.25, "anchor_x": 0.0, "coluna_frac": 0.56},
    ("conceito-8", "4:5"):  {"zoom": 1.0,  "anchor_y": 0.0, "coluna_frac": 0.58},
    ("conceito-9", "4:5"):  {"zoom": 1.2,  "anchor_x": 0.0, "coluna_frac": 0.56},
}


def cover(img, size, zoom=1.0, anchor_x=0.5, anchor_y=0.5):
    """Redimensiona preenchendo o quadro, recortando o excedente.

    `zoom` amplia além do mínimo necessário e `anchor_x` escolhe de que lado o
    excedente é descartado — é assim que o objeto do plate é empurrado para a
    direita, liberando a coluna de texto à esquerda sem encolher a headline.
    anchor_x=0.0 descarta pela direita (mantém o lado esquerdo do plate).
    """
    w, h = size
    escala = max(w / img.width, h / img.height) * zoom
    img = img.resize((round(img.width * escala), round(img.height * escala)), Image.LANCZOS)
    esq = round((img.width - w) * anchor_x)
    topo = round((img.height - h) * anchor_y)
    return img.crop((esq, topo, esq + w, topo + h))


def scrim(size, ate=0.72, alpha=225):
    """Gradiente escuro da esquerda para o centro — garante contraste sob o texto.

    É o mesmo recurso das referências: sem ele, a headline compete com o objeto.
    """
    w, h = size
    camada = Image.new("L", (w, 1))
    largura = max(1, int(w * ate))
    camada.putdata([int(alpha * max(0.0, 1 - x / largura)) for x in range(w)])
    mascara = camada.resize((w, h))
    escuro = Image.new("RGB", size, FIELD)
    escuro.putalpha(mascara)
    return escuro


def autofit(linhas, caminho_fonte, largura_max, tamanho_inicial):
    """Maior corpo em que a linha mais larga ainda cabe na coluna de texto."""
    tamanho = tamanho_inicial
    while tamanho > 12:
        fonte = ImageFont.truetype(caminho_fonte, tamanho)
        if max(fonte.getbbox(l)[2] for l in linhas) <= largura_max:
            return fonte, tamanho
        tamanho -= 2
    return ImageFont.truetype(caminho_fonte, 12), 12


def quebrar(texto, fonte, largura_max):
    """Quebra o parágrafo na coluna, respeitando quebras manuais."""
    saida = []
    for paragrafo in texto.split("\n"):
        linha = ""
        for palavra in paragrafo.split():
            teste = f"{linha} {palavra}".strip()
            if fonte.getbbox(teste)[2] <= largura_max or not linha:
                linha = teste
            else:
                saida.append(linha)
                linha = palavra
        saida.append(linha)
    return saida


def letterspace(draw, xy, texto, fonte, fill, tracking):
    """PIL não tem letter-spacing — desenha caractere a caractere."""
    x, y = xy
    for ch in texto:
        draw.text((x, y), ch, font=fonte, fill=fill)
        x += fonte.getlength(ch) + tracking
    return x


def botao(texto, fonte, padding=(52, 30), raio=14):
    """Pill com o gradiente da marca."""
    cx = fonte.getbbox(texto)
    largura = cx[2] - cx[0] + padding[0] * 2
    altura = cx[3] - cx[1] + padding[1] * 2

    grad = Image.new("RGB", (largura, 1))
    for x in range(largura):
        t = x / max(1, largura - 1)
        # duas paradas: 0 → 0.5 → 1
        i = 0 if t < 0.5 else 1
        u = t * 2 if t < 0.5 else (t - 0.5) * 2
        a, b = CTA_GRADIENT[i], CTA_GRADIENT[i + 1]
        grad.putpixel((x, 0), tuple(round(a[c] + (b[c] - a[c]) * u) for c in range(3)))
    grad = grad.resize((largura, altura))

    mascara = Image.new("L", (largura, altura), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, largura - 1, altura - 1], raio, fill=255)
    grad.putalpha(mascara)

    d = ImageDraw.Draw(grad)
    d.text((padding[0] - cx[0], padding[1] - cx[1]), texto, font=fonte, fill=INK)
    return grad


def marca(canvas, draw, x, y, fontes, logo=None, altura=None):
    """Lockup da marca: símbolo em gradiente + wordmark branco em duas linhas.

    O símbolo vem de `marca/logo-marca.png`, renderizado do SVG que já vive em
    clube-da-performance/app/components/Logo.tsx — mesmo gradiente da marca. O
    logo.png da raiz é navy sobre branco e não sobrevive ao fundo escuro.
    """
    if logo and os.path.exists(logo):
        simbolo = Image.open(logo).convert("RGBA")
        escala = altura / simbolo.height
        simbolo = simbolo.resize((round(simbolo.width * escala), altura), Image.LANCZOS)
        canvas.paste(simbolo, (x, y), simbolo)
        x += simbolo.width + round(altura * 0.32)

    corpo = round(altura * 0.40)
    f1 = ImageFont.truetype(fontes["poppins_bold"], corpo)
    f2 = ImageFont.truetype(fontes["poppins_medium"], corpo)
    bloco = round(corpo * 2.35)
    topo = y + (altura - bloco) // 2
    draw.text((x, topo), "Sevilha", font=f1, fill=INK)
    draw.text((x, topo + round(corpo * 1.32)), "Performance", font=f2, fill=INK_SOFT)


def compor(plate_path, peca, formato, dir_fontes, out, **kwargs):
    """Wrapper de linha de comando: renderiza e salva."""
    canvas = renderizar(Image.open(plate_path).convert("RGB"), peca, formato, dir_fontes, **kwargs)
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    canvas.save(out, "PNG")
    print(f"Pronto: {out}  {canvas.width}x{canvas.height}")


def renderizar(plate, peca, formato, dir_fontes, zoom=1.0, anchor_x=0.5,
               coluna_frac=0.56, headline_y=0.215, cta_y=None, logo=None, leading=1.0,
               anchor_y=0.5):
    """Devolve a peça montada como imagem — usada tanto pelo CLI quanto pela
    função serverless em api/compor.py, que não tem onde escrever arquivo."""
    size = FORMATOS[formato]
    W, H = size
    margem = round(W * 0.068)
    coluna = round(W * coluna_frac)  # coluna de texto — o objeto vive à direita dela

    fontes = {
        "anton": os.path.join(dir_fontes, "Anton-Regular.ttf"),
        "poppins_medium": os.path.join(dir_fontes, "Poppins-Medium.ttf"),
        "poppins_bold": os.path.join(dir_fontes, "Poppins-Bold.ttf"),
    }
    for nome, caminho in fontes.items():
        if not os.path.exists(caminho):
            raise SystemExit(f"Fonte ausente: {caminho} ({nome})")

    canvas = cover(plate, size, zoom, anchor_x, anchor_y)
    canvas.paste(scrim(size), (0, 0), scrim(size))
    draw = ImageDraw.Draw(canvas)

    marca(canvas, draw, margem, round(H * 0.048), fontes, logo, round(H * 0.040))

    # eyebrow — qualifica o porte do escritório antes do clique.
    # Mesmo padrão do .eyebrow da landing page: Poppins 700, uppercase, tracking largo.
    y_head = round(H * headline_y)
    if peca.get("eyebrow"):
        corpo_eb = round(W * 0.0165)
        f_eb = ImageFont.truetype(fontes["poppins_bold"], corpo_eb)
        letterspace(draw, (margem, y_head - round(corpo_eb * 2.6)),
                    peca["eyebrow"].upper(), f_eb, ACCENT, corpo_eb * 0.16)

    # headline — Anton uppercase, leading apertado, uma frase-chave em ACCENT
    linhas = peca["headline"]
    f_head, corpo = autofit(linhas, fontes["anton"], coluna, round(H * 0.082))
    # As referências usam leading ~0.85, mas elas são em inglês. Em PT-BR os
    # acentos maiúsculos (Ê, Ã, Ó) sobem acima da caixa e batem na linha de
    # cima — 1.0 é o mais apertado que ainda respira.
    avanco = round(corpo * leading)
    y = y_head
    for i, linha in enumerate(linhas):
        cor = ACCENT if i in peca["accent_lines"] else INK
        draw.text((margem, y), linha, font=f_head, fill=cor)
        y += avanco

    # subhead — quebrado na mesma coluna da headline
    y += round(H * 0.030)
    corpo_sub = round(W * 0.0285)
    f_sub = ImageFont.truetype(fontes["poppins_medium"], corpo_sub)
    for linha in quebrar(peca["subhead"], f_sub, coluna):
        draw.text((margem, y), linha, font=f_sub, fill=INK_SOFT)
        y += round(corpo_sub * 1.55)

    # filete de acento (recurso da ref B)
    y += round(H * 0.020)
    draw.rectangle([margem, y, margem + round(W * 0.30), y + 3], fill=ACCENT)

    # CTA — ancorado na base, ou em cta_y quando o objeto ocupa o rodapé
    f_cta = ImageFont.truetype(fontes["anton"], round(W * 0.042))
    b = botao(peca["cta"], f_cta)
    topo_cta = round(H * cta_y) if cta_y is not None else H - margem - b.height
    canvas.paste(b, (margem, topo_cta), b)

    return canvas


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--plate", required=True)
    p.add_argument("--peca", required=True, choices=sorted(PECAS))
    p.add_argument("--formato", default="4:5", choices=sorted(FORMATOS))
    p.add_argument("--fontes", default="./fonts")
    p.add_argument("--out", required=True)
    p.add_argument("--zoom", type=float, default=1.0, help="amplia o plate antes do recorte")
    p.add_argument("--anchor-x", type=float, default=0.5,
                   help="0 mantém o lado esquerdo do plate (empurra o objeto para a direita)")
    p.add_argument("--anchor-y", type=float, default=0.5,
                   help="0 mantém o topo do plate — necessário quando o zoom cortaria a cabeça")
    p.add_argument("--coluna", type=float, default=0.56, help="largura da coluna de texto (fração)")
    p.add_argument("--headline-y", type=float, default=0.215, help="topo da headline (fração da altura)")
    p.add_argument("--cta-y", type=float, default=None, help="topo do CTA; padrão ancora na base")
    p.add_argument("--logo",
                   default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "marca", "logo-marca.png"),
                   help="PNG do símbolo da marca; sem ele o lockup fica só com o wordmark")
    p.add_argument("--leading", type=float, default=1.0, help="entrelinha da headline (múltiplo do corpo)")
    a = p.parse_args()
    compor(a.plate, PECAS[a.peca], a.formato, a.fontes, a.out, zoom=a.zoom,
           anchor_x=a.anchor_x, coluna_frac=a.coluna, headline_y=a.headline_y,
           cta_y=a.cta_y, logo=a.logo, leading=a.leading, anchor_y=a.anchor_y)
