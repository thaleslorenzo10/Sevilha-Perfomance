"""Compõe um criativo da Sessão Estratégica e devolve o PNG.

Existe porque a tipografia das peças é desenhada em Pillow, e o n8n não roda
Python com PIL. O n8n orquestra (Kling, Drive, WhatsApp) e chama este endpoint
para a única etapa que precisa de Python.

POST /api/compor
Header: x-compor-token: <COMPOR_TOKEN>

Peça com plate do Kling:
    {"peca": "conceito-4", "plate_url": "https://...", "formato": "4:5"}

Formato nativo (não usa Kling — a UI é desenhada inteira):
    {"nativo": "notas"}

Resposta: image/png (binário).

Os parâmetros de recorte de cada peça vivem em PRESETS, no compor.py — a
automação pede a peça, não a geometria. Dá para sobrescrever qualquer um
passando zoom, anchor_x, anchor_y, coluna_frac, headline_y, cta_y ou leading
no corpo.
"""

import hashlib
import hmac
import io
import json
import os
import sys
import urllib.request
from http.server import BaseHTTPRequestHandler

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRIATIVOS = os.path.join(RAIZ, "criativos", "sessao-estrategica")
sys.path.insert(0, CRIATIVOS)

from PIL import Image  # noqa: E402
import compor as compositor  # noqa: E402
import formatos as nativos  # noqa: E402
import oferta as layouts  # noqa: E402

FONTES = os.path.join(CRIATIVOS, "fonts")
LOGO = os.path.join(CRIATIVOS, "marca", "logo-marca.png")

# Só estes podem ser sobrescritos pelo corpo da requisição.
AJUSTAVEIS = {"zoom", "anchor_x", "anchor_y", "coluna_frac", "headline_y", "cta_y", "leading"}

# Limite por linha da headline no layout `compor`. Acima disso o autofit encolhe
# o corpo até a peça perder o soco — melhor recusar e deixar o gerador reescrever
# do que entregar uma arte fraca.
MAX_LINHA_HEADLINE = 17

LIMITE_PLATE = 12 * 1024 * 1024


def baixar(url):
    if not url.startswith("https://"):
        raise ValueError("plate_url precisa ser https")
    req = urllib.request.Request(url, headers={"User-Agent": "sevilha-compor"})
    with urllib.request.urlopen(req, timeout=25) as r:
        dados = r.read(LIMITE_PLATE + 1)
    if len(dados) > LIMITE_PLATE:
        raise ValueError("plate acima de 12 MB")
    return Image.open(io.BytesIO(dados)).convert("RGB")


def validar_conceito(c, layout):
    """Recusa conceito que renderizaria mal, com o motivo — o gerador reescreve."""
    if layout == "antes-depois":
        for campo in ("titulo", "antes", "depois"):
            if not isinstance(c.get(campo), list) or not c[campo]:
                raise ValueError(f"conceito.{campo} precisa ser uma lista não vazia")
        return
    if layout == "oferta":
        for campo in ("tarja", "corpo", "por"):
            if not isinstance(c.get(campo), str) or not c[campo].strip():
                raise ValueError(f"conceito.{campo} precisa ser texto")
        if c.get("de"):
            raise ValueError("âncora 'de' recusada: não existe preço já praticado para a "
                             "Sessão Estratégica, e anunciar um seria propaganda enganosa")
        return
    linhas = c.get("headline")
    if not isinstance(linhas, list) or not 2 <= len(linhas) <= 6:
        raise ValueError("conceito.headline precisa ser uma lista de 2 a 6 linhas")
    longas = [l for l in linhas if len(l) > MAX_LINHA_HEADLINE]
    if longas:
        raise ValueError(f"linha de headline acima de {MAX_LINHA_HEADLINE} caracteres: "
                         f"{longas[0]!r} ({len(longas[0])}). Reescreva mais curto.")
    if not isinstance(c.get("subhead"), str):
        raise ValueError("conceito.subhead precisa ser texto")
    c.setdefault("accent_lines", [len(linhas) - 2, len(linhas) - 1])
    c.setdefault("cta", "AGENDAR DIAGNÓSTICO")


def montar(corpo):
    # Conceito escrito na hora pelo gerador, em vez de peça de nome conhecido.
    if corpo.get("conceito"):
        conceito = dict(corpo["conceito"])
        layout = corpo.get("layout", "compor")
        if layout not in ("compor", "oferta", "antes-depois"):
            raise ValueError(f"layout desconhecido: {layout}")
        validar_conceito(conceito, layout)

        if layout == "antes-depois":
            conceito.setdefault("formato", "4:5")
            conceito.setdefault("cta", "AGENDAR DIAGNÓSTICO")
            conceito.setdefault("rodape", "")
            return layouts.antes_depois(conceito)

        if not corpo.get("plate_url"):
            raise ValueError("layout com foto exige plate_url")
        plate = baixar(corpo["plate_url"])

        if layout == "oferta":
            conceito.setdefault("formato", "9:16")
            conceito.setdefault("rodape", "Sem custo e sem compromisso")
            conceito.setdefault("cta", "AGENDAR DIAGNÓSTICO")
            conceito["de"] = None
            return layouts.oferta(conceito, plate)  # aceita Image, ver oferta.py

        formato = corpo.get("formato", "4:5")
        if formato not in compositor.FORMATOS:
            raise ValueError(f"formato desconhecido: {formato}")
        params = {k: v for k, v in corpo.items() if k in AJUSTAVEIS}
        params.setdefault("coluna_frac", 0.56)
        params["logo"] = LOGO
        return compositor.renderizar(plate, conceito, formato, FONTES, **params)

    if corpo.get("nativo"):
        nome = corpo["nativo"]
        if nome not in nativos.PECAS:
            raise ValueError(f"formato nativo desconhecido: {nome}")
        canvas = Image.new("RGB", (nativos.W, nativos.H), nativos.FIELD)
        nativos.PECAS[nome](canvas)
        return canvas

    nome = corpo.get("peca")
    if nome not in compositor.PECAS:
        raise ValueError(f"peça desconhecida: {nome}")
    formato = corpo.get("formato", "4:5")
    if formato not in compositor.FORMATOS:
        raise ValueError(f"formato desconhecido: {formato}")
    if not corpo.get("plate_url"):
        raise ValueError("peça com plate exige plate_url")

    params = dict(compositor.PRESETS.get((nome, formato), {}))
    params.update({k: v for k, v in corpo.items() if k in AJUSTAVEIS})
    params["logo"] = LOGO

    return compositor.renderizar(
        baixar(corpo["plate_url"]), compositor.PECAS[nome], formato, FONTES, **params
    )


def digitais(valor):
    """Oito primeiros hex do SHA-256 — compara dois segredos sem revelar nenhum."""
    return hashlib.sha256(valor.encode()).hexdigest()[:8]


def catalogo():
    """Peças disponíveis + o prompt de plate de cada uma.

    O n8n consome isto em vez de guardar cópia dos prompts: prompt editado no
    repositório vale na automação sem mexer no workflow.
    """
    prompts = os.path.join(CRIATIVOS, "prompts", "plates")
    com_plate = []
    for peca in sorted(compositor.PECAS):
        numero = peca.split("-")[1]
        arquivo = next(
            (os.path.join(prompts, f) for f in sorted(os.listdir(prompts))
             if f.startswith(f"conceito-{numero}-")), None)
        if arquivo:
            with open(arquivo, encoding="utf-8") as fh:
                com_plate.append({"peca": peca, "prompt": fh.read().strip()})
    return {
        "com_plate": com_plate,
        "nativos": sorted(nativos.PECAS),
        # Matéria-prima do gerador de conceitos.
        "briefing": {
            "fatos": compositor.FATOS,
            "eixos": compositor.EIXOS,
            "layouts": compositor.LAYOUTS,
            "limite_linha_headline": MAX_LINHA_HEADLINE,
        },
    }


class handler(BaseHTTPRequestHandler):
    def _erro(self, status, mensagem):
        payload = json.dumps({"erro": mensagem}).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _checar_token(self):
        """Devolve (status, mensagem) quando barra, ou None quando libera.

        A mensagem distingue as três causas de 401 em vez de dizer só "token
        inválido" — sem isso, descobrir de que lado está o erro vira tentativa
        e erro entre dois painéis, com um deploy de 3 minutos a cada palpite.

        A impressão digital é o começo do SHA-256, não o token: serve para
        comparar os dois lados sem expor o valor de nenhum deles.
        """
        esperado = os.environ.get("COMPOR_TOKEN", "")
        recebido = self.headers.get("x-compor-token", "")

        if not esperado:
            # Nomes parecidos, nunca valores: se o nome foi digitado errado na
            # Vercel, ele aparece aqui e o erro deixa de ser adivinhação.
            parecidas = sorted(n for n in os.environ if "COMPOR" in n.upper())
            pista = (f" Variáveis com COMPOR no nome que chegaram até a função: "
                     f"{', '.join(parecidas)}." if parecidas else
                     " Nenhuma variável com COMPOR no nome chegou até a função.")
            return 503, ("COMPOR_TOKEN não está definida neste deploy. Confira se a "
                         "variável existe na Vercel, se está marcada para Production "
                         "e se houve redeploy depois de salvá-la." + pista)
        if not recebido:
            return 401, ("header x-compor-token ausente. No n8n, o campo Name da "
                         "credencial Header Auth precisa ser exatamente x-compor-token.")
        if not hmac.compare_digest(esperado, recebido):
            return 401, (f"token não confere. Recebido: {len(recebido)} caracteres, "
                         f"impressão {digitais(recebido)}. Esperado: {len(esperado)} "
                         f"caracteres, impressão {digitais(esperado)}.")
        return None

    def do_GET(self):
        barrado = self._checar_token()
        if barrado:
            return self._erro(*barrado)
        payload = json.dumps(catalogo(), ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        barrado = self._checar_token()
        if barrado:
            return self._erro(*barrado)

        try:
            tamanho = int(self.headers.get("Content-Length") or 0)
            corpo = json.loads(self.rfile.read(tamanho) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self._erro(400, "corpo não é JSON válido")

        try:
            canvas = montar(corpo)
        except ValueError as e:
            return self._erro(400, str(e))
        except Exception as e:  # rede, plate corrompido, fonte ausente
            return self._erro(502, f"falha ao compor: {e}")

        buf = io.BytesIO()
        canvas.save(buf, "PNG")
        png = buf.getvalue()

        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(png)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(png)
