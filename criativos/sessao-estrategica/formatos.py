#!/usr/bin/env python3
"""
Anúncios em formato nativo — UI de app recriada em código.

    python3 formatos.py --peca notas    --out out/nativo-notas.png
    python3 formatos.py --peca whatsapp --out out/nativo-whatsapp.png
    python3 formatos.py --peca lockscreen --out out/nativo-lockscreen.png
    python3 formatos.py --peca busca     --out out/nativo-busca.png

Por que não passa pelo Kling: modelo generativo escreve texto embaralhado em
tela e em papel. Interface fake só convence se for construída, não gerada.

Estes anúncios são **dramatizações** — conversa e nota são roteiro, não registro
real. Regras que mantêm isso honesto:
  - nenhum nome de cliente ou colaborador real
  - nenhuma frase apresentada como depoimento
  - todo dado citado tem que ser verdadeiro da oferta
  - marcar conteúdo gerado por IA / dramatização na subida
"""

import argparse
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE = os.path.dirname(os.path.abspath(__file__))
W, H = 1080, 1350
UI_H = 1080                      # a UI ocupa o quadrado de cima
BANDA_Y = UI_H                   # faixa da marca embaixo

FIELD = (11, 13, 34)
INK = (255, 255, 255)
ACCENT = (43, 191, 160)
CTA_GRADIENT = [(61, 214, 58), (43, 191, 160), (41, 180, 246)]

FONTE_UI = os.path.join(BASE, "fonts", "Inter-var.ttf")


def ui(peso="Regular", tamanho=34):
    f = ImageFont.truetype(FONTE_UI, tamanho)
    f.set_variation_by_name(peso)
    return f


def marca_fonte(nome, tamanho):
    return ImageFont.truetype(os.path.join(BASE, "fonts", nome), tamanho)


def quebrar(texto, fonte, largura):
    linhas, linha = [], ""
    for palavra in texto.split():
        teste = f"{linha} {palavra}".strip()
        if fonte.getlength(teste) <= largura or not linha:
            linha = teste
        else:
            linhas.append(linha)
            linha = palavra
    if linha:
        linhas.append(linha)
    return linhas


def gradiente_h(largura, altura, paradas):
    g = Image.new("RGB", (largura, 1))
    for x in range(largura):
        t = x / max(1, largura - 1)
        i = 0 if t < 0.5 else 1
        u = t * 2 if t < 0.5 else (t - 0.5) * 2
        a, b = paradas[i], paradas[i + 1]
        g.putpixel((x, 0), tuple(round(a[c] + (b[c] - a[c]) * u) for c in range(3)))
    return g.resize((largura, altura))


def banda_marca(canvas, chamada, cta="AGENDAR DIAGNÓSTICO"):
    """Faixa da marca no rodapé — separa o anúncio da UI imitada.

    Sem ela a peça vira só um print e o Meta não tem onde ancorar a marca no
    autoplay. Com ela, fica claro que é anúncio.
    """
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, BANDA_Y, W, H], fill=FIELD)

    logo_path = os.path.join(BASE, "marca", "logo-marca.png")
    x = 56
    if os.path.exists(logo_path):
        simbolo = Image.open(logo_path).convert("RGBA")
        alt = 52
        simbolo = simbolo.resize((round(simbolo.width * alt / simbolo.height), alt), Image.LANCZOS)
        canvas.paste(simbolo, (x, BANDA_Y + 40), simbolo)
        x += simbolo.width + 16
    f_marca = marca_fonte("Poppins-Bold.ttf", 25)
    d.text((x, BANDA_Y + 40), "Sevilha", font=f_marca, fill=INK)
    d.text((x, BANDA_Y + 68), "Performance",
           font=marca_fonte("Poppins-Medium.ttf", 25), fill=(255, 255, 255, 180))

    f_chamada = marca_fonte("Poppins-SemiBold.ttf", 33)
    y = BANDA_Y + 132
    for linha in quebrar(chamada, f_chamada, 640):
        d.text((56, y), linha, font=f_chamada, fill=INK)
        y += 44

    f_cta = marca_fonte("Anton-Regular.ttf", 30)
    cx = f_cta.getbbox(cta)
    bw, bh = cx[2] - cx[0] + 68, cx[3] - cx[1] + 40
    botao = gradiente_h(bw, bh, CTA_GRADIENT)
    mascara = Image.new("L", (bw, bh), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, bw - 1, bh - 1], 12, fill=255)
    botao.putalpha(mascara)
    ImageDraw.Draw(botao).text((34 - cx[0], 20 - cx[1]), cta, font=f_cta, fill=INK)
    canvas.paste(botao, (W - bw - 56, H - bh - 46), botao)


def status_bar(d, hora, cor=INK):
    f = ui("SemiBold", 30)
    d.text((60, 34), hora, font=f, fill=cor)
    # sinal, wifi e bateria em blocos simples — o suficiente na escala do feed
    x = W - 190
    for i, alt in enumerate((10, 16, 22, 28)):
        d.rounded_rectangle([x + i * 14, 56 - alt, x + i * 14 + 9, 56], 2, fill=cor)
    d.rounded_rectangle([W - 118, 34, W - 66, 58], 7, outline=cor, width=3)
    d.rounded_rectangle([W - 114, 38, W - 78, 54], 4, fill=cor)


# ── peça 1 — Apple Notes ────────────────────────────────────────────────────
def notas(canvas):
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, 0, W, UI_H], fill=(0, 0, 0))
    amarelo = (255, 214, 10)

    status_bar(d, "23:47")

    # header: chevron voltar + ações
    d.line([(72, 108), (52, 124), (72, 140)], fill=amarelo, width=6, joint="curve")
    d.text((84, 106), "Notas", font=ui("Regular", 34), fill=amarelo)
    d.text((W - 260, 106), "Concluir", font=ui("SemiBold", 32), fill=amarelo)

    y = 210
    d.text((60, y), "Só eu resolvo", font=ui("Bold", 62), fill=INK)
    y += 92
    d.text((60, y), "domingo, 23:47", font=ui("Regular", 28), fill=(142, 142, 147))
    y += 74

    itens = [
        "aprovar as férias do time",
        "ver por que a implantação travou",
        "refazer a precificação da folha",
        "falar sobre o retrabalho de novo",
        "responder o cliente que ligou 3x",
        "descobrir onde a margem foi parar",
    ]
    f_item = ui("Regular", 37)
    for item in itens:
        d.ellipse([60, y + 6, 92, y + 38], outline=(99, 99, 102), width=3)
        d.text((116, y), item, font=f_item, fill=INK)
        y += 68

    y += 26
    f_fim = ui("Regular", 37)
    d.text((60, y), "amanhã eu organizo isso", font=f_fim, fill=(142, 142, 147))
    largura = f_fim.getlength("amanhã eu organizo isso")
    d.line([(60, y + 26), (60 + largura, y + 26)], fill=(142, 142, 147), width=3)
    y += 62
    d.text((60, y), "(escrevi isso em março também)", font=ui("Regular", 33),
           fill=(99, 99, 102))

    # barra de ferramentas do Notas — sem ela sobra um vazio que denuncia a montagem
    d.line([(0, UI_H - 108), (W, UI_H - 108)], fill=(28, 28, 30), width=2)
    for i, cx in enumerate((190, 400, 610, 820)):
        d.rounded_rectangle([cx - 26, UI_H - 78, cx + 26, UI_H - 26], 10,
                            outline=(142, 142, 147), width=3)
        if i == 1:
            d.line([(cx - 12, UI_H - 52), (cx + 12, UI_H - 52)], fill=(142, 142, 147), width=3)

    banda_marca(canvas, "Se só você resolve, você não tem um time. Tem uma fila.")


# ── peça 2 — WhatsApp ───────────────────────────────────────────────────────
def whatsapp(canvas):
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, 0, W, UI_H], fill=(11, 20, 26))
    d.rectangle([0, 0, W, 170], fill=(32, 44, 51))

    status_bar(d, "21:34")

    d.line([(74, 108), (54, 124), (74, 140)], fill=(233, 237, 239), width=6, joint="curve")
    d.ellipse([90, 96, 146, 152], fill=(102, 119, 129))
    d.text((108, 108), "M", font=ui("SemiBold", 34), fill=INK)
    d.text((162, 96), "Marcelo · Fiscal", font=ui("SemiBold", 34), fill=(233, 237, 239))
    d.text((162, 136), "online", font=ui("Regular", 26), fill=(134, 150, 160))

    # divisor de data
    f_div = ui("Medium", 25)
    texto = "DOMINGO"
    largura = f_div.getlength(texto) + 44
    d.rounded_rectangle([(W - largura) / 2, 200, (W + largura) / 2, 248], 12,
                        fill=(28, 42, 51))
    d.text(((W - f_div.getlength(texto)) / 2, 210), texto, font=f_div, fill=(134, 150, 160))

    thread = [
        ("in", "desculpa incomodar domingo", "21:31"),
        ("in", "o cliente cobrou o balancete e eu não sei se pode enviar", "21:31"),
        ("out", "pode", "21:33"),
        ("in", "e a guia do Simples, aplico a mesma regra do mês passado?", "21:33"),
        ("out", "não. me manda aqui que eu vejo", "21:34"),
        ("in", "valeu, desculpa de novo", "21:34"),
    ]
    f_msg = ui("Regular", 34)
    f_hora = ui("Regular", 23)
    y = 290
    for lado, texto, hora in thread:
        linhas = quebrar(texto, f_msg, 560)
        largura = max(f_msg.getlength(l) for l in linhas) + 40 + f_hora.getlength(hora) + 20
        altura = len(linhas) * 46 + 34
        if lado == "in":
            x0, cor = 44, (32, 44, 51)
        else:
            x0, cor = W - 44 - largura, (0, 92, 75)
        d.rounded_rectangle([x0, y, x0 + largura, y + altura], 18, fill=cor)
        yy = y + 16
        for linha in linhas:
            d.text((x0 + 22, yy), linha, font=f_msg, fill=(233, 237, 239))
            yy += 46
        d.text((x0 + largura - f_hora.getlength(hora) - 18, y + altura - 34),
               hora, font=f_hora, fill=(134, 150, 160))
        y += altura + 18

    # campo de digitação — ancora o thread no rodapé e fecha a ilusão
    d.rounded_rectangle([44, UI_H - 116, W - 150, UI_H - 32], 42, fill=(32, 44, 51))
    d.text((84, UI_H - 96), "Mensagem", font=ui("Regular", 32), fill=(134, 150, 160))
    d.ellipse([W - 132, UI_H - 116, W - 48, UI_H - 32], fill=(0, 168, 132))
    d.polygon([(W - 106, UI_H - 92), (W - 106, UI_H - 56), (W - 68, UI_H - 74)], fill=INK)

    banda_marca(canvas, "Domingo, 21h34. Isso não é dedicação do time — é falta de processo.")


# ── peça 3 — tela bloqueada ─────────────────────────────────────────────────
def lockscreen(canvas):
    fundo = Image.new("RGB", (W, UI_H), (14, 18, 30))
    d0 = ImageDraw.Draw(fundo)
    for i in range(60):  # brilho difuso, para não ficar um chapado morto
        d0.ellipse([120 + i * 9, -260 + i * 13, 640 + i * 9, 300 + i * 13],
                   outline=(20, 26, 42))
    fundo = fundo.filter(ImageFilter.GaussianBlur(38))
    canvas.paste(fundo, (0, 0))
    d = ImageDraw.Draw(canvas)

    status_bar(d, "23:47")

    f_data = ui("SemiBold", 34)
    texto = "domingo, 3 de agosto"
    d.text(((W - f_data.getlength(texto)) / 2, 150), texto, font=f_data, fill=(210, 214, 224))
    f_hora = ui("Medium", 190)
    hora = "23:47"
    d.text(((W - f_hora.getlength(hora)) / 2, 200), hora, font=f_hora, fill=INK)

    notificacoes = [
        ((37, 211, 102), "WhatsApp", "Equipe Fiscal", "12 mensagens não lidas"),
        ((234, 67, 53), "Mail", "Cliente", "URGENTE — folha não fechou"),
        ((37, 211, 102), "WhatsApp", "Marcelo · Fiscal", "desculpa incomodar domingo"),
        ((0, 122, 255), "Agenda", "Amanhã, 07:30", "Reunião que você marcou domingo"),
    ]
    y = 428
    f_app = ui("Medium", 24)
    f_tit = ui("SemiBold", 32)
    f_txt = ui("Regular", 30)
    for cor, app, titulo, corpo in notificacoes:
        d.rounded_rectangle([48, y, W - 48, y + 128], 26, fill=(38, 42, 56))
        d.rounded_rectangle([76, y + 30, 144, y + 98], 16, fill=cor)
        d.text((166, y + 22), app.upper(), font=f_app, fill=(160, 166, 180))
        d.text((166, y + 52), titulo, font=f_tit, fill=INK)
        d.text((166, y + 92), corpo, font=f_txt, fill=(196, 201, 214))
        y += 138

    d.rounded_rectangle([48, y, W - 48, y + 84], 26, fill=(30, 34, 46))
    f_mais = ui("Medium", 30)
    texto = "+ 41 notificações do escritório"
    d.text(((W - f_mais.getlength(texto)) / 2, y + 26), texto, font=f_mais,
           fill=(170, 176, 190))

    banda_marca(canvas, "Um escritório saudável não te procura no domingo à noite.")


# ── peça 4 — busca ──────────────────────────────────────────────────────────
def busca(canvas):
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, 0, W, UI_H], fill=(255, 255, 255))

    status_bar(d, "23:47", cor=(32, 33, 36))

    consulta = "como fazer meu escritório contábil"
    consulta2 = "funcionar sem mim"
    d.rounded_rectangle([48, 130, W - 48, 254], 62, fill=(255, 255, 255),
                        outline=(223, 225, 229), width=3)
    d.ellipse([88, 172, 128, 212], outline=(95, 99, 104), width=5)
    d.line([(122, 206), (140, 224)], fill=(95, 99, 104), width=6)
    f_q = ui("Regular", 36)
    d.text((166, 152), consulta, font=f_q, fill=(32, 33, 36))
    d.text((166, 196), consulta2, font=f_q, fill=(32, 33, 36))

    sugestoes = [
        ("como fazer meu escritório contábil ", "funcionar sem mim"),
        ("por que meu escritório ", "cresce e a margem não"),
        ("como delegar sem ", "perder qualidade contabilidade"),
        ("dono de contabilidade ", "trabalhando domingo é normal"),
        ("como sair do operacional ", "escritório contábil"),
    ]
    # autofit: a sugestão mais longa define o corpo, senão estoura a margem direita
    corpo = 35
    while corpo > 22:
        f_s, f_b = ui("Regular", corpo), ui("SemiBold", corpo)
        if max(f_s.getlength(a) + f_b.getlength(b) for a, b in sugestoes) <= W - 166 - 56:
            break
        corpo -= 1

    y = 320
    for base, negrito in sugestoes:
        d.ellipse([88, y + 22, 122, y + 56], outline=(154, 160, 166), width=4)
        d.line([(117, 51 + y), (133, 67 + y)], fill=(154, 160, 166), width=5)
        x = 166
        d.text((x, y + 18), base, font=f_s, fill=(32, 33, 36))
        x += f_s.getlength(base)
        d.text((x, y + 18), negrito, font=f_b, fill=(32, 33, 36))
        y += 100

    d.line([(48, y + 40), (W - 48, y + 40)], fill=(232, 234, 237), width=2)
    d.text((166, y + 92), "Cerca de 2.740.000 resultados", font=ui("Regular", 30),
           fill=(112, 117, 122))
    d.text((166, y + 152), "Nenhum deles é o seu escritório.", font=ui("SemiBold", 36),
           fill=(32, 33, 36))

    banda_marca(canvas, "A resposta não está no Google. Está nos seus números.")


PECAS = {"notas": notas, "whatsapp": whatsapp, "lockscreen": lockscreen, "busca": busca}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--peca", required=True, choices=sorted(PECAS))
    p.add_argument("--out", required=True)
    a = p.parse_args()

    canvas = Image.new("RGB", (W, H), FIELD)
    PECAS[a.peca](canvas)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    canvas.save(a.out, "PNG")
    print(f"Pronto: {a.out}  {W}x{H}")
