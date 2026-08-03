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
    """Aplica o logo. Com --logo aponta para o PNG oficial (marca em gradiente +
    wordmark branco, que já nasce pronto para fundo escuro). Sem ele, cai numa
    assinatura em texto — o logo.png do repositório é navy sobre branco e não
    sobrevive ao fundo escuro sem retrabalho de vetor."""
    if logo:
        marca_img = Image.open(logo).convert("RGBA")
        escala = altura / marca_img.height
        marca_img = marca_img.resize(
            (round(marca_img.width * escala), altura), Image.LANCZOS)
        canvas.paste(marca_img, (x, y), marca_img)
        return
    f = ImageFont.truetype(fontes["poppins_bold"], 26)
    draw.text((x, y), "SEVILHA", font=f, fill=INK)
    largura = f.getbbox("SEVILHA")[2]
    f2 = ImageFont.truetype(fontes["poppins_medium"], 26)
    draw.text((x + largura + 10, y), "PERFORMANCE", font=f2, fill=ACCENT)


def compor(plate_path, peca, formato, dir_fontes, out, zoom=1.0, anchor_x=0.5,
           coluna_frac=0.56, headline_y=0.215, cta_y=None, logo=None, leading=1.0):
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

    canvas = cover(Image.open(plate_path).convert("RGB"), size, zoom, anchor_x)
    canvas.paste(scrim(size), (0, 0), scrim(size))
    draw = ImageDraw.Draw(canvas)

    marca(canvas, draw, margem, round(H * 0.048), fontes, logo, round(H * 0.040))

    # headline — Anton uppercase, leading apertado, uma frase-chave em ACCENT
    linhas = peca["headline"]
    f_head, corpo = autofit(linhas, fontes["anton"], coluna, round(H * 0.082))
    # As referências usam leading ~0.85, mas elas são em inglês. Em PT-BR os
    # acentos maiúsculos (Ê, Ã, Ó) sobem acima da caixa e batem na linha de
    # cima — 1.0 é o mais apertado que ainda respira.
    avanco = round(corpo * leading)
    y = round(H * headline_y)
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

    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    canvas.save(out, "PNG")
    print(f"Pronto: {out}  {W}x{H}  headline {corpo}px")


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
    p.add_argument("--coluna", type=float, default=0.56, help="largura da coluna de texto (fração)")
    p.add_argument("--headline-y", type=float, default=0.215, help="topo da headline (fração da altura)")
    p.add_argument("--cta-y", type=float, default=None, help="topo do CTA; padrão ancora na base")
    p.add_argument("--logo", default=None, help="PNG do logo oficial; sem ele usa assinatura em texto")
    p.add_argument("--leading", type=float, default=1.0, help="entrelinha da headline (múltiplo do corpo)")
    a = p.parse_args()
    compor(a.plate, PECAS[a.peca], a.formato, a.fontes, a.out, a.zoom, a.anchor_x,
           a.coluna, a.headline_y, a.cta_y, a.logo, a.leading)
