# Virada do lote da Aula Gestão Operacional — 27/10/2026

## Pedido e horário

Autorizado pelo usuário: novos anúncios para o dia da aula e preço de R$ 47 às
07h00 de Brasília em 27/10/2026, equivalente a 10h00 UTC. A configuração de
encerramento permanece em 27/10/2026 às 17h30 de Brasília; aula às 19h30.

## Checkout verificado

Consulta somente leitura no agent-browser, sessão `sevilha-price-rollover`, em
27/10/2026 por volta de 03h05 UTC (00h05 de Brasília):

- URL: https://pay.kiwify.com.br/cGv131E.
- Produto: Aula Gestão Operacional, vendedor SEVILHA PERFORMANCE LTDA.
- Preço à vista: R$ 27,00; opção selecionada de 6x de R$ 5,07 com acréscimo.
- Adicional: Gravação da Aula Gestão Operacional, opção de 6x de R$ 18,20.
- Nenhum dado pessoal preenchido, nenhuma compra iniciada e nenhum pagamento.
- Sessão encerrada após a conferência.

Não foi encontrada oferta de R$ 47 verificada no projeto. A menção a 4700 na
spec original é um exemplo antigo, não comprova oferta disponível na Kiwify.

## Ponto de alteração na página

`aula-gestao-operacional/index.html` define `window.AULA.checkoutUrl` e
`window.AULA.lote` com nome Lote 1 e `precoCentavos: 2700`. O preço também está
estático nos três elementos `[data-preco]` e no `og:description`.
`form-steps.js` lê a URL para o redirecionamento e o preço para InitiateCheckout.
A alteração precisa sincronizar os três textos, metadado, configuração e oferta.

## Dependência da execução

Não há MCP Kiwify exposto nem credencial administrativa Kiwify da Sevilha
identificada entre os nomes de arquivos de credenciais do cliente. Existe
`KIWIFY_WEBHOOK_TOKEN` no runtime, mas autentica recebimentos e não permite
criar ou editar oferta. Credenciais de outro cliente não foram acessadas.

A virada completa exige uma oferta de R$ 47 verificada no checkout e sua URL,
ou edição autenticada do preço da oferta atual. Alterar somente os textos da
página deixaria a cobrança em R$ 27 e não cumpre o pedido. Nenhum preço de
produção foi alterado nesta investigação.

## Critérios para a execução às 07h00

1. Antes do horário: página e cobrança a R$ 27.
2. Às 07h00: cobrança Kiwify a R$ 47, com gravação adicional preservada.
3. Página: configuração do lote, metadado e três preços a R$ 47; URL da oferta
   conferida; encerramento às 17h30 preservado.
4. Conferir página publicada e checkout em sessão de navegador nomeada, sem
   enviar formulário nem fazer compra; conferir o preço à vista real.
5. Se não houver acesso/oferta verificável, informar bloqueio e manter anúncio
   e página consistentes com a cobrança efetiva; não registrar sucesso.

## Artefatos de execução preparados

- `scripts/check-aula-checkout-price.py`: consulta somente leitura com sessão
  própria `sevilha-aula-price-check`. Retorna JSON sem dados de comprador;
  exit 0 exige produto exato, BRL, oferta ativa/live, preço de checkout,
  preço bruto do carrinho e preço localizado iguais ao esperado, além de bump
  de R$ 97 preservado. Falha de navegação/parse/preço retorna exit 1. Fecha
  a sessão no final. Não preenche campos, não clica pagamento, não compra.
- `scripts/prepare-aula-price-rollover.py`: prepara somente HTML separado depois
  das 07h e antes das 17h30. Recebe URL de oferta já conferida e preço4700.
  Recusa fonte parcial, preço divergente e sobrescrita da fonte. Não publica.
- `scripts/test-prepare-aula-price-rollover.py`: quatro testes offline passaram
  (antes do corte, checkout obrigatório, virada integral/idempotente e recusa
  depois de encerramento/fonte parcial).

Antes do deploy agendado, executar sequencialmente (URL real conferida):

```bash
python3 scripts/check-aula-checkout-price.py --checkout URL_OFERTA_REAL --expected-centavos 4700
python3 scripts/prepare-aula-price-rollover.py --checkout-47 URL_OFERTA_REAL --verified-checkout-price-centavos 4700 --output /tmp/aula-lote47.html
```

Só prosseguir ao segundo comando e à publicação se o primeiro retornar exit 0.
O parâmetro `--verified-checkout-price-centavos` documenta uma conferência externa;
isoladamente não consulta Kiwify. O guard do agendamento deve fazer a consulta
remota imediatamente antes, sem aceitar relatório antigo como prova atual.

Evidência do verificador no checkout atual: esperado4700 retorna `verified:false`,
exit1, preço2700 nos três campos e bump9700. GET simples via urllib retorna403;
a leitura no navegador funciona e usa o objeto `window.__NUXT__.state`.

## Execução preparada e agendamento condicionado

Três artes geradas e revisadas em `criativos/aula-gestao-operacional/lote-47-2026-10-27/`, com copies, manifesto e recibos Meta. Seis anúncios criados e lidos de volta PAUSED: HOT120253719759750526/120253719760380526/120253719760850526; COLD120253719759810526/120253719760510526/120253719760890526. Campanha existente120253647076340526, conjuntos HOT120253647083560526/COLD120253647099740526. Nenhum orçamento, público, exclusão ou campanha alterados. Limite de campanha R$2.000 e vitalício R$1.000 por conjunto preservados. Ads antigos do dia não citam preço na copy nem arte, portanto permanecem compatíveis após a virada. Macros UTM conferidas nos criativos. PAUSED não é aprovação de análise nem entrega.

Ferramenta nativa automation_update não exposta. Serviço cron Linux confirmado ativo. Agenda pontual no cron do usuário, identificador `SEVILHA_AULA_LOTE47_20261027`, inicia às10:00UTC (07BRT), repete por minuto até20:30UTC (17h30BRT), com trava flock e limite de ano/data nos scripts. Agendas alheias preservadas e lidas de volta. Remoção apenas da linha identificada após conclusão/expiração.

Runtime imutável e estado privado: `/home/codex/.local/state/sevilha/aula-lote47-20261027/`. Sem `checkout-approved.json`, nenhuma publicação ou ativação ocorre. Arquivo só pode ser preenchido após URL real informada e checkout efetivamente conferido (chaves checkout_url e price_centavos4700). Não foi criado arquivo de aprovação fictício.

Fluxo: `aula-lote47-run.py` → checker atual do checkout → `aula-lote47-deploy.cjs` (snapshot de produção, alteração exclusiva HTML, preservação dos outros arquivos e checagem de alias antes do POST) → `aula-lote47-meta.py --activate` (página4700 e checkout correto, checker Kiwify novamente, snapshot de budgets/públicos intacto) → readback dos seis anúncios ACTIVE e effective_status. Resultado incerto bloqueia repetição automática. Dependência da Kiwify ainda bloqueada: oferta atual27, nenhuma URL47 ou acesso administrativo recebido até esta entrega. Portanto esta é uma agenda CONDICIONADA; não uma mudança de preço programada dentro da Kiwify.

Revisão independente corrigiu identidade da gravação no gate (oferta6m8nUav, nome exato/duplicado produto+oferta, BRL9700), concorrência com flock e janela longa de drift antes do POST. Doze testes offline passaram (4gerador+3checker+5guard), sintaxe Python/Node e lint direcionado conferidos. Nenhuma compra/formulário de teste ou mensagem externa enviada. Página de produção permanece27 até oferta válida e horário autorizado.

Verificação final de qualidade: `npm run check:toolkit` exit0, sem erros,770avisos na raiz e2 no pacote aninhado. Lint direcionado do novo deploy:0erros/0avisos. Sem build canônico na raiz estática.

## Oferta recebida e agenda liberada — 27/10, 00h30 Brasília

O usuário forneceu https://pay.kiwify.com.br/ldRFvBr. Verificação no navegador confirmou produto principal f1e55370-b1d3-11f1-8d3b-5d78e00f2487, BRL, oferta ativa, preço4700 em checkout/carrinho/localização e gravação específica6m8nUav por9700. Nenhuma compra realizada. `checkout-approved.json` privado preenchido e lido de volta; agenda liberada para27/10 às07hBRT (10hUTC), sem publicação antecipada.

PATH do cron corrigido para incluir /home/codex/.local/node/node24/bin, onde estão Node e agent-browser. Verificador do runtime imutável passou também sob ambiente mínimo equivalente ao cron. Hashes das cinco fontes revisadas conferidos com os arquivos agendados. Runner executado antes do corte e não publicou nem ativou. Serviço cron ativo e linha identificada presente, demais agendas preservadas.

HTML real de produção consultado ainda27 e compatível com o gerador. Simulação local do corte07h usando esse HTML mostrou47 nos três preços, novo checkout e encerramento17h30 preservado. Preview conferido no agent-browser, sessão sevilha-lote47-preview, desktop1280 e celular390; screenshots lidos, sem overflow ou erros de página. Não foi enviado formulário. Servidor de preview e sessão encerrados. Produção permanece27 até a execução futura; conclusão da publicação e entrega dos anúncios só pode ser afirmada após07h com recibos.
