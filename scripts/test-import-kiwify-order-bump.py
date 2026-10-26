"""Testes offline: parser monetário, vinculação e seleção sem efeito externo."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('importador', Path(__file__).with_name('import-kiwify-order-bump.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class ImportacaoTest(unittest.TestCase):
    def linhas(self):
        base = {'ID da venda': 'principal', 'Produto': mod.AULA, 'Status': 'paid', 'Oferta': 'Lote 01',
                'Email': 'a@example.invalid', 'Data de Criação': '26/10/2026 10:00:00',
                'Data de Atualização': '26/10/2026 10:01:00', 'Moeda do preço do produto': 'BRL',
                'Moeda da cobrança': 'BRL', 'Preço base do produto': '27.00',
                'Total com acréscimo': '27.00', 'Valor líquido': '22.35'}
        bump = {**base, 'ID da venda': 'bump', 'Produto': mod.GRAVACAO, 'Preço base do produto': '97.00',
                'Total com acréscimo': '102.11', 'Valor líquido': '89.25'}
        return [base, bump]

    def test_registro(self):
        r = mod.preparar(self.linhas())[0]
        self.assertEqual(r['order_id'], 'kiwify-csv:bump')
        self.assertEqual(r['payload']['importacao']['parent_order_ref'], 'principal')
        self.assertEqual(r['payload']['Commissions']['product_base_price'], 9700)
        self.assertEqual(r['valor_centavos'], 10211)
        self.assertTrue(r['pago_em'].endswith('-03:00'))
        self.assertEqual(r['capi_status'], 'nao_enviado_retroativo')

    def test_exclusoes(self):
        rows = self.linhas()
        rows[1]['Status'] = 'waiting_payment'
        self.assertEqual(mod.preparar(rows), [])

    def test_sem_vinculo(self):
        with self.assertRaises(ValueError):
            mod.preparar(self.linhas()[1:])

    def test_referencia_duplicada(self):
        rows = self.linhas()
        with self.assertRaises(ValueError):
            mod.preparar(rows + rows)

    def test_dinheiro(self):
        self.assertEqual(mod.dinheiro('89.25'), 8925)
        for valor in ['NaN', '-1', '1.999']:
            with self.assertRaises(ValueError):
                mod.dinheiro(valor)


if __name__ == '__main__':
    unittest.main()
