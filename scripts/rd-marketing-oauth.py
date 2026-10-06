#!/usr/bin/env python3
"""RD Marketing OAuth local: login, refresh e GET; nunca envia email."""
import argparse
import hmac
import json
import os
from pathlib import Path
import secrets
import shlex
import subprocess
import tempfile
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / ".env.local"
BASE = "https://api.rd.services"
PREFIX = "RD_MARKETING_"


def read_env(path):
    result = {}
    for line in path.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip().startswith("export "):
            key = key.strip()[7:]
        parts = shlex.split(value, comments=True)
        result[key.strip()] = " ".join(parts)
    return result


def store(values, path=ENV):
    subprocess.run(["git", "check-ignore", "--quiet", str(path)],
                   cwd=ROOT, check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL)
    lines = path.read_text().splitlines()
    for key, value in values.items():
        replacement = f"{key}={json.dumps(str(value))}"
        matches = [i for i, line in enumerate(lines)
                   if line.split("=", 1)[0].strip().removeprefix("export ") == key]
        if len(matches) > 1:
            raise ValueError("Variavel duplicada no arquivo privado")
        if matches:
            lines[matches[0]] = replacement
        else:
            lines.append(replacement)
    fd, temporary = tempfile.mkstemp(prefix=".env.local.rd-oauth-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as handle:
            handle.write("\n".join(lines) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def request(path, body=None, token=None, opener=urlopen):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    try:
        with opener(Request(BASE + path, data=data, headers=headers), timeout=30) as response:
            result = json.load(response)
    except HTTPError as error:
        raise ValueError(f"RD HTTP {error.code}; corpo omitido por conter dados privados") from None
    except (URLError, TimeoutError):
        raise ValueError("RD indisponivel; nenhuma operacao repetida") from None
    if not isinstance(result, dict) or result.get("error") or result.get("errors"):
        raise ValueError("Resposta RD invalida; corpo omitido")
    return result


def require(config, *names):
    missing = [PREFIX + name for name in names if not config.get(PREFIX + name)]
    if missing:
        raise ValueError("Preencher no arquivo privado: " + ", ".join(missing))


def tokens(config, code=None):
    require(config, "CLIENT_ID", "CLIENT_SECRET")
    body = {"client_id": config[PREFIX + "CLIENT_ID"],
            "client_secret": config[PREFIX + "CLIENT_SECRET"]}
    if code:
        body["code"] = code
    else:
        require(config, "REFRESH_TOKEN")
        body["refresh_token"] = config[PREFIX + "REFRESH_TOKEN"]
    result = request("/auth/token" + ("?token_by=code" if code else ""), body)
    if not isinstance(result.get("access_token"), str) or not result["access_token"]:
        raise ValueError("RD nao retornou access_token valido")
    refresh = result.get("refresh_token") or config.get(PREFIX + "REFRESH_TOKEN")
    if not isinstance(refresh, str) or not refresh:
        raise ValueError("RD nao retornou refresh_token valido")
    expires = int(result.get("expires_in", 86400))
    if expires <= 0:
        raise ValueError("RD retornou validade invalida")
    store({PREFIX + "ACCESS_TOKEN": result["access_token"],
           PREFIX + "REFRESH_TOKEN": refresh,
           PREFIX + "ACCESS_TOKEN_EXPIRES_AT": int(time.time()) + expires})
    return result["access_token"]


def callback(query, expected_state):
    params = parse_qs(query)
    if params.get("error"):
        raise ValueError("Autorizacao RD recusada")
    state, code = params.get("state", []), params.get("code", [])
    if len(state) != 1 or not state[0].isascii() or not hmac.compare_digest(state[0], expected_state):
        raise ValueError("Callback rejeitada: state invalido")
    if len(code) != 1 or not code[0]:
        raise ValueError("Callback sem code unico")
    return code[0]


def login(config):
    require(config, "CLIENT_ID", "CLIENT_SECRET", "REDIRECT_URI")
    redirect = config[PREFIX + "REDIRECT_URI"]
    parsed = urlsplit(redirect)
    if parsed.scheme != "http" or parsed.hostname != "127.0.0.1" or parsed.query or parsed.fragment:
        raise ValueError("Callback local exige http://127.0.0.1:8765/rd/callback")
    if parsed.path != "/rd/callback" or parsed.port != 8765:
        raise ValueError("Callback local exige porta 8765 e caminho /rd/callback")
    state = secrets.token_urlsafe(32)
    outcome = {}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # nunca gravar query com codigo OAuth

        def do_GET(self):
            target = urlsplit(self.path)
            if target.path != parsed.path:
                self.send_error(404)
                return
            try:
                code = callback(target.query, state)
                outcome["token"] = tokens(config, code)
                message = "RD conectado. Pode fechar esta aba."
                status = 200
            except ValueError as error:
                message, status = str(error), 400
            self.send_response(status)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Referrer-Policy", "no-referrer")
            self.end_headers()
            self.wfile.write(message.encode())

    with HTTPServer(("127.0.0.1", 8765), Handler) as server:
        server.timeout = 1
        print("Abra no navegador e escolha somente Sevilha Performance:", flush=True)
        print(BASE + "/auth/dialog?" + urlencode({"client_id": config[PREFIX + "CLIENT_ID"],
              "redirect_uri": redirect, "state": state}), flush=True)
        deadline = time.monotonic() + 600
        while "token" not in outcome and time.monotonic() < deadline:
            server.handle_request()
    if "token" not in outcome:
        raise ValueError("Login expirou sem conectar; nenhum token alterado por timeout")
    return outcome["token"]


def verify(token):
    for resource in ("segmentations", "emails", "workflows"):
        result = request("/platform/" + resource, token=token)
        items = result.get("items" if resource == "emails" else resource)
        count = len(items) if isinstance(items, list) else None
        print(json.dumps({"resource": resource, "http_status": 200,
                          "first_page_count": count}))


def self_check():
    from unittest.mock import patch
    assert callback("code=mock-code&state=mock-state", "mock-state") == "mock-code"
    for query in ("code=x&state=bad", "code=x", "code=x&code=y&state=good", "code=x&state=%C3%A9"):
        try:
            callback(query, "good")
        except ValueError:
            pass
        else:
            raise AssertionError("Callback invalida aceita")
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "env"
        path.write_text('# comment\nKEY="quoted value"\nEMPTY=\nRAW=abc # note\n')
        assert read_env(path) == {"KEY": "quoted value", "EMPTY": "", "RAW": "abc"}
        with patch("subprocess.run"):
            store({"KEY": "new secret", "ADDED": "refresh mock"}, path)
            assert read_env(path)["KEY"] == "new secret"
            assert read_env(path)["ADDED"] == "refresh mock"
            assert path.stat().st_mode & 0o777 == 0o600
            assert "# comment" in path.read_text()
            assert read_env(path)["RAW"] == "abc"
    class MockResponse:
        def __enter__(self):
            return self
        def __exit__(self, *_args):
            return False
        def read(self):
            return b'{"total":2,"items":[{},{}]}'
    assert request("/platform/emails", opener=lambda *_a, **_k: MockResponse()) == {"total": 2, "items": [{}, {}]}
    responses = ({"segmentations": [{}]}, {"total": 9, "items": [{}, {}]}, {"workflows": []})
    with patch(__name__ + ".request", side_effect=responses), patch("builtins.print") as output:
        verify("mock-token")
        assert [json.loads(call.args[0])["first_page_count"] for call in output.call_args_list] == [1, 2, 0]
    print("self-check: passou; nenhuma rede, token real ou disparo")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("login", "verify", "self-check"))
    mode = parser.parse_args().mode
    if mode == "self-check":
        self_check()
        return
    config = read_env(ENV)
    token = login(config) if mode == "login" else tokens(config)
    verify(token)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError):
        # Evita traceback/URL/code/tokens; detalhes privados ficam fora do console.
        print("Conexao nao concluida. Confira variaveis privadas, callback, consentimento e disponibilidade RD.")
        raise SystemExit(1)
