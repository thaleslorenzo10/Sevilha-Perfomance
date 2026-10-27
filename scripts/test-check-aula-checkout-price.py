#!/usr/bin/env python3
"""Preço não basta: checkout precisa preservar a gravação identificada."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('checker', Path(__file__).with_name('check-aula-checkout-price.py'))
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class CheckoutPriceTest(unittest.TestCase):
    def setUp(self):
        self.result = {
            'product_id': checker.PRODUCT_ID, 'currency': 'BRL', 'live': True,
            'status': 'active', 'price_centavos': 4700, 'cart_price_centavos': 4700,
            'locale_price_centavos': 4700,
            'bumps': [{'offer_id': checker.BUMP_OFFER, 'name': checker.BUMP_NAME,
                       'price_centavos': 9700, 'currency': 'BRL'}],
        }

    def test_exact_recording_and_checkout_required(self):
        self.assertTrue(checker.valid_result(self.result, 4700))
        doubled = copy.deepcopy(self.result)
        doubled['bumps'][0]['name'] = f'{checker.BUMP_NAME} - {checker.BUMP_NAME}'
        self.assertTrue(checker.valid_result(doubled, 4700))
        self.assertFalse(checker.valid_result(self.result, 2700))

    def test_other_bump_at_same_price_rejected(self):
        for field, value in [('name', 'Outro produto'), ('offer_id', 'Other97'),
                             ('currency', 'USD'), ('price_centavos', 9600)]:
            changed = copy.deepcopy(self.result)
            changed['bumps'][0][field] = value
            self.assertFalse(checker.valid_result(changed, 4700), field)

    def test_missing_or_malformed_bumps_rejected(self):
        for value in [None, [], [None], ['Gravação']]:
            changed = copy.deepcopy(self.result)
            changed['bumps'] = value
            self.assertFalse(checker.valid_result(changed, 4700))


if __name__ == '__main__':
    unittest.main()
