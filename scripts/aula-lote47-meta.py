#!/usr/bin/env python3
"""Aula 27/10: prepara anúncios pausados e ativa após página/checkout47 conferidos."""
import argparse
import base64
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request

ACCOUNT = 'act_1676714556216146'
CAMPAIGN = '120253647076340526'
SETS = {'HOT': '120253647083560526', 'COLD': '120253647099740526'}
LANDING = 'https://sevilha-perfomance.vercel.app/aula-gestao-operacional/'
UTM = 'utm_source={{placement}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}'
START = datetime.fromisoformat('2026-10-27T10:00:00+00:00')
END = datetime.fromisoformat('2026-10-27T22:00:00+00:00')
STATE = Path(os.environ.get('SEVILHA_LOTE47_STATE', '/home/codex/.local/state/sevilha/aula-lote47-20261027'))
ROOT = Path(__file__).resolve().parents[1]


def save(name, data):
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = STATE / name
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    tmp.chmod(0o600)
    tmp.replace(path)


def api(path, params=None, method='GET'):
    env = {}
    for line in Path('/home/codex/.claude/credenciais/ads.env').read_text().splitlines():
        if '=' in line and not line.strip().startswith('#'):
            key, value = line.split('=', 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    encoded = urllib.parse.urlencode({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list, bool)) else v for k, v in (params or {}).items()}).encode()
    url = 'https://graph.facebook.com/v24.0/' + path
    if method == 'GET':
        url += '?' + encoded.decode()
        encoded = None
    req = urllib.request.Request(url, data=encoded, method=method, headers={'Authorization': 'Bearer ' + env['META_ACCESS_TOKEN']})
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        body = json.load(error).get('error', {})
        raise RuntimeError(json.dumps({k: body.get(k) for k in ('code', 'error_subcode', 'message', 'error_user_msg')})) from None


def snapshot():
    campaign = api(CAMPAIGN, {'fields': 'id,name,status,effective_status,spend_cap'})
    assert campaign['status'] == 'ACTIVE' and int(campaign['spend_cap']) == 200000
    sets = {}
    for temp, sid in SETS.items():
        row = api(sid, {'fields': 'id,campaign_id,status,targeting,lifetime_budget,start_time,end_time,promoted_object'})
        assert row['campaign_id'] == CAMPAIGN and row['status'] == 'ACTIVE'
        assert int(row['lifetime_budget']) == 100000
        assert datetime.fromisoformat(row['end_time']) == END
        assert row['promoted_object']['pixel_id'] == '657178423444244'
        assert row['targeting']['targeting_automation']['advantage_audience'] == 0
        assert row['targeting']['targeting_relaxation_types']['custom_audience'] == 0
        sets[temp] = row
    return {'campaign': campaign, 'sets': sets}


def create_once(state, key, kind, payload):
    op = state['operations'].get(key)
    if op and op.get('id'):
        return op['id']
    if op:
        raise RuntimeError('Resultado incerto: reconciliar antes de repetir ' + key)
    state['operations'][key] = {'state': 'creating', 'payload': payload}
    save('manifest.json', state)
    result = api(ACCOUNT + '/' + kind, payload, 'POST')
    state['operations'][key].update({'id': result['id'], 'state': 'created'})
    save('manifest.json', state)
    return result['id']


def prepare(manifest):
    before = snapshot()
    path = STATE / 'manifest.json'
    state = json.loads(path.read_text()) if path.exists() else {'operations': {}, 'images': {}, 'ads': [], 'before': before}
    assert before == state['before'], 'Estrutura alterada desde o snapshot; revisar.'
    data = json.loads(manifest.read_text())
    assert len(data['ads']) == 3 and len({a['key'] for a in data['ads']}) == 3
    for item in data['ads']:
        image = (manifest.parent / item['file']).resolve()
        assert image.is_relative_to(manifest.parent.resolve()) and image.is_file()
        key = item['key']
        if key not in state['images']:
            result = api(ACCOUNT + '/adimages', {'bytes': base64.b64encode(image.read_bytes()).decode()}, 'POST')
            state['images'][key] = next(iter(result['images'].values()))['hash']
            save('manifest.json', state)
        image_hash = state['images'][key]
        image_readback = api(ACCOUNT + '/adimages', {'hashes': [image_hash], 'fields': 'hash'})
        assert any(x['hash'] == image_hash for x in image_readback['data'])
        payload = {'name': '[AULA_OUT26] Lote47 ' + key, 'url_tags': UTM,
                   'object_story_spec': {'page_id': '131476997004991', 'instagram_user_id': '17841401496577850',
                       'link_data': {'link': LANDING, 'message': item['message'], 'name': item['title'],
                           'description': '27/10 · 19h Brasília · Inscrições até19h', 'image_hash': image_hash,
                           'call_to_action': {'type': 'SIGN_UP', 'value': {'link': LANDING}}}}}
        creative_id = create_once(state, 'creative:' + key, 'adcreatives', payload)
        actual = api(creative_id, {'fields': 'id,url_tags,object_story_spec'})
        assert actual['url_tags'] == UTM and actual['object_story_spec'] == payload['object_story_spec']
        for temp, sid in SETS.items():
            ad_id = create_once(state, 'ad:' + temp + ':' + key, 'ads', {
                'name': '[AULA_OUT26] [VENDAS] [' + temp + '] [FECHAMENTO] - R$47 | ' + key,
                'adset_id': sid, 'creative': {'creative_id': creative_id}, 'status': 'PAUSED'})
            ad = api(ad_id, {'fields': 'id,name,status,effective_status,adset_id,creative{id}'})
            assert ad['status'] == 'PAUSED' and ad['adset_id'] == sid and ad['creative']['id'] == creative_id
            state['ads'] = [a for a in state['ads'] if a['id'] != ad_id] + [ad]
            save('manifest.json', state)
    assert len(state['ads']) == 6
    assert snapshot() == before
    state['prepared_at'] = datetime.now(timezone.utc).isoformat()
    save('manifest.json', state)
    print(json.dumps({'prepared_ads': len(state['ads']), 'status': 'PAUSED', 'budget_changes': 0}))


def browser_eval(session, url, js):
    args = ['agent-browser', '--session', session]
    subprocess.run(args + ['open', url], capture_output=True, check=True, timeout=60)
    try:
        subprocess.run(args + ['wait', '--load', 'domcontentloaded'], capture_output=True, check=True, timeout=45)
        out = subprocess.run(args + ['eval', js], capture_output=True, text=True, check=True, timeout=45)
        value = json.loads(out.stdout)
        return json.loads(value) if isinstance(value, str) else value
    finally:
        subprocess.run(args + ['close'], capture_output=True, timeout=30)


def price_gate(approved):
    checkout = approved['checkout_url']
    assert approved['price_centavos'] == 4700 and re.fullmatch(r'https://pay\.kiwify\.com\.br/[A-Za-z0-9]+', checkout)
    page = browser_eval('sevilha-lote47-page-guard', LANDING + '?sp_interno=1',
                        'JSON.stringify({preco:window.AULA?.lote?.precoCentavos,checkout:window.AULA?.checkoutUrl})')
    assert page == {'preco': 4700, 'checkout': checkout}, 'Página ainda não apresenta checkout47.'
    result = subprocess.run(['python3', str(Path(__file__).with_name('check-aula-checkout-price.py')),
                             '--checkout', checkout, '--expected-centavos', '4700'],
                            capture_output=True, text=True, timeout=240)
    assert result.returncode == 0 and json.loads(result.stdout)['verified'], 'Checkout47 não confirmado.'


def activate():
    now = datetime.now(timezone.utc)
    if now < START or now >= END:
        return
    path = STATE / 'manifest.json'
    state = json.loads(path.read_text())
    if state.get('activation_completed_at'):
        return
    approved_path = STATE / 'checkout-approved.json'
    if not approved_path.exists():
        save('last-gate.json', {'at': now.isoformat(), 'status': 'blocked', 'reason': 'Oferta47 ainda não conferida.'})
        return
    price_gate(json.loads(approved_path.read_text()))
    current = snapshot()
    assert current == state['before'], 'Estrutura ou público alterados; revisar antes de ativar.'
    assert len(state['ads']) == 6 and state.get('prepared_at')
    for ad in state['ads']:
        actual = api(ad['id'], {'fields': 'id,status,effective_status,adset_id,creative{id}'})
        assert actual['adset_id'] == ad['adset_id'] and actual['creative'] == ad['creative']
        assert actual['status'] in ('PAUSED', 'ACTIVE')
        if actual['status'] == 'PAUSED':
            assert START <= datetime.now(timezone.utc) < END, 'Prazo de ativação encerrado.'
            assert api(ad['id'], {'status': 'ACTIVE'}, 'POST').get('success')
        verified = api(ad['id'], {'fields': 'id,status,effective_status'})
        assert verified['status'] == 'ACTIVE'
        state['operations']['activation:' + ad['id']] = verified
        save('manifest.json', state)
    state['activation_completed_at'] = datetime.now(timezone.utc).isoformat()
    save('manifest.json', state)
    print(json.dumps({'configured_active': 6, 'delivery': 'Consultar effective_status; ACTIVE não garante entrega.'}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--prepare', type=Path)
    group.add_argument('--activate', action='store_true')
    args = parser.parse_args()
    if args.prepare:
        prepare(args.prepare)
    else:
        activate()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        save('last-error.json', {'at': datetime.now(timezone.utc).isoformat(), 'type': type(error).__name__, 'message': str(error)})
        raise SystemExit('Execução interrompida; consultar last-error.json privado.') from None
