"""Prepara somente gravações pagas. Sem rede, CAPI, CRM ou gravação no banco.

Uso: python3 scripts/import-kiwify-order-bump.py arquivo.csv [--output /pasta/privada/manifest.json]
O manifesto contém dados pessoais; deve ficar fora do repositório, com modo 600.
"""
import argparse
import csv
import hashlib
import json
import os
from collections import Counter
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

AULA = 'Aula Gestão Operacional'
GRAVACAO = 'Gravação da aula - Aula Gestão Operacional'
FUSO = ZoneInfo('America/Sao_Paulo')


def dinheiro(valor):
    n = Decimal(valor) * 100
    if not n.is_finite() or n < 0 or n != n.to_integral_value():
        raise ValueError('Valor monetário inválido')
    return int(n)


def data(valor):
    return datetime.strptime(valor, '%d/%m/%Y %H:%M:%S').replace(tzinfo=FUSO)


def edicao(quando):
    dia = quando.date().isoformat()
    if '2026-09-18' <= dia <= '2026-10-06':
        return 'aula-2026-10-06'
    if '2026-10-14' <= dia <= '2026-10-27':
        return 'aula-2026-10-27'
    return None


def preparar(linhas):
    ids = [r['ID da venda'].strip() for r in linhas]
    if len(set(ids)) != len(ids) or any(not i for i in ids):
        raise ValueError('Referências vazias ou duplicadas no CSV')
    principais = [r for r in linhas if r['Produto'] == AULA and r['Status'] == 'paid' and r['Oferta'] != 'Teste']
    registros = []
    for r in linhas:
        if r['Produto'] != GRAVACAO or r['Status'] != 'paid':
            continue
        if any(r[c] != 'BRL' for c in ['Moeda do preço do produto', 'Moeda da cobrança']):
            raise ValueError('Moeda não suportada')
        quando = data(r['Data de Criação'])
        evento = edicao(quando)
        if not evento:
            raise ValueError('Gravação fora das edições conhecidas')
        email = r['Email'].strip().lower()
        if '@' not in email:
            raise ValueError('Comprador sem e-mail válido')
        pais = [p for p in principais if p['Email'].strip().lower() == email and p['Data de Criação'] == r['Data de Criação']]
        if len(pais) != 1:
            raise ValueError('Gravação sem vínculo inequívoco com uma inscrição paga')
        ref = r['ID da venda'].strip()
        payload = {
            'order_ref': ref, 'order_status': 'paid',
            'Product': {'product_name': GRAVACAO, 'product_offer_name': r['Oferta']},
            'Commissions': {'product_base_price': dinheiro(r['Preço base do produto']),
                            'charge_amount': dinheiro(r['Total com acréscimo']),
                            'my_commission': dinheiro(r['Valor líquido']), 'currency': 'BRL'},
            'importacao': {'fonte': 'kiwify_csv', 'data_pagamento': 'criacao_aproximada',
                          'criado_em_original': quando.isoformat(),
                          'atualizado_em_original': data(r['Data de Atualização']).isoformat(),
                          'edicao': evento, 'parent_order_ref': pais[0]['ID da venda'].strip()},
        }
        for k in ['source', 'medium', 'campaign', 'content', 'term']:
            payload.setdefault('TrackingParameters', {})['utm_' + k] = r.get('Tracking utm_' + k, '')
        registros.append({'order_id': 'kiwify-csv:' + ref, 'status': 'paid', 'email': email,
                          'valor_centavos': payload['Commissions']['charge_amount'],
                          'pago_em': quando.isoformat(), 'payload': payload,
                          'capi_status': 'nao_enviado_retroativo', 'crm_status': 'nao_enviado_retroativo',
                          **{'utm_' + k: r.get('Tracking utm_' + k) or None for k in ['source', 'medium', 'campaign', 'content', 'term']}})
    return registros


def resumo(registros):
    grupos = {}
    for r in registros:
        e = r['payload']['importacao']['edicao']
        g = grupos.setdefault(e, {'pagas': 0, 'receita_base_centavos': 0, 'cobrado_centavos': 0, 'liquido_centavos': 0})
        g['pagas'] += 1
        for destino, origem in [('receita_base_centavos', 'product_base_price'), ('cobrado_centavos', 'charge_amount'), ('liquido_centavos', 'my_commission')]:
            g[destino] += r['payload']['Commissions'][origem]
    return grupos


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    fonte = args.csv.read_bytes()
    with args.csv.open(encoding='utf-8-sig', newline='') as f:
        linhas = list(csv.DictReader(f))
    registros = preparar(linhas)
    manifest = {'fonte_sha256': hashlib.sha256(fonte).hexdigest(), 'registros': registros}
    if args.output:
        raiz = Path(__file__).resolve().parents[1]
        destino = args.output.resolve()
        if destino.is_relative_to(raiz):
            raise ValueError('Manifesto privado deve ficar fora do repositório')
        destino.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(destino, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(json.dumps({'modo': 'dry-run', 'linhas_csv': len(linhas), 'selecionadas': len(registros),
                      'status_csv': dict(Counter(r['Status'] for r in linhas)), 'edicoes': resumo(registros)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
