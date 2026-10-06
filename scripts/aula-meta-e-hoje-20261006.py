"""Create and verify only new PAUSED Aula drafts. Never activates existing objects."""
import argparse
import copy
import datetime as dt
import importlib.util
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / 'docs/aula-meta-e-hoje-execucao-2026-10-06.json'
PREFLIGHT = Path('/private/tmp/aula-meta-preflight-20261006.json')
IMAGES = Path('/private/tmp/aula-meta-images-20261006.json')
ACCOUNT = 'act_1676714556216146'
URL = 'https://sevilha-perfomance.vercel.app/aula-gestao-operacional/'
UTM = 'utm_source={{placement}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}'
ENDS = {'LOTE_HOJE': '2026-10-06T16:00:00-03:00', 'AULA_HOJE': '2026-10-06T17:30:00-03:00'}
SOURCES = {'HOT': '120253257680250526', 'COLD': '120253257680570526'}
FIELDS = {
    'campaigns': 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,bid_strategy,special_ad_categories,is_adset_budget_sharing_enabled',
    'adsets': 'id,name,status,effective_status,campaign_id,targeting,promoted_object,attribution_spec,optimization_goal,billing_event,destination_type,start_time,end_time',
    'adcreatives': 'id,name,url_tags,object_story_spec',
    'ads': 'id,name,status,effective_status,campaign_id,adset_id,creative{id}',
}


def stamp():
    return dt.datetime.now(ZoneInfo('America/Sao_Paulo')).isoformat()


def copies():
    text = (ROOT / 'criativos/aula-gestao-operacional/urgencia-2026-10-06/COPIES.md').read_text()
    return {f'{prefix}-{number}': {'message': body + (' O lote atual encerra às 16h, horário de Brasília.' if prefix == 'lote' else ''), 'name': title}
            for prefix, number, body, title in re.findall(r'### (lote|aula)-(\d\d)[^\n]*\nTexto principal: ([^\n]+)\nTítulo: ([^\n]+)', text)}


def self_test():
    assert 35100 * 2 + 7800 == 78000  # Meta lifetime allocation today + Google daily allocation
    assert len(copies()) == 12
    for key, item in copies().items():
        assert '19h30' in item['message']
        assert ('16h' in item['message']) == key.startswith('lote')
        assert 'R$' not in item['message']
    assert dt.datetime.fromisoformat(ENDS['LOTE_HOJE']) < dt.datetime.fromisoformat(ENDS['AULA_HOJE'])
    assert dt.datetime.fromisoformat(ENDS['AULA_HOJE']).hour == 17
    assert dt.datetime.strptime('2026-10-06T16:00:00-0300', '%Y-%m-%dT%H:%M:%S%z') == dt.datetime.fromisoformat(ENDS['LOTE_HOJE'])
    assert UTM.count('{{') == 4 and '?' not in URL
    print('self-test: passed')


def main(bruno_audience):
    spec = importlib.util.spec_from_file_location('meta_runtime', '/private/tmp/sevilha-meta-execute-20261005.py')
    runtime = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runtime)
    def api(path, params=None, method='GET'):
        encoded = urllib.parse.urlencode({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list, bool)) else v for k, v in (params or {}).items()}).encode()
        url = runtime.BASE + path
        data = encoded
        if method == 'GET':
            url += '?' + encoded.decode()
            data = None
        request = urllib.request.Request(url, data=data, method=method, headers={'Authorization': 'Bearer ' + runtime.TOKEN})
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            body = json.load(error).get('error', {})
            raise RuntimeError(json.dumps({key: body.get(key) for key in ('code', 'error_subcode', 'type', 'message', 'error_user_title', 'error_user_msg', 'fbtrace_id')})) from None
        except (urllib.error.URLError, TimeoutError) as error:
            raise RuntimeError(type(error).__name__ + '; uncertain outcome, reconcile before retry') from None
    before = json.loads(PREFLIGHT.read_text())
    manifest = json.loads(IMAGES.read_text())
    images = {x['file']: x for x in manifest['images']}
    assert len(images) == 12 and all(x['status'] == 'verified' and x['hash'] == x['readback']['hash'] for x in images.values())
    assert before['account']['id'] == ACCOUNT and before['account']['currency'] == 'BRL'
    source = {s['id']: s for c in before['campaigns'] for s in c.get('adsets', [])}
    audiences = {a['id']: a for a in before['custom_audiences']}
    eligible = {aid for aid, a in audiences.items() if a.get('operation_status', {}).get('code') == 200 and a.get('delivery_status', {}).get('code') == 200}
    removed = {}
    for temperature, sid in SOURCES.items():
        field = 'custom_audiences' if temperature == 'HOT' else 'excluded_custom_audiences'
        original = source[sid]['targeting'][field]
        assert all(a['id'] in audiences for a in original), 'Missing audience preflight'
        removed[temperature] = [a['id'] for a in original if a['id'] not in eligible]
        source[sid]['targeting'][field] = [a for a in original if a['id'] in eligible]
        assert len(source[sid]['targeting'][field]) == len(original) - len(removed[temperature])
    assert set(removed['HOT']) == set(removed['COLD'])
    now = dt.datetime.now(ZoneInfo('America/Sao_Paulo'))
    assert now.date().isoformat() == '2026-10-06' and now < dt.datetime.fromisoformat(ENDS['LOTE_HOJE']), 'Draft deadline expired'
    audit = json.loads(AUDIT.read_text()) if AUDIT.exists() else {'scope': 'Only NEW paused Aula campaigns, adsets, creatives and ads; no existing writes or activation', 'started_at': stamp(), 'operations': [], 'errors': []}
    audit['excluded_unusable_audience_ids'] = removed
    def save():
        AUDIT.write_text(json.dumps(audit, indent=2, ensure_ascii=False) + '\n')
    save()
    def create(kind, payload):
        previous = [o for o in audit['operations'] if o['kind'] == kind and o['name'] == payload['name']]
        if previous and previous[-1].get('state') == 'verified' and previous[-1]['payload'] == payload:
            return previous[-1]['id']
        if previous and previous[-1].get('id'):
            matches = [{'id': previous[-1]['id']}]
        elif previous and previous[-1].get('state') == 'rejected':
            assert previous[-1]['payload'] != payload, 'Do not retry unchanged rejected request'
            matches = []
        elif previous:
            matches = runtime.allrows(ACCOUNT + '/' + kind, {'fields': 'id,name', 'limit': 10, 'filtering': json.dumps([{'field': 'name', 'operator': 'EQUAL', 'value': payload['name']}])})
            matches = [o for o in matches if o.get('name') == payload['name']]
        else:
            matches = []
            if kind == 'campaigns':
                assert not any(c['name'] == payload['name'] for c in before['campaigns']), 'Campaign name already existed in preflight'
        assert len(matches) <= 1, 'Duplicate name: ' + payload['name']
        if matches:
            assert previous, 'Unowned existing object; stop: ' + payload['name']
            oid = matches[0]['id']
            op = previous[-1]
            op['reconciled_by_name'] = oid
        else:
            assert not previous or previous[-1].get('state') == 'rejected', 'Prior attempt absent in listing; uncertain outcome requires manual reconciliation'
            op = {'kind': kind, 'name': payload['name'], 'started_at': stamp(), 'payload': payload, 'state': 'creating'}
            audit['operations'].append(op)
            save()
            try:
                result = api(ACCOUNT + '/' + kind, payload, 'POST')
            except RuntimeError as error:
                try:
                    response = json.loads(str(error))
                except ValueError:
                    response = {}
                if response.get('code') == 100:
                    op['state'] = 'rejected'
                    op['api_error'] = response
                    save()
                raise
            oid = result['id']
            op['id'] = oid
            op['state'] = 'created'
            save()
        actual = api(oid, {'fields': FIELDS[kind]})
        op['id'] = oid
        op['readback'] = actual
        save()
        if kind == 'adcreatives':
            assert actual['name'] == payload['name'] or re.fullmatch(re.escape(payload['name']) + r' 2026-10-06-[0-9a-f]{32}', actual['name'])
        else:
            assert actual['name'] == payload['name']
        if kind != 'adcreatives':
            assert actual['status'] == 'PAUSED' and actual['effective_status'] in {'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'PENDING_REVIEW', 'IN_PROCESS'}, 'Object is not paused'
        if kind == 'campaigns':
            assert int(actual.get('daily_budget', 0)) == 0 and int(actual['lifetime_budget']) == 35100 and actual['objective'] == 'OUTCOME_SALES'
            assert actual['bid_strategy'] == 'LOWEST_COST_WITHOUT_CAP' and actual.get('is_adset_budget_sharing_enabled') is False
            assert actual['special_ad_categories'] == []
        elif kind == 'adsets':
            for field in ('campaign_id', 'optimization_goal', 'billing_event', 'destination_type', 'attribution_spec'):
                assert actual[field] == payload[field], field
            assert actual['promoted_object']['pixel_id'] == '657178423444244' and actual['promoted_object']['custom_event_type'] == 'PURCHASE'
            assert dt.datetime.strptime(actual['end_time'], '%Y-%m-%dT%H:%M:%S%z') == dt.datetime.strptime(payload['end_time'], '%Y-%m-%dT%H:%M:%S%z')
            for field in ('custom_audiences', 'excluded_custom_audiences'):
                assert {x['id'] for x in actual['targeting'].get(field, [])} == {x['id'] for x in payload['targeting'].get(field, [])}, field
            assert actual['targeting'].get('targeting_automation') == payload['targeting'].get('targeting_automation')
            if payload['targeting'].get('targeting_relaxation_types'):
                assert actual['targeting']['targeting_relaxation_types']['custom_audience'] == 0
        elif kind == 'adcreatives':
            assert actual['url_tags'] == UTM
            assert actual['object_story_spec']['page_id'] == '131476997004991'
            assert actual['object_story_spec'].get('instagram_user_id') == '17841401496577850'
            for field in ('image_hash', 'link', 'message', 'name', 'call_to_action'):
                assert actual['object_story_spec']['link_data'][field] == payload['object_story_spec']['link_data'][field], field
        else:
            assert actual['adset_id'] == payload['adset_id'] and actual['creative']['id'] == payload['creative']['creative_id']
        op['state'] = 'verified'
        op['verified_at'] = stamp()
        save()
        print(json.dumps({'kind': kind, 'id': oid, 'verified': True}), flush=True)
        return oid
    try:
        old_hot = next((o for o in audit['operations'] if o['kind'] == 'campaigns' and o.get('id') == '120253422648440526'), None)
        if old_hot and old_hot['payload'].get('daily_budget') and not audit.get('hot_lifetime_conversion_rejected'):
            conversion = {'kind': 'budget_conversion', 'name': 'HOT daily to lifetime', 'id': old_hot['id'], 'started_at': stamp(), 'payload': {'daily_budget': 0, 'lifetime_budget': 35100}, 'state': 'changing'}
            audit['operations'].append(conversion)
            save()
            assert api(old_hot['id'], {'fields': 'id,status'})['status'] == 'PAUSED'
            try:
                conversion['response'] = api(old_hot['id'], conversion['payload'], 'POST')
            except RuntimeError as error:
                conversion['error'] = str(error)
                save()
                try:
                    conversion_error = json.loads(str(error))
                except ValueError:
                    raise
                if conversion_error.get('code') not in {100, 1487164}:
                    raise
                conversion['state'] = 'rejected'
                old_hot['state'] = 'superseded_paused_empty'
                audit['hot_lifetime_conversion_rejected'] = True
                save()
            else:
                conversion['readback'] = api(old_hot['id'], {'fields': FIELDS['campaigns']})
                assert int(conversion['readback'].get('daily_budget', 0)) == 0 and int(conversion['readback']['lifetime_budget']) == 35100 and conversion['readback']['status'] == 'PAUSED'
                conversion['state'] = 'verified'
                old_hot['payload'].pop('daily_budget')
                old_hot['payload']['lifetime_budget'] = 35100
                old_hot['readback'] = conversion['readback']
                save()
        audit['budget_semantics'] = 'Meta: BRL351 lifetime per new CBO today (BRL702 total); Google: BRL78/day. Existing spend is outside these new allocations. Daily budget differs from lifetime cap; no claim of total-day account hard cap.'
        save()
        if bruno_audience:
            audience = api(bruno_audience, {'fields': 'id,name,account_id,delivery_status,operation_status,rule'})
            assert audience['account_id'] == ACCOUNT[4:] and audience['delivery_status']['code'] == 200 and audience['operation_status']['code'] == 200
            audit['bruno_audience'] = audience
            save()
        creatives = {}
        for key, item in copies().items():
            category = 'LOTE_HOJE' if key.startswith('lote') else 'AULA_HOJE'
            creatives[key] = create('adcreatives', {'name': f'[AULA][{category}] {key[-2:]} | 20261006 | ESTATICO', 'url_tags': UTM, 'object_story_spec': {'page_id': '131476997004991', 'instagram_user_id': '17841401496577850', 'link_data': dict(item, image_hash=images[key + '.png']['hash'], link=URL, description='Aula ao vivo · 6/10 · 19h30 (Brasília)', call_to_action={'type': 'SIGN_UP', 'value': {'link': URL}})}})
        for temperature, sid in SOURCES.items():
            campaign = create('campaigns', {'name': f'[AULA] [VENDAS] [E HOJE] [{temperature}] 2026-10-06' + (' TOTAL HOJE' if temperature == 'HOT' and audit.get('hot_lifetime_conversion_rejected') else ''), 'objective': 'OUTCOME_SALES', 'lifetime_budget': 35100, 'bid_strategy': 'LOWEST_COST_WITHOUT_CAP', 'special_ad_categories': [], 'is_adset_budget_sharing_enabled': False, 'status': 'PAUSED'})
            for category, end in ENDS.items():
                targeting = copy.deepcopy(source[sid]['targeting'])
                if temperature == 'HOT':
                    targeting['targeting_relaxation_types'] = {'custom_audience': 0}
                if bruno_audience:
                    field = 'custom_audiences' if temperature == 'HOT' else 'excluded_custom_audiences'
                    if bruno_audience not in {x['id'] for x in targeting.get(field, [])}:
                        targeting.setdefault(field, []).append({'id': bruno_audience})
                adset = create('adsets', {'name': f'[{temperature}] [{category}] Brasil · Compras · 20261006', 'campaign_id': campaign, 'targeting': targeting, 'promoted_object': source[sid]['promoted_object'], 'attribution_spec': source[sid]['attribution_spec'], 'optimization_goal': 'OFFSITE_CONVERSIONS', 'billing_event': 'IMPRESSIONS', 'destination_type': 'WEBSITE', 'start_time': int(dt.datetime.now().timestamp()) + 120, 'end_time': end, 'status': 'PAUSED'})
                prefix = 'lote' if category == 'LOTE_HOJE' else 'aula'
                for number in range(1, 7):
                    create('ads', {'name': f'[AULA][{category}] {number:02d} |{temperature}|20261006', 'adset_id': adset, 'creative': {'creative_id': creatives[f'{prefix}-{number:02d}']}, 'status': 'PAUSED'})
        audit['completed_at'] = stamp()
        audit['counts'] = {kind: sum(o['kind'] == kind and o['state'] == 'verified' for o in audit['operations']) for kind in FIELDS}
        assert audit['counts'] == {'campaigns': 2, 'adsets': 4, 'adcreatives': 12, 'ads': 24}
        save()
        print(json.dumps(audit['counts']))
    except Exception as error:
        audit['errors'].append({'at': stamp(), 'error': str(error), 'action': 'Stopped; no blind retries, no activation'})
        save()
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--create-paused', action='store_true')
    parser.add_argument('--bruno-audience')
    args = parser.parse_args()
    if args.self_test:
        self_test()
    elif args.create_paused:
        main(args.bruno_audience)
    else:
        parser.error('Select --self-test or --create-paused')
