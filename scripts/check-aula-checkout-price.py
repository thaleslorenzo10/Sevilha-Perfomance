#!/usr/bin/env python3
"""Confere produto, moeda e preço real no checkout público, sem iniciar compra."""
import argparse
import json
import subprocess
import sys
from urllib.parse import urlparse

PRODUCT_ID = 'f1e55370-b1d3-11f1-8d3b-5d78e00f2487'
BUMP_NAME = 'Gravação da aula - Aula Gestão Operacional'
BUMP_OFFER = '6m8nUav'
EXPRESSION = '''(() => {
  const state = window.__NUXT__.state;
  const data = state.checkoutData;
  return {
    product_id: data.productId,
    price_centavos: data.checkout?.price,
    cart_price_centavos: data.cart?.price_raw,
    locale_price_centavos: state.localePricing?.amount,
    currency: state.localePricing?.currency,
    live: data.cart?.live,
    status: data.cart?.status,
    bumps: (data.bumps || []).map(b => ({
      offer_id: b.link, name: b.name, price_centavos: b.price, currency: b.currency
    }))
  };
})()'''


def valid_result(result, expected):
    """Falha fechada: gravação identificada por oferta e nome, além do preço."""
    if not isinstance(result, dict):
        return False
    bumps = result.get('bumps')
    if not isinstance(bumps, list):
        return False
    # Checkout concatena o nome do produto e o da oferta quando ambos são iguais.
    bump_names = {BUMP_NAME, f'{BUMP_NAME} - {BUMP_NAME}'}
    recording_ok = any(
        isinstance(bump, dict) and bump.get('offer_id') == BUMP_OFFER
        and bump.get('name') in bump_names and bump.get('price_centavos') == 9700
        and bump.get('currency') == 'BRL' for bump in bumps
    )
    return (recording_ok and result.get('product_id') == PRODUCT_ID
            and result.get('currency') == 'BRL' and result.get('live') is True
            and result.get('status') == 'active'
            and all(result.get(field) == expected for field in
                    ['price_centavos', 'cart_price_centavos', 'locale_price_centavos']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout', required=True)
    parser.add_argument('--expected-centavos', required=True, type=int)
    args = parser.parse_args()
    url = urlparse(args.checkout)
    if url.scheme != 'https' or url.netloc != 'pay.kiwify.com.br':
        parser.error('Somente checkout público HTTPS da Kiwify.')
    command = ['agent-browser', '--session', 'sevilha-aula-price-check']

    def browser(*arguments):
        return subprocess.run(command + list(arguments), check=True, capture_output=True,
                              text=True, timeout=55).stdout

    try:
        browser('open', args.checkout)
        browser('wait', '--fn', 'Boolean(window.__NUXT__?.state?.checkoutData?.checkout)')
        result = json.loads(browser('eval', EXPRESSION))
        valid = valid_result(result, args.expected_centavos)
        print(json.dumps({'verified': valid, **result}, ensure_ascii=False))
        return 0 if valid else 1
    except (subprocess.SubprocessError, json.JSONDecodeError) as error:
        print(json.dumps({'verified': False, 'error': type(error).__name__}))
        return 1
    finally:
        try:
            browser('close')
        except subprocess.SubprocessError:
            pass


if __name__ == '__main__':
    sys.exit(main())
