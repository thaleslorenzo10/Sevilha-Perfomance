"""Testes offline do gate: nenhum anúncio ativa com preço/tempo/estado inválidos."""
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('meta47', Path(__file__).with_name('aula-lote47-meta.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class GuardTest(unittest.TestCase):
    def test_date_limits(self):
        self.assertEqual(module.START.hour, 10)
        self.assertEqual(module.END.hour, 20)
        self.assertEqual(module.END.minute, 30)
        self.assertEqual(module.START.astimezone(timezone.utc).day, 27)
        for stamp in ['2026-10-27T09:59:59+00:00', '2026-10-27T20:30:00+00:00', '2027-10-27T10:00:00+00:00']:
            class Clock:
                @staticmethod
                def now(tz):
                    return datetime.fromisoformat(stamp)
            with patch.object(module, 'datetime', Clock), patch.object(module, 'api') as api:
                module.activate()
                api.assert_not_called()

    def test_no_checkout_approval_means_no_calls(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'manifest.json').write_text(json.dumps({'ads': []}))
            class Clock:
                @staticmethod
                def now(tz):
                    return module.START
            with patch.object(module, 'STATE', root), patch.object(module, 'datetime', Clock), patch.object(module, 'api') as api:
                module.activate()
                api.assert_not_called()
                self.assertEqual(json.loads((root / 'last-gate.json').read_text())['status'], 'blocked')

    def test_wrong_landing_stops_before_checkout_and_api(self):
        approved = {'checkout_url': 'https://pay.kiwify.com.br/Offline47', 'price_centavos': 4700}
        with patch.object(module, 'browser_eval', return_value={'preco': 2700, 'checkout': approved['checkout_url']}), patch.object(module.subprocess, 'run') as run:
            with self.assertRaisesRegex(AssertionError, 'Página'):
                module.price_gate(approved)
            run.assert_not_called()

    def test_failed_checkout_stops(self):
        approved = {'checkout_url': 'https://pay.kiwify.com.br/Offline47', 'price_centavos': 4700}
        with patch.object(module, 'browser_eval', return_value={'preco': 4700, 'checkout': approved['checkout_url']}), patch.object(module.subprocess, 'run') as run:
            run.return_value.returncode = 1
            with self.assertRaisesRegex(AssertionError, 'Checkout47'):
                module.price_gate(approved)

    def test_uncertain_creation_never_blind_retries(self):
        with patch.object(module, 'api') as api:
            with self.assertRaisesRegex(RuntimeError, 'incerto'):
                module.create_once({'operations': {'ad:x': {'state': 'creating'}}}, 'ad:x', 'ads', {})
            api.assert_not_called()


if __name__ == '__main__':
    unittest.main()
