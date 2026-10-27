#!/usr/bin/env python3
"""Job pontual autorizado: valida checkout, publica preço e ativa anúncios em27/10."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess

STATE = Path(os.environ.get('SEVILHA_LOTE47_STATE', '/home/codex/.local/state/sevilha/aula-lote47-20261027'))
START = datetime.fromisoformat('2026-10-27T10:00:00+00:00')
END = datetime.fromisoformat('2026-10-27T20:30:00+00:00')
TAG = '# SEVILHA_AULA_LOTE47_20261027'


def unschedule():
    result = subprocess.run(['crontab', '-l'], capture_output=True, text=True, check=True)
    lines = result.stdout.splitlines()
    filtered = [line for line in lines if not line.endswith(TAG)]
    if len(filtered) != len(lines):
        subprocess.run(['crontab', '-'], input='\n'.join(filtered) + '\n', text=True, check=True)


def main():
    now = datetime.now(timezone.utc)
    if now < START:
        return
    if now >= END:
        unschedule()
        return
    manifest = json.loads((STATE / 'manifest.json').read_text())
    if manifest.get('activation_completed_at'):
        unschedule()
        return
    if not (STATE / 'checkout-approved.json').exists():
        (STATE / 'waiting-checkout.json').write_text(json.dumps({'at': now.isoformat(), 'status': 'blocked', 'reason': 'Oferta47 ausente; preço e anúncios preservados.'}))
        return
    folder = Path(__file__).parent
    deploy = subprocess.run(['node', str(folder / 'aula-lote47-deploy.cjs'), '--apply'], timeout=600)
    if deploy.returncode:
        return
    activate = subprocess.run(['python3', str(folder / 'aula-lote47-meta.py'), '--activate'], timeout=600)
    if activate.returncode == 0:
        manifest = json.loads((STATE / 'manifest.json').read_text())
        if manifest.get('activation_completed_at'):
            unschedule()


if __name__ == '__main__':
    main()
