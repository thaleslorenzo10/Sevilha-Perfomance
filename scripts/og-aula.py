"""Imagem OG da aula (1200x630). Pillow já é dependência do projeto.
   python3 scripts/og-aula.py
"""
from PIL import Image, ImageDraw, ImageFont
W, H = 1200, 630
ROXO, NEON, BRANCO = (21, 12, 67), (80, 220, 0), (255, 255, 255)
img = Image.new("RGB", (W, H), ROXO)
d = ImageDraw.Draw(img)
def fonte(tam):
    for p in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf"]:
        try: return ImageFont.truetype(p, tam)
        except OSError: pass
    return ImageFont.load_default()
tag = fonte(44)
larg = d.textlength("AULA AO VIVO", font=tag)
d.rectangle([80, 150, 80 + larg + 24, 150 + 62], fill=NEON)
d.text((92, 156), "AULA AO VIVO", font=tag, fill=ROXO)
for i, linha in enumerate(["O projeto que transforma a", "operação de um escritório", "contábil — do mapeamento à margem"]):
    d.text((80, 250 + i * 70), linha, font=fonte(56), fill=BRANCO)
d.text((80, 520), "2h10 · 5 planilhas do método · escritórios 10+ · R$ 47", font=fonte(30), fill=NEON)
img.save("assets/og-aula.png", optimize=True)
print("assets/og-aula.png")
