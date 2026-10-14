"""Aula27/10: explicit Meta scope; dry-run default; --apply prepares, --activate resumes.

Only the coordinator runs write modes after verifying the live sales page.
No secret values, authenticated URLs or tokens are persisted in the audit.
"""
import argparse
import datetime as dt
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / 'docs/aula-retomada-meta-plan-20261027.json'
AUDIT = ROOT / 'docs/aula-retomada-meta-audit-20261027.json'
ACCOUNT = 'act_1676714556216146'
URL = 'https://sevilha-perfomance.vercel.app/aula-gestao-operacional/'
TAGS = 'utm_source={{placement}}&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}'
END = '2026-10-27T17:30:00-03:00'
CAMPAIGNS = ('120253257675000526', '120253257675140526')
RATE_LIMIT_DELAY = 35
MAX_API_ATTEMPTS = 3
_LAST_POST = {}


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def api(path, params=None, method='GET'):
    token = next(line.split('=', 1)[1].strip().strip('\"\'')
                 for line in (Path.home() / '.claude/credenciais/ads.env').read_text().splitlines()
                 if line.startswith('META_ACCESS_TOKEN='))
    body = urllib.parse.urlencode({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v
                                  for k, v in (params or {}).items()}).encode()
    url = 'https://graph.facebook.com/v22.0/' + path
    if method == 'GET':
        url += '?' + body.decode()
    req = urllib.request.Request(url, data=None if method == 'GET' else body, method=method,
                                 headers={'Authorization': 'Bearer ' + token})
    for attempt in range(MAX_API_ATTEMPTS):
        # Meta allows only one edit of some ad objects per 30 seconds.
        if method == 'POST' and path in _LAST_POST:
            delay = RATE_LIMIT_DELAY - (time.monotonic() - _LAST_POST[path])
            if delay > 0:
                print(f'Pacing Meta write {path}: waiting {delay:.1f}s', flush=True)
                time.sleep(delay)
        try:
            if method == 'POST':
                _LAST_POST[path] = time.monotonic()
            with urllib.request.urlopen(req, timeout=60) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            result = json.load(error)
        except (urllib.error.URLError, TimeoutError):
            # Never retry a request whose remote outcome is unknown.
            raise RuntimeError('Network outcome uncertain; inspect audit and reconcile before retry') from None
        if 'error' not in result:
            return result
        err = result['error']
        retry_delay = RATE_LIMIT_DELAY if err.get('code') == 613 else (60 if method == 'GET' and err.get('code') == 17 else None)
        if retry_delay is not None and attempt + 1 < MAX_API_ATTEMPTS:
            print(f'Meta rejected {method} {path} with rate limit {err.get("code")}; waiting {retry_delay}s '
                  f'before attempt {attempt + 2}/{MAX_API_ATTEMPTS}', flush=True)
            time.sleep(retry_delay)
            continue
        raise RuntimeError(json.dumps({k: err.get(k) for k in ('code', 'error_subcode', 'message', 'error_user_msg')}))



def rows(path, fields):
    result, after = [], None
    while True:
        params = {'fields': fields, 'limit': 100}
        if after:
            params['after'] = after
        response = api(path, params)
        result.extend(response['data'])
        if not response.get('paging', {}).get('next'):
            return result
        after = response['paging']['cursors']['after']


def same(actual, expected):
    """Meta normalizes UTC offsets and ordering of audience lists."""
    for key, value in expected.items():
        got = actual.get(key)
        if key == 'end_time':
            if dt.datetime.fromisoformat(got) != dt.datetime.fromisoformat(value):
                return False
        elif key == 'targeting':
            if canonical(got) != canonical(value):
                return False
        elif key == 'creative':
            if got.get('id') != value['creative_id']:
                return False
        elif str(got) != str(value):
            return False
    return True


def canonical(value):
    if isinstance(value, dict):
        return {k: canonical(v) for k, v in value.items() if k != 'name'}
    if isinstance(value, list):
        return sorted((canonical(x) for x in value), key=lambda x: json.dumps(x, sort_keys=True))
    return value


def save(audit):
    temp = AUDIT.with_suffix('.tmp')
    temp.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    temp.replace(AUDIT)


def live_page():
    with urllib.request.urlopen(URL, timeout=45) as response:
        assert response.status == 200
        html = response.read().decode()
    assert '27 de outubro' in html.lower() and '19h30' in html
    assert '2026-10-27' in html and '2026-10-06' not in html


def run(mode):
    plan = json.loads(PLAN.read_text())
    assert plan['account']['id'] == ACCOUNT and plan['account']['currency'] == 'BRL'
    assert plan['media_review']['approved_video_ids'], 'No verified media'
    for ad in plan['ads']:
        if ad.get('creative'):
            assert ad['creative']['object_story_spec']['video_data']['video_id'] in plan['media_review']['approved_video_ids']
    assert sum(int(c['after']['daily_budget']) for c in plan['campaigns']) == 20000
    assert tuple(c['before']['id'] for c in plan['campaigns']) == CAMPAIGNS
    assert dt.datetime.now(dt.timezone.utc) < dt.datetime.fromisoformat(END)
    account = api(ACCOUNT, {'fields': 'id,currency,account_status,timezone_name'})
    assert account['currency'] == 'BRL' and account['account_status'] == 1
    audit = json.loads(AUDIT.read_text()) if AUDIT.exists() else {'started_at': stamp(), 'operations': []}
    digest = hashlib.sha256(PLAN.read_bytes()).hexdigest()
    if audit.get('plan_sha256'):
        assert audit['plan_sha256'] == digest, 'Plan changed after execution began'
    audit['plan_sha256'] = digest
    if mode == 'dry-run':
        print(json.dumps({'mode': mode, 'campaigns': CAMPAIGNS, 'daily_total_BRL': 200,
                          'ads_to_update': [a['before']['id'] for a in plan['ads'] if a.get('creative')],
                          'end_time': END, 'media_review': plan['media_review']}, ensure_ascii=False, indent=2))
        return
    live_page()
    save(audit)

    def update(oid, expected_before, payload, fields):
        actual = api(oid, {'fields': fields})
        if same(actual, payload):
            return actual
        assert same(actual, expected_before), 'External drift detected: ' + oid
        op = {'id': oid, 'before': actual, 'payload': payload, 'state': 'writing', 'time': stamp()}
        audit['operations'].append(op)
        save(audit)
        api(oid, payload, 'POST')
        actual = api(oid, {'fields': fields})
        op['readback'] = actual
        assert same(actual, payload), 'Readback mismatch: ' + oid
        op['state'] = 'verified'
        save(audit)
        return actual

    def create_creative(item):
        payload = item['creative']
        prior = next((o for o in audit['operations'] if o.get('creative_name') == payload['name']), None)
        if prior:
            assert prior.get('id'), 'Uncertain creative create; reconcile by name before rerunning'
            oid = prior['id']
        else:
            op = {'creative_name': payload['name'], 'payload': payload, 'state': 'creating', 'time': stamp()}
            audit['operations'].append(op)
            save(audit)
            result = api(ACCOUNT + '/adcreatives', payload, 'POST')
            oid = result['id']
            op['id'] = oid
            save(audit)
            prior = op
        actual = api(oid, {'fields': 'id,name,url_tags,object_story_spec'})
        assert actual['url_tags'] == TAGS
        spec = actual['object_story_spec']
        expected = payload['object_story_spec']
        assert spec['page_id'] == expected['page_id']
        for key in ('video_id', 'title', 'message', 'link_description', 'image_hash', 'call_to_action'):
            assert spec['video_data'][key] == expected['video_data'][key], key
        prior['readback'] = actual
        prior['state'] = 'verified'
        save(audit)
        return oid

    def verify_prepared():
        print('Verification 1/4: current audience availability', flush=True)
        audiences = {a['id']: a for a in rows(ACCOUNT + '/customaudiences', 'id,operation_status,delivery_status')}
        for item in plan['adsets']:
            for field in ('custom_audiences', 'excluded_custom_audiences'):
                for audience in item['after']['targeting'].get(field, []):
                    a = audiences[audience['id']]
                    assert a['operation_status']['code'] == 200 and a['delivery_status']['code'] == 200
        planned_ads = {a['before']['id']: a for a in plan['ads']}
        planned_sets = {s['before']['id']: s for s in plan['adsets']}
        snapshots = []
        for index, campaign in enumerate(plan['campaigns'], 2):
            cid = campaign['before']['id']
            print(f'Verification {index}/4: campaign {cid}, its adsets and ads in one read', flush=True)
            actual = api(cid, {'fields': 'id,daily_budget,lifetime_budget,status,effective_status,'
                              'adsets.limit(100){id,end_time,targeting,promoted_object,status},'
                              'ads.limit(100){id,status,effective_status,creative{id,url_tags,object_story_spec}}'})
            snapshots.append(actual)
            expected = {k: v for k, v in campaign['after'].items() if k != 'status'}
            assert same(actual, expected) and int(actual.get('lifetime_budget', 0)) == 0
            assert actual['status'] in ({'PAUSED', 'ACTIVE'} if mode == 'activate' else {'PAUSED'})
            # Never silently validate only the first page of nested edges.
            assert not actual['adsets'].get('paging', {}).get('next'), 'Unexpected adset pagination'
            assert not actual['ads'].get('paging', {}).get('next'), 'Unexpected ad pagination'
            expected_sets = {a['before']['adset_id'] for a in plan['ads'] if a['campaign_id'] == cid}
            assert {s['id'] for s in actual['adsets']['data']} == expected_sets, 'Unexpected adset added'
            for adset in actual['adsets']['data']:
                assert same(adset, planned_sets[adset['id']]['after'])
                assert adset['promoted_object']['pixel_id'] == '657178423444244'
                assert adset['promoted_object']['custom_event_type'] == 'PURCHASE'
            current = actual['ads']['data']
            assert {a['id'] for a in current} == {a['before']['id'] for a in plan['ads'] if a['campaign_id'] == cid}
            for ad in current:
                item = planned_ads[ad['id']]
                if not item.get('creative'):
                    assert ad['status'] == 'PAUSED'
                    continue
                prior = next(o for o in audit['operations'] if o.get('creative_name') == item['creative']['name'])
                assert prior['state'] == 'verified'
                assert ad['status'] == 'ACTIVE' and ad['creative']['id'] == prior['id']
                assert ad['effective_status'] not in ('DISAPPROVED', 'WITH_ISSUES', 'DELETED', 'ARCHIVED')
                assert ad['creative']['url_tags'] == TAGS
                vd = ad['creative']['object_story_spec']['video_data']
                for key in ('video_id', 'title', 'message', 'link_description', 'image_hash', 'call_to_action'):
                    assert vd[key] == item['creative']['object_story_spec']['video_data'][key], key
        print('Verification 4/4: no other Aula campaign active', flush=True)
        for c in rows(ACCOUNT + '/campaigns', 'id,name,status'):
            assert c['id'] in CAMPAIGNS or '[AULA]' not in c['name'] or c['status'] != 'ACTIVE', 'Another Aula campaign active'
        audit['prepared_readback'] = snapshots
        audit['last_verification_at'] = stamp()
        save(audit)

    if mode == 'apply':
        for c in plan['campaigns']:
            assert api(c['before']['id'], {'fields': 'status'})['status'] == 'PAUSED'
        # Preserve already prepared ads on resume. Only legacy creatives need pausing.
        for a in plan['ads']:
            if a.get('creative'):
                prior = next((o for o in audit['operations']
                              if o.get('creative_name') == a['creative']['name']
                              and o.get('state') == 'verified' and o.get('id')), None)
                if prior:
                    actual = api(a['before']['id'], {'fields': 'id,status,creative{id}'})
                    if actual['status'] == 'ACTIVE' and actual['creative']['id'] == prior['id']:
                        continue
            update(a['before']['id'], {'status': a['before']['status']}, {'status': 'PAUSED'}, 'id,status,effective_status')
        for c in plan['campaigns']:
            update(c['before']['id'], {'daily_budget': c['before']['daily_budget'], 'status': 'PAUSED'}, c['after'], 'id,daily_budget,status,lifetime_budget')
        for s in plan['adsets']:
            update(s['before']['id'], {k: s['before'][k] for k in s['after']}, s['after'], 'id,status,end_time,targeting,promoted_object')
        for a in plan['ads']:
            if not a.get('creative'):
                continue
            cid = create_creative(a)
            update(a['before']['id'], {'creative': {'creative_id': a['before']['creative']['id']}},
                   {'creative': {'creative_id': cid}}, 'id,status,creative{id},effective_status')
            update(a['before']['id'], {'status': 'PAUSED'}, {'status': 'ACTIVE'}, 'id,status,effective_status')
        verify_prepared()
        audit['prepared_at'] = stamp()
        save(audit)
        print('Prepared and read back. Campaigns remain PAUSED. Run --activate only after coordinator review.')
    elif mode == 'verify-prepared':
        print('Read-only remote verification; no Meta mutations will be performed', flush=True)
        verify_prepared()
        audit['prepared_at'] = stamp()
        save(audit)
        print('Preparation verified and recorded. Campaigns remain PAUSED.', flush=True)
    elif mode == 'activate':
        assert audit.get('prepared_at'), 'Run --apply first'
        verify_prepared()
        try:
            for c in plan['campaigns']:
                update(c['before']['id'], {'status': 'PAUSED'}, {'status': 'ACTIVE'}, 'id,status,effective_status,daily_budget')
            audit['activated_at'] = stamp()
            audit['final_campaigns'] = [api(cid, {'fields': 'id,name,status,effective_status,daily_budget'}) for cid in CAMPAIGNS]
            assert all(c['status'] == 'ACTIVE' for c in audit['final_campaigns'])
            assert sum(int(c['daily_budget']) for c in audit['final_campaigns']) == 20000
            save(audit)
            print(json.dumps(audit['final_campaigns'], ensure_ascii=False, indent=2))
        except Exception:
            # Stop spend if activation is partially applied or verification fails.
            for cid in CAMPAIGNS:
                api(cid, {'status': 'PAUSED'}, 'POST')
            audit['activation_failed_paused_at'] = stamp()
            save(audit)
            raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--apply', action='store_true', help='Prepare and verify while campaigns remain paused')
    group.add_argument('--verify-prepared', action='store_true', help='GET-only verification of already applied changes; record prepared_at')
    group.add_argument('--activate', action='store_true', help='Verify prepared objects and activate campaigns last')
    args = parser.parse_args()
    run('activate' if args.activate else 'apply' if args.apply else 'verify-prepared' if args.verify_prepared else 'dry-run')
