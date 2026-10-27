#!/usr/bin/env python3
"""Prepara HTML local do lote de R$47 após o corte; não altera Kiwify nem publica."""
import argparse
from datetime import datetime, timezone
from pathlib import Path
import re
from urllib.parse import urlparse

CUTOFF = datetime.fromisoformat('2026-10-27T07:00:00-03:00')
CLOSE = datetime.fromisoformat('2026-10-27T19:00:00-03:00')
SOURCE = Path(__file__).resolve().parents[1] / 'aula-gestao-operacional/index.html'


def prepare_html(html, checkout_url, verified_price_centavos, now):
    """Entrada de preço exige conferência externa real do checkout pelo operador."""
    if now.tzinfo is None:
        raise ValueError('Horário precisa incluir fuso.')
    if now < CUTOFF:
        raise ValueError('Antes de 27/10 às 07h00 de Brasília: manter lote de R$27.')
    if now >= CLOSE:
        raise ValueError('Inscrições encerradas; não preparar lote novo.')
    parsed = urlparse(checkout_url)
    if (parsed.scheme != 'https' or parsed.netloc != 'pay.kiwify.com.br'
            or not re.fullmatch(r'/[A-Za-z0-9]+', parsed.path)
            or parsed.query or parsed.fragment):
        raise ValueError('Informe URL de oferta Kiwify sem parâmetros.')
    if verified_price_centavos != 4700:
        raise ValueError('Checkout de R$47 ainda não verificado; manter preço atual.')
    if "precoCentavos: 4700" in html:
        if f"checkoutUrl: '{checkout_url}'" not in html or 'R$ 27' in html:
            raise ValueError('HTML parcial ou oferta divergente; revisar antes de publicar.')
        return html
    if (html.count('R$ 27') != 5 or html.count('precoCentavos: 2700') != 1
            or html.count("nome: 'Lote 1'") != 1
            or "encerramento: '2026-10-27T19:00:00-03:00'" not in html):
        raise ValueError('Fonte mudou; conferir configuração e todos os preços.')
    html, replacements = re.subn(
        r"checkoutUrl: 'https://pay\.kiwify\.com\.br/[A-Za-z0-9]+'[^\n]*",
        f"checkoutUrl: '{checkout_url}', // oferta de R$ 47 conferida no checkout",
        html,
    )
    if replacements != 1:
        raise ValueError('Checkout não encontrado de forma inequívoca.')
    return (html.replace('R$ 27', 'R$ 47').replace('precoCentavos: 2700', 'precoCentavos: 4700')
            .replace("nome: 'Lote 1'", "nome: 'Lote do dia'"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--checkout-47', required=True)
    parser.add_argument('--verified-checkout-price-centavos', type=int, required=True,
                        help='Somente após conferir preço real no navegador; deve ser 4700.')
    parser.add_argument('--output', type=Path, required=True, help='HTML de saída para deploy revisado.')
    args = parser.parse_args()
    if args.output.resolve() == SOURCE:
        parser.error('Saída deve ser arquivo separado; fonte não será sobrescrita.')
    try:
        final_html = prepare_html(SOURCE.read_text(), args.checkout_47,
                                  args.verified_checkout_price_centavos, datetime.now(timezone.utc))
    except ValueError as error:
        parser.error(str(error))
    args.output.write_text(final_html)
    print('HTML preparado. Nenhuma publicação ou alteração na Kiwify foi executada.')


if __name__ == '__main__':
    main()
