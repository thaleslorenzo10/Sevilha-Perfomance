#!/usr/bin/env python3
"""Corrige somente criativos dos oito anúncios atuais da Aula27/10 para19h."""
import argparse
import base64
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('lote', Path(__file__).with_name('aula-lote47-meta.py'))
META = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(META)
ASSETS = ROOT / 'criativos/aula-gestao-operacional/horario-19h-inscricoes-19h-2026-10-27'
AUDIT = META.STATE / 'horario19-end19.json'
OLD = {'HOT': '120253647129140526', 'COLD': '120253647138130526'}


def save(audit):
    temporary = AUDIT.with_suffix('.tmp')
    temporary.write_text(json.dumps(audit, ensure_ascii=False, indent=2))
    temporary.chmod(0o600)
    temporary.replace(AUDIT)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', required=True)
    parser.parse_args()
    assert datetime.now(timezone.utc) < META.END
    manifest = json.loads((META.STATE / 'manifest.json').read_text())
    assert META.snapshot() == manifest['before'], 'Estrutura de campanhas mudou.'
    audit = json.loads(AUDIT.read_text()) if AUDIT.exists() else {'operations': {}, 'ads': [], 'started_at': datetime.now(timezone.utc).isoformat()}
    assets = json.loads((ASSETS / 'manifesto.json').read_text())
    assert len(assets['ads']) == 4
    for item in assets['ads']:
        key = item['key']
        assert '19h30' not in item['message'] and '19h' in item['message']
        operation = audit['operations'].get(key)
        if operation and not operation.get('id'):
            raise RuntimeError('Criação incerta, reconciliar: ' + key)
        if not operation:
            image = META.api(META.ACCOUNT + '/adimages', {'bytes': base64.b64encode((ASSETS / item['file']).read_bytes()).decode()}, 'POST')
            image_hash = next(iter(image['images'].values()))['hash']
            payload = {'name': '[AULA_OUT26] [19H] ' + key, 'url_tags': META.UTM,
                       'object_story_spec': {'page_id': '131476997004991', 'instagram_user_id': '17841401496577850',
                           'link_data': {'link': META.LANDING, 'message': item['message'], 'name': item['title'],
                               'description': '27/10 · 19h Brasília · Inscrições até19h', 'image_hash': image_hash,
                               'call_to_action': {'type': 'SIGN_UP', 'value': {'link': META.LANDING}}}}}
            operation = {'state': 'creating', 'payload': payload, 'image_hash': image_hash}
            audit['operations'][key] = operation
            save(audit)
            operation.update(META.api(META.ACCOUNT + '/adcreatives', payload, 'POST'))
            save(audit)
        creative = META.api(operation['id'], {'fields': 'id,object_story_spec,url_tags'})
        assert creative['object_story_spec'] == operation['payload']['object_story_spec'] and creative['url_tags'] == META.UTM
        for temp, sid in META.SETS.items():
            ad_id = OLD[temp] if key == 'ultimo-dia' else manifest['operations']['ad:' + temp + ':' + key]['id']
            current = META.api(ad_id, {'fields': 'id,name,status,effective_status,adset_id,creative{id}'})
            assert current['adset_id'] == sid and current['status'] == 'PAUSED'
            if current['creative']['id'] != operation['id']:
                audit.setdefault('before', {})[ad_id] = current
                save(audit)
                assert META.api(ad_id, {'creative': {'creative_id': operation['id']}}, 'POST')['success']
            result = META.api(ad_id, {'fields': 'id,name,status,effective_status,adset_id,creative{id,object_story_spec,url_tags}'})
            assert result['status'] == 'PAUSED' and result['creative']['id'] == operation['id']
            assert '19h30' not in json.dumps(result['creative'])
            audit['ads'] = [a for a in audit['ads'] if a['id'] != ad_id] + [result]
            save(audit)
            print(json.dumps({'ad': ad_id, 'creative19h': operation['id'], 'status': result['status']}), flush=True)
    assert len(audit['ads']) == 8
    assert META.snapshot() == manifest['before'], 'Budgets ou públicos alterados.'
    # Retém IDs dos anúncios; a agenda futura usa só estas referências atualizadas.
    for ad in manifest['ads']:
        latest = next(a for a in audit['ads'] if a['id'] == ad['id'])
        ad['creative'] = {'id': latest['creative']['id']}
        ad['status'] = latest['status']
        ad['effective_status'] = latest['effective_status']
        for op in manifest['operations'].values():
            if op.get('id') == ad['id'] and op.get('payload', {}).get('creative'):
                op['payload']['creative']['creative_id'] = latest['creative']['id']
    for key in ['hoje', 'operacao', 'metodo']:
        manifest['images'][key] = audit['operations'][key]['image_hash']
        manifest['operations']['creative:' + key] = audit['operations'][key]
    manifest['event_start'] = '2026-10-27T19:00:00-03:00'
    manifest['hour_updated_at'] = datetime.now(timezone.utc).isoformat()
    META.save('manifest.json', manifest)
    audit['completed_at'] = datetime.now(timezone.utc).isoformat()
    save(audit)
    print(json.dumps({'updated_ads': 8, 'new_creatives': 4, 'budget_changes': 0}))


if __name__ == '__main__':
    main()
