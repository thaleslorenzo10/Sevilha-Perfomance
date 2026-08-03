#!/usr/bin/env python3
"""
Dois layouts novos, adaptados das referências D e E.

    python3 oferta.py --peca oferta --plate plates/mentor-916.png --out out/conceito-10-9x16.png
    python3 oferta.py --peca antes-depois --out out/conceito-11-4x5.png

`oferta` adapta a ref E: foto em quadro cheio, tarja qualificando o público,
corpo de texto e o valor em destaque. `antes-depois` adapta a ref D: duas
colunas comparando o antes e o depois, sem foto — não passa pelo Kling.

SOBRE OS NÚMEROS
Nenhuma das duas inventa dado. A ref E ancora em "DE R$ 997 POR 0,00"; aqui o
`de` fica vazio até existir um preço que a Sessão Estratégica realmente já
tenha custado — âncora sobre valor que nunca foi cobrado é propaganda enganosa
e o Meta derruba. A ref D compara prints de painel; aqui a comparação usa as
frases que a própria landing page já publica sobre o antes e o depois do
escritório, não métricas de cliente.
"""

import argparse
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
FONTES = os.path.join(BASE, "fonts")
LOGO = os.path.join(BASE, "marca", "logo-marca.png")

FIELD = (11, 13, 34)
INK = (255, 255, 255)
INK_SOFT = (255, 255, 255, 200)
ACCENT = (43, 191, 160)
VERDE = (61, 214, 58)
VERMELHO = (239, 68, 68)
CTA_GRADIENT = [(61, 214, 58), (43, 191, 160), (41, 180, 246)]

FORMATOS = {"9:16": (1080, 1920), "4:5": (1080, 1350)}

PECAS = {
    "oferta": {
        "formato": "9:16",
        "tarja": "Sessão Estratégica para donos de contabilidade",
        "corpo": "Diagnóstico individual do seu escritório: o que travou em 2025 "
                 "e o que precisa mudar para 2026 ser diferente.",
        # `de` fica None até existir preço real já praticado. Ver docstring.
        "de": None,
        "por": "R$ 0,00",
        "rodape": "Sem custo e sem compromisso",
        "cta": "AGENDAR DIAGNÓSTICO",
    },
    "antes-depois": {
        "formato": "4:5",
        "titulo": ["ANTES & DEPOIS", "DE ESTRUTURAR A GESTÃO"],
        # As duas colunas saem das seções "Antes de continuar" e "O método" da
        # landing page — são as próprias promessas do Clube, não dado inventado.
        "antes": [
            "Você chega cedo e sai tarde",
            "Tira folga e algo quebra",
            "Delega e a tarefa volta",
            "Fatura mais, sobra o mesmo",
            "Contratou e piorou",
        ],
        "depois": [
            "O escritório anda sem você no centro",
            "Processo documentado não depende de memória",
            "O time resolve antes de chegar em você",
            "Você sabe onde a margem vaza",
            "Contratar vira decisão, não socorro",
        ],
        "rodape": "Diagnóstico gratuito com quem já acompanhou +450 contabilidades.",
        "cta": "AGENDAR DIAGNÓSTICO",
    },
}


def fonte(nome, tamanho):
    return ImageFont.truetype(os.path.join(FONTES, nome), tamanho)


def quebrar(texto, f, largura):
    linhas, linha = [], ""
    for palavra in texto.split():
        teste = f"{linha} {palavra}".strip()
        if f.getlength(teste) <= largura or not linha:
            linha = teste
        else:
            linhas.append(linha)
            linha = palavra
    if linha:
        linhas.append(linha)
    return linhas


def cover(img, size, zoom=1.0, anchor_x=0.5, anchor_y=0.5):
    w, h = size
    escala = max(w / img.width, h / img.height) * zoom
    img = img.resize((round(img.width * escala), round(img.height * escala)), Image.LANCZOS)
    return img.crop((round((img.width - w) * anchor_x), round((img.height - h) * anchor_y),
                     round((img.width - w) * anchor_x) + w, round((img.height - h) * anchor_y) + h))


def scrim_vertical(size, comeco=0.30, alpha=232):
    """Escurece de baixo para cima — a ref E apoia todo o texto no rodapé."""
    w, h = size
    coluna = Image.new("L", (1, h))
    inicio = int(h * comeco)
    coluna.putdata([0 if y < inicio else
                    int(alpha * ((y - inicio) / max(1, h - inicio)) ** 0.8) for y in range(h)])
    escuro = Image.new("RGB", size, FIELD)
    escuro.putalpha(coluna.resize(size))
    return escuro


def gradiente_h(largura, altura):
    g = Image.new("RGB", (largura, 1))
    for x in range(largura):
        t = x / max(1, largura - 1)
        i = 0 if t < 0.5 else 1
        u = t * 2 if t < 0.5 else (t - 0.5) * 2
        a, b = CTA_GRADIENT[i], CTA_GRADIENT[i + 1]
        g.putpixel((x, 0), tuple(round(a[c] + (b[c] - a[c]) * u) for c in range(3)))
    return g.resize((largura, altura))


def botao(texto, f, padding=(56, 32), raio=999):
    cx = f.getbbox(texto)
    lg, al = cx[2] - cx[0] + padding[0] * 2, cx[3] - cx[1] + padding[1] * 2
    b = gradiente_h(lg, al)
    m = Image.new("L", (lg, al), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, lg - 1, al - 1], min(raio, al // 2), fill=255)
    b.putalpha(m)
    ImageDraw.Draw(b).text((padding[0] - cx[0], padding[1] - cx[1]), texto, font=f, fill=INK)
    return b


def marca(canvas, d, x, y, altura=52):
    if os.path.exists(LOGO):
        s = Image.open(LOGO).convert("RGBA")
        s = s.resize((round(s.width * altura / s.height), altura), Image.LANCZOS)
        canvas.paste(s, (x, y), s)
        x += s.width + 16
    d.text((x, y), "Sevilha", font=fonte("Poppins-Bold.ttf", 25), fill=INK)
    d.text((x, y + 28), "Performance", font=fonte("Poppins-Medium.ttf", 25), fill=INK_SOFT)


# ── layout da ref E ─────────────────────────────────────────────────────────
def oferta(peca, plate):
    """`plate` aceita caminho ou imagem já carregada — a função serverless não
    tem onde escrever arquivo antes de compor."""
    W, H = FORMATOS[peca["formato"]]
    if not isinstance(plate, Image.Image):
        plate = Image.open(plate)
    canvas = cover(plate.convert("RGB"), (W, H), 1.0, 0.5, 0.35)
    s = scrim_vertical((W, H))
    canvas.paste(s, (0, 0), s)
    d = ImageDraw.Draw(canvas)
    margem = 72

    marca(canvas, d, margem, 70)

    # tarja qualificando o público — o recurso que carrega a ref E
    f_tarja = fonte("Poppins-Bold.ttf", 34)
    linhas = quebrar(peca["tarja"].upper(), f_tarja, W - margem * 2 - 72)
    alt = len(linhas) * 46 + 40
    y = round(H * 0.455)
    d.rectangle([0, y, margem + max(f_tarja.getlength(l) for l in linhas) + 44, y + alt], fill=ACCENT)
    yy = y + 20
    for linha in linhas:
        d.text((margem, yy), linha, font=f_tarja, fill=FIELD)
        yy += 46

    # corpo
    y += alt + 40
    f_corpo = fonte("Poppins-Medium.ttf", 36)
    for linha in quebrar(peca["corpo"], f_corpo, round(W * 0.60)):
        d.text((margem, y), linha, font=f_corpo, fill=INK)
        y += 52

    # valor. O "de" só aparece quando existir preço real já praticado.
    y += 34
    if peca.get("de"):
        f_de = fonte("Anton-Regular.ttf", 74)
        d.text((margem, y), f"DE {peca['de']}", font=f_de, fill=INK)
        lg = f_de.getlength(f"DE {peca['de']}")
        d.line([(margem - 6, y + 52), (margem + lg + 6, y + 40)], fill=VERMELHO, width=7)
        y += 86
    f_por = fonte("Anton-Regular.ttf", 128)
    d.text((margem, y), peca["por"], font=f_por, fill=VERDE)
    # o corpo do Anton em 128 tem descendente longo; 150 encostava o rodapé nele
    y += 178
    d.text((margem, y), peca["rodape"], font=fonte("Poppins-Medium.ttf", 30), fill=INK_SOFT)

    b = botao(peca["cta"], fonte("Anton-Regular.ttf", 38))
    canvas.paste(b, (margem, H - b.height - 150), b)
    return canvas


# ── layout da ref D ─────────────────────────────────────────────────────────
def antes_depois(peca, plate=None):
    W, H = FORMATOS[peca["formato"]]
    canvas = Image.new("RGB", (W, H), FIELD)
    d = ImageDraw.Draw(canvas)
    margem = 56

    marca(canvas, d, margem, 52, altura=46)

    y = 150
    f_t1 = fonte("Anton-Regular.ttf", 72)
    f_t2 = fonte("Anton-Regular.ttf", 44)
    d.text((margem, y), peca["titulo"][0], font=f_t1, fill=INK)
    y += 78
    d.text((margem, y), peca["titulo"][1], font=f_t2, fill=ACCENT)
    y += 84

    col = (W - margem * 2 - 24) // 2
    topo = y
    f_rot = fonte("Poppins-Bold.ttf", 28)
    f_item = fonte("Poppins-Medium.ttf", 27)

    # Altura vem da coluna mais alta: com altura fixa, a coluna de frases curtas
    # ficava com um vazio que denunciava o gabarito.
    def altura_coluna(itens):
        return 100 + sum(len(quebrar(i, f_item, col - 80)) * 36 + 22 for i in itens) + 20

    alt_card = max(altura_coluna(peca["antes"]), altura_coluna(peca["depois"]))

    for i, (rotulo, itens, cor) in enumerate(
            [("ANTES", peca["antes"], VERMELHO), ("DEPOIS", peca["depois"], VERDE)]):
        x = margem + i * (col + 24)
        d.rounded_rectangle([x, topo, x + col, topo + alt_card], 18,
                            fill=(20, 24, 48), outline=(38, 44, 78), width=2)
        lg = f_rot.getlength(rotulo) + 44
        d.rounded_rectangle([x + 20, topo + 20, x + 20 + lg, topo + 68], 10, fill=cor)
        d.text((x + 42, topo + 30), rotulo, font=f_rot, fill=INK)

        yy = topo + 100
        for item in itens:
            # marcador: × no antes, ✓ no depois — desenhados, não tipografados
            cx, cy = x + 34, yy + 14
            if cor == VERMELHO:
                d.line([(cx - 9, cy - 9), (cx + 9, cy + 9)], fill=cor, width=5)
                d.line([(cx - 9, cy + 9), (cx + 9, cy - 9)], fill=cor, width=5)
            else:
                d.line([(cx - 10, cy), (cx - 2, cy + 9)], fill=cor, width=5)
                d.line([(cx - 2, cy + 9), (cx + 11, cy - 9)], fill=cor, width=5)
            linhas = quebrar(item, f_item, col - 80)
            for linha in linhas:
                d.text((x + 58, yy), linha, font=f_item, fill=INK)
                yy += 36
            yy += 22

    y = topo + alt_card + 50
    f_rod = fonte("Poppins-SemiBold.ttf", 32)
    for linha in quebrar(peca["rodape"], f_rod, W - margem * 2 - 40):
        d.text((margem, y), linha, font=f_rod, fill=INK)
        y += 44

    b = botao(peca["cta"], fonte("Anton-Regular.ttf", 36))
    canvas.paste(b, (margem, H - b.height - 56), b)
    return canvas


LAYOUTS = {"oferta": oferta, "antes-depois": antes_depois}

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--peca", required=True, choices=sorted(PECAS))
    p.add_argument("--plate", default=None)
    p.add_argument("--out", required=True)
    a = p.parse_args()
    peca = PECAS[a.peca]
    if a.peca == "oferta" and not a.plate:
        raise SystemExit("a peça oferta precisa de --plate")
    canvas = LAYOUTS[a.peca](peca, a.plate)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    canvas.save(a.out, "PNG")
    print(f"Pronto: {a.out}  {canvas.width}x{canvas.height}")
