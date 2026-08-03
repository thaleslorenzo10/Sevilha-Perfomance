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

FONTES = os.path.join(CRIATIVOS, "fonts")
LOGO = os.path.join(CRIATIVOS, "marca", "logo-marca.png")

# Só estes podem ser sobrescritos pelo corpo da requisição.
AJUSTAVEIS = {"zoom", "anchor_x", "anchor_y", "coluna_frac", "headline_y", "cta_y", "leading"}

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


def montar(corpo):
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
    return {"com_plate": com_plate, "nativos": sorted(nativos.PECAS)}


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
