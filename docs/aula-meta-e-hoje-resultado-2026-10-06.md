# Aula É hoje — publicação em06/10/2026

Conta Meta1676714556216146, reais/Brasília. Escopo: Aula Gestão Operacional, sem alterações em sessão estratégica, Café ou Clube.

## Aplicado e relido

- Orçamento base live600/dia; plano780nominais hoje (+30%).
- Nova COLD120253422702950526: orçamento total351para hoje, campanhaACTIVE,2conjuntosACTIVE,12anúnciosACTIVE/ACTIVE.
- Nova HOT120253422686060526: orçamento total351para hoje,2conjuntos e12anúnciosPAUSED. Pronta; falta públicoBruno exigido anteriormente.
- Existem12criativos compartilhados (6aula/6lote),24novos anúncios no total, imagens12enviadas comSHA256/hashreadback, URLlimpa/identidade/PixelPurchase/UTMurl_tags conferidos independentemente.
- HOT53públicos elegíveis, expansão desativada; COLD exclui os mesmos. Foram retiradas13regras antigas indisponíveis/inativas de ambos.
- Encerramento automático: lote16h, demais captação17h30, duas horas antes da aula19h30 conforme página. Inclui os3conjuntos antigos da oferta, cujos términos eram19h.

## Distribuição provisória

| Campanha | Valor |
|---|---:|
| Nova fria | R$351 totais hoje |
| Antiga fria virada120253257675140526 | R$178,75/dia |
| Antiga quente virada120253257675000526 | R$178,75/dia |
| Antiga fria fase01120253144969620526 | R$71,50/dia |
| Soma nominal para hoje | R$780 |

Meta não aceita programação diária inferior a24h. Novas têm orçamento total/lifetime válido somentehoje. Não confundir soma nominal com gasto acumulado ou teto rígido: gasto jáocorrido e sobre-entrega diária da Meta precisam de acompanhamento.

Quando a nova quente puder ser ativada: novas351+351=702 (90%de780), antigas32,50+32,50+13=78 (10%). Essa distribuição90/10 AINDA NÃO foi aplicada, para respeitar Bruno como requisito de campanhas quentes e não ultrapassar780nominais na configuração ativa.

## Pendências

API rejeitou a criação do públicoBruno por regra/evento inválido. IdentidadeInstagram do Bruno17841446823336862 foi confirmada; não tratar outro público combinado como dele sem prova. Quatro tentativas sem objeto criado, documentadas em aula-bruno-publico-2026-10-06.json.

Auto-review recusou `agent-browser auth list` por tentativa de localizar sessões de autenticação fora do fluxo normal sem autorização específica. Não contornamos a rejeição. Concluir o públicoBruno pelo navegador exige acesso autorizado; alternativamente ativar quente somenteSevilha requer autorização para a exceção à instrução de usarBruno.

## Validação

- Self-test offline dos payloads e cópias passou; Pythoncompila.
- Revisão independente live: campanhas,4conjuntos,24anúncios,12criativos, UTMs, imagens, públicos, Purchase e horários.
- Coordenador releu ativação/budgets por tipo. Um readfinal inicial usou campo de budget emAd e foi corrigido com duas leituras separadas, sem repetir gravações.
- NovoCOLD com12adsACTIVE/ACTIVE; isso comprova publicação/estado, não compras ou entrega a pessoas. Nenhuma inscrição ou pagamento foi simulado.
- Nenhuma mudança defrontend neste pedido; validação local/produção da página foi concluída no pedido anterior. Lint/typecheck/build então passaram, com avisos preexistentes.

Journals: aula-meta-e-hoje-execucao-2026-10-06.json (drafts), aula-meta-ativacao-2026-10-06.json (21gravações e readbacks), aula-bruno-publico-2026-10-06.json (rejeições).
