#!/usr/bin/env python3
"""Verificações offline: horário, oferta obrigatória, consistência e idempotência."""
from datetime import datetime
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('rollover', Path(__file__).with_name('prepare-aula-price-rollover.py'))
rollover = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rollover)


class PriceRolloverTest(unittest.TestCase):
    def setUp(self):
        self.source = rollover.SOURCE.read_text()
        self.url = 'https://pay.kiwify.com.br/Offline47'
        self.cutoff = datetime.fromisoformat('2026-10-27T10:00:00+00:00')

    def test_before_cutoff_keeps_source(self):
        with self.assertRaisesRegex(ValueError, 'Antes de'):
            rollover.prepare_html(self.source, self.url, 4700,
                                  datetime.fromisoformat('2026-10-27T09:59:59+00:00'))
        self.assertEqual(rollover.SOURCE.read_text(), self.source)

    def test_requires_verified_checkout(self):
        for url, price in [('', 4700), (self.url, 2700), ('https://example.com/offer', 4700)]:
            with self.assertRaises(ValueError):
                rollover.prepare_html(self.source, url, price, self.cutoff)

    def test_cutoff_updates_all_prices_and_preserves_close(self):
        result = rollover.prepare_html(self.source, self.url, 4700, self.cutoff)
        self.assertNotIn('R$ 27', result)
        self.assertIn('precoCentavos: 4700', result)
        self.assertIn(f"checkoutUrl: '{self.url}'", result)
        self.assertEqual(result.count('data-preco>R$ 47'), 3)
        self.assertIn("encerramento: '2026-10-27T17:30:00-03:00'", result)
        self.assertEqual(result, rollover.prepare_html(result, self.url, 4700, self.cutoff))

    def test_rejects_closed_enrollment_and_partial_source(self):
        with self.assertRaisesRegex(ValueError, 'encerradas'):
            rollover.prepare_html(self.source, self.url, 4700, rollover.CLOSE)
        with self.assertRaisesRegex(ValueError, 'Fonte mudou'):
            rollover.prepare_html(self.source.replace('R$ 27', 'R$ 47', 1), self.url, 4700, self.cutoff)


if __name__ == '__main__':
    unittest.main()
