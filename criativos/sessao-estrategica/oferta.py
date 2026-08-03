#!/usr/bin/env python3
"""
Três layouts novos, adaptados das referências D, E e F.

    python3 oferta.py --peca oferta --plate plates/mentor-916.png --out out/conceito-10-9x16.png
    python3 oferta.py --peca antes-depois --out out/conceito-11-4x5.png
    python3 oferta.py --peca blocos --plate plates/conceito-12-dono-9x16.png --out out/conceito-12-9x16.png

`oferta` adapta a ref E: foto em quadro cheio, tarja qualificando o público,
corpo de texto e o valor em destaque. `antes-depois` adapta a ref D: duas
colunas comparando o antes e o depois, sem foto — não passa pelo Kling.
`blocos` adapta a ref F: blocos opacos empilhados sobre a foto, corpo em
monoespaçada e um checklist de entregáveis.

SOBRE OS NÚMEROS
Nenhuma das três inventa dado. A ref E ancora em "DE R$ 997 POR 0,00"; aqui o
`de` fica vazio até existir um preço que a Sessão Estratégica realmente já
tenha custado — âncora sobre valor que nunca foi cobrado é propaganda enganosa
e o Meta derruba. A ref D compara prints de painel; aqui a comparação usa as
frases que a própria landing page já publica sobre o antes e o depois do
escritório, não métricas de cliente. A ref F lista "validado em +200 clínicas";
aqui a linha equivalente é o número que a Sevilha realmente tem (+450
contabilidades), e as outras três linhas do checklist só afirmam o que já está
publicado — nada de duração, entregável ou nome de quem conduz enquanto esses
`[SLOT]` não forem confirmados.
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

# Só o layout `blocos` usa: preto de bloco (mais fechado que o FIELD, para os
# dois blocos de headline se distinguirem um do outro) e o verde do checklist.
BREU = (8, 9, 16)
VERDE_CHECK = (34, 168, 108)

FORMATOS = {"9:16": (1080, 1920), "4:5": (1080, 1350)}

# Checklist do layout `blocos`. Quatro linhas, todas conferíveis hoje: a oferta
# é individual e gratuita, e o número e o tempo de casa estão publicados. O que
# a ref F tem e aqui não tem é duração, entregável e nome de quem conduz —
# esses continuam [SLOT], e [SLOT] não vira claim.
ITENS = [
    "Diagnóstico individual, não aula em grupo",
    "Com quem já acompanhou +450 contabilidades",
    "35+ anos dentro de escritório contábil",
    "Sem custo e sem compromisso",
]

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
    # `**` marca ênfase. Nos blocos escuros vira cor de destaque; nos brancos,
    # peso bold. Um marcador só, porque o gerador não precisa saber de dois.
    "blocos": {
        "layout": "blocos",
        "formato": "9:16",
        "zoom": 1.35, "anchor_y": 0.30,
        "topo": "DIAGNÓSTICO DE **GESTÃO**",
        "chamada": "PARA CONTABILIDADES",
        "corpo": [
            "Você não quer mais um curso, nem outra promessa de transformação.",
            "Você quer **saber o que está travando** o escritório — e o que "
            "fazer com isso na segunda-feira.",
        ],
        # Todas as quatro linhas são verificáveis. Duração, entregável e quem
        # conduz continuam de fora: ainda são [SLOT].
        "itens": ITENS,
        "cta": "AGENDAR DIAGNÓSTICO",
    },
    # Mesmo layout, segmento de mais de 10 colaboradores.
    "blocos-10mais": {
        "layout": "blocos",
        "formato": "9:16",
        "zoom": 1.2, "anchor_y": 0.22,
        "topo": "ESCRITÓRIO COM **MAIS DE 10**",
        "chamada": "TUDO PASSA POR VOCÊ",
        "corpo": [
            "Dez, quinze, vinte pessoas na equipe — e nenhuma decisão anda "
            "sem passar na sua mesa.",
            "O gargalo **deixou de ser o time.** Virou a estrutura que "
            "cresceu sem nunca ter sido desenhada.",
        ],
        "itens": ITENS,
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


# ── layout da ref F ─────────────────────────────────────────────────────────
#
# O que a ref F traz de novo em relação a tudo que já existe na pasta: o texto
# não fica sobre um scrim único cobrindo meia peça, fica em blocos opacos
# separados, cada um do tamanho do próprio texto. O empilhamento é o layout.
# Some o degradê, some a foto por baixo da letra, e a leitura vira uma lista.

def _segmentos(texto):
    """Quebra em (trecho, enfase) nos pares de `**`."""
    partes, enfase = [], False
    for pedaco in texto.split("**"):
        if pedaco:
            partes.append((pedaco, enfase))
        enfase = not enfase
    return partes


def _limpo(texto):
    return texto.replace("**", "")


def _quebrar_marcado(texto, f, largura):
    """Quebra preservando os `**`. Só serve com fonte de avanço fixo ou com as
    duas variantes de mesma largura — Space Mono Regular e Bold são idênticas
    nesse ponto, e Anton usa uma face só (a ênfase é cor)."""
    linhas, linha = [], ""
    for palavra in texto.split():
        teste = f"{linha} {palavra}".strip()
        if f.getlength(_limpo(teste)) <= largura or not linha:
            linha = teste
        else:
            linhas.append(linha)
            linha = palavra
    if linha:
        linhas.append(linha)
    return linhas


def _escrever(d, x, y, linha, f_reg, f_forte, cor, cor_enfase):
    for trecho, enfase in _segmentos(linha):
        f = f_forte if enfase else f_reg
        d.text((x, y), trecho, font=f, fill=cor_enfase if enfase else cor)
        x += f.getlength(trecho)


# Acento para cima, cedilha e perna para baixo: o extremo vertical da face.
# A caixa é medida por ele, e não pela linha que caiu ali — assim "PARA
# CONTABILIDADES" e "PARA CONTABILIDAÇÕES" saem com a mesma altura de bloco, e
# nenhuma das duas encosta na borda.
EXTREMOS = "ÁÇJgy"


def _metricas(f, n_linhas, altura_linha):
    """(deslocamento do topo, altura do texto) para n linhas nessa face."""
    topo, base = f.getbbox(EXTREMOS)[1], f.getbbox(EXTREMOS)[3]
    return topo, (n_linhas - 1) * altura_linha + (base - topo)


def _altura_lista(f, grupos, altura_linha, gap):
    """Altura de vários parágrafos empilhados com `gap` entre eles.

    Medir cada grupo com _metricas e somar dá menos que o desenho avança: a
    última linha de cada grupo ocupa a altura do glifo, não a da linha. Era isso
    que cortava o último item do checklist na borda do bloco branco.
    """
    avanco = sum(len(g) * altura_linha for g in grupos) + gap * (len(grupos) - 1)
    return avanco - altura_linha + _metricas(f, 1, altura_linha)[1]


def _caixa(d, x, y, linhas, f, largura_max, pad, altura_linha, fundo):
    """Retângulo opaco do tamanho do texto. Devolve a altura ocupada."""
    largura = min(max(f.getlength(_limpo(l)) for l in linhas) + pad[0] * 2, largura_max)
    altura = _metricas(f, len(linhas), altura_linha)[1] + pad[1] * 2
    d.rectangle([x, y, x + largura, y + altura], fill=fundo)
    return altura


def _check(d, x, y, lado, cor):
    """O ✅ da ref é emoji; fonte de texto não tem o glifo e sai tofu. Desenhado."""
    d.rounded_rectangle([x, y, x + lado, y + lado], lado // 4, fill=cor)
    m = lado / 2
    d.line([(x + m * 0.42, y + m), (x + m * 0.85, y + m * 1.42)], fill=INK, width=max(3, lado // 9))
    d.line([(x + m * 0.85, y + m * 1.42), (x + m * 1.58, y + m * 0.6)],
           fill=INK, width=max(3, lado // 9))


def blocos(peca, plate):
    W, H = FORMATOS[peca["formato"]]
    k = H / 1920  # os tamanhos abaixo foram acertados no 9:16; o 4:5 escala junto
    if not isinstance(plate, Image.Image):
        plate = Image.open(plate)
    # A pilha come os dois terços de baixo. O que sobra da foto é a faixa do
    # topo, então o enquadramento tem que jogar o assunto para lá.
    canvas = cover(plate.convert("RGB"), (W, H),
                   peca.get("zoom", 1.0), peca.get("anchor_x", 0.5),
                   peca.get("anchor_y", 0.5))
    d = ImageDraw.Draw(canvas)
    margem = round(64 * k)
    util = W - margem * 2

    # Sombra curta só no topo: a marca fica sobre foto, o resto sobre bloco opaco.
    topo_escuro = Image.new("RGB", (W, round(260 * k)), FIELD)
    coluna = Image.new("L", (1, topo_escuro.height))
    coluna.putdata([int(200 * (1 - i / topo_escuro.height) ** 1.6)
                    for i in range(topo_escuro.height)])
    topo_escuro.putalpha(coluna.resize(topo_escuro.size))
    canvas.paste(topo_escuro, (0, 0), topo_escuro)
    marca(canvas, d, margem, round(64 * k), altura=round(52 * k))

    f_topo = fonte("Anton-Regular.ttf", round(46 * k))
    f_chamada = fonte("Anton-Regular.ttf", round(100 * k))
    f_corpo = fonte("SpaceMono-Regular.ttf", round(30 * k))
    f_corpo_b = fonte("SpaceMono-Bold.ttf", round(30 * k))
    f_item = fonte("SpaceMono-Regular.ttf", round(28 * k))
    f_cta = fonte("Anton-Regular.ttf", round(38 * k))

    pad_h = (round(30 * k), round(24 * k))
    pad_b = (round(32 * k), round(30 * k))
    lh_topo, lh_chamada = round(56 * k), round(112 * k)
    lh_corpo, lh_item = round(44 * k), round(40 * k)
    gap_item = round(20 * k)

    l_topo = _quebrar_marcado(peca["topo"], f_topo, util - pad_h[0] * 2)
    l_chamada = _quebrar_marcado(peca["chamada"], f_chamada, util - pad_h[0] * 2)
    corpo = [_quebrar_marcado(p, f_corpo, util - pad_b[0] * 2) for p in peca["corpo"]]
    lado = round(34 * k)
    recuo = lado + round(22 * k)
    itens = [_quebrar_marcado(i, f_item, util - pad_b[0] * 2 - recuo) for i in peca["itens"]]

    # Altura de cada bloco antes de desenhar: a pilha é ancorada no CTA, não no
    # topo. Com y fixo, texto mais longo empurrava o botão para fora da peça.
    off_topo, alt_topo = _metricas(f_topo, len(l_topo), lh_topo)
    off_chamada, alt_chamada = _metricas(f_chamada, len(l_chamada), lh_chamada)
    off_corpo = _metricas(f_corpo, 1, lh_corpo)[0]
    alt_corpo = [_metricas(f_corpo, len(c), lh_corpo)[1] for c in corpo]
    off_item = _metricas(f_item, 1, lh_item)[0]
    alt_itens = _altura_lista(f_item, itens, lh_item, gap_item) + pad_b[1] * 2

    gap_h, gap_bloco, gap_check = round(8 * k), round(16 * k), round(28 * k)
    pilha = (alt_topo + pad_h[1] * 2 + gap_h
             + alt_chamada + pad_h[1] * 2 + round(26 * k)
             + sum(a + pad_b[1] * 2 + gap_bloco for a in alt_corpo)
             + gap_check - gap_bloco + alt_itens)

    b = botao(peca["cta"], f_cta)
    y_cta = H - b.height - round(110 * k)
    y = max(round(0.22 * H), y_cta - round(44 * k) - pilha)

    # 1. chapéu na cor de marca. Na ref os dois blocos de headline são preto e
    # azul-marinho; aqui seriam #08090F e #0B0D22, que a essa distância é a
    # mesma cor. Invertido: chapéu no teal, chamada no marinho.
    _caixa(d, margem, y, l_topo, f_topo, util, pad_h, lh_topo, ACCENT)
    yy = y + pad_h[1] - off_topo
    for linha in l_topo:
        _escrever(d, margem + pad_h[0], yy, linha, f_topo, f_topo, FIELD, INK)
        yy += lh_topo
    y += alt_topo + pad_h[1] * 2 + gap_h

    # 2. chamada grande — o bloco que segura a peça de longe
    _caixa(d, margem, y, l_chamada, f_chamada, util, pad_h, lh_chamada, FIELD)
    yy = y + pad_h[1] - off_chamada
    for linha in l_chamada:
        _escrever(d, margem + pad_h[0], yy, linha, f_chamada, f_chamada, INK, ACCENT)
        yy += lh_chamada
    y += alt_chamada + pad_h[1] * 2 + round(26 * k)

    # 3. corpo em monoespaçada sobre branco — o contraste de textura da ref
    for linhas, alt in zip(corpo, alt_corpo):
        _caixa(d, margem, y, linhas, f_corpo, util, pad_b, lh_corpo, INK)
        yy = y + pad_b[1] - off_corpo
        for linha in linhas:
            _escrever(d, margem + pad_b[0], yy, linha, f_corpo, f_corpo_b, BREU, BREU)
            yy += lh_corpo
        y += alt + pad_b[1] * 2 + gap_bloco

    # 4. checklist — bloco de largura cheia, para fechar a pilha
    y += gap_check - gap_bloco
    d.rectangle([margem, y, margem + util, y + alt_itens], fill=INK)
    yy = y + pad_b[1] - off_item
    for linhas in itens:
        _check(d, margem + pad_b[0], yy + off_item + round(2 * k), lado, VERDE_CHECK)
        for linha in linhas:
            _escrever(d, margem + pad_b[0] + recuo, yy, linha, f_item, f_item, BREU, BREU)
            yy += lh_item
        yy += gap_item

    canvas.paste(b, (margem, y_cta), b)
    return canvas


LAYOUTS = {"oferta": oferta, "antes-depois": antes_depois, "blocos": blocos}

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--peca", required=True, choices=sorted(PECAS))
    p.add_argument("--plate", default=None)
    p.add_argument("--out", required=True)
    a = p.parse_args()
    peca = PECAS[a.peca]
    # O nome da peça não é o nome do layout: `blocos` e `blocos-10mais` rodam
    # o mesmo desenho com conteúdos diferentes.
    layout = peca.get("layout", a.peca)
    if layout in ("oferta", "blocos") and not a.plate:
        raise SystemExit(f"a peça {a.peca} precisa de --plate")
    canvas = LAYOUTS[layout](peca, a.plate)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    canvas.save(a.out, "PNG")
    print(f"Pronto: {a.out}  {canvas.width}x{canvas.height}")
