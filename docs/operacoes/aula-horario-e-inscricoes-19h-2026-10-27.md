# Aula de 27/10 — início e inscrições até 19h

O usuário corrigiu o início para 19h de Brasília e estendeu as inscrições até esse horário. A virada de R$27 para R$47 continua às 7h; gravação opcional de R$97, públicos, exclusões e verba foram preservados. Edições anteriores não foram alteradas.

## Produção

O deploy `dpl_2xnJttzJhaShYjrZTC1nVy8FF6hq` corrigiu o horário na página, confirmação e suporte. O deploy `dpl_GmBUwmpiQwT7FBF3RaSRP9joq8mD` estendeu o encerramento. Ambos READY, com alias confirmado. Conferência dos 378 arquivos de origem comprovou alteração exclusiva dos três arquivos solicitados. O overlay sobre o snapshot remoto preservou outras diferenças locais, inclusive o grupo da confirmação.

A configuração publicada informa `hora: '19:00'` e `encerramento: '2026-10-27T19:00:00-03:00'`. Metadados, textos e cache do módulo de formulário foram atualizados. Antes das 7h, permanecem R$27 e checkout `cGv131E`. A oferta `ldRFvBr` foi conferida a R$47 com gravação de R$97.

## Campanhas

A campanha `120253647076340526` mantém limite de R$2.000. Os conjuntos HOT `120253647083560526` e COLD `120253647099740526` agora encerram às 19h, mantendo orçamento vitalício de R$1.000 cada. O snapshot antes/depois confirmou alteração exclusiva do prazo, com públicos e exclusões preservados. Conjuntos históricos já encerrados não foram reativados.

Quatro novos criativos corrigiram a imagem e a cópia de oito anúncios existentes, preservando IDs, destino e UTMs. As seis versões de R$47 continuam pausadas até as 7h. As duas versões sem preço, de último dia, foram configuradas ACTIVE: `120253647129140526` e `120253647138130526`. Após a alteração, ambas retornaram `effective_status=IN_PROCESS`; isso não comprova entrega nem aprovação da revisão.

Os recibos estão em `criativos/aula-gestao-operacional/horario-19h-inscricoes-19h-2026-10-27/verificacao-meta.json`. Artes anteriores ficam como histórico; a pasta definitiva é a que inclui inscrições até 19h.

## Agenda e validação

O cron próprio `SEVILHA_AULA_LOTE47_20261027` passou para 10–22 UTC, com trava flock e limite de data/ano; agendas alheias foram preservadas. Runner, ativador, deploy e gerador agora aceitam execução somente até 19h de Brasília. Fontes e hashes privados foram conferidos. O manifesto do job usa os seis criativos corrigidos; as duas versões sem preço já ativas não dependem dele.

Uma simulação com HTML real de produção confirmou que a virada para R$47 preservará início e encerramento às 19h, inclusive com execução às 18h30. Runtime privado: `/home/codex/.local/state/sevilha/aula-lote47-20261027/`.

Treze testes passaram: cinco do gerador, cinco do guard e três do checkout. Sintaxe Node/Python e lint direcionado passaram; `npm run check:toolkit` terminou com exit0 e avisos anteriores. Agent-browser local e produção, desktop e celular390: screenshots lidos, sem overflow ou erros de página; confirmação e mensagem de suporte às19h conferidas, sem enviar formulário ou pagamento. Os dois checkouts não exibem 19h30 no corpo nem na capa genérica. Sessões e servidores de preview encerrados.

Não foram enviados e-mails ou mensagens, nem alterada reunião Zoom. Evidência privada em `/tmp/sevilha-horario19-20261027/`.

Readback final: os dois anúncios sem preço retornaram status ACTIVE e effective_status ACTIVE. Os seis de R$47 continuam PAUSED, com os criativos definitivos e ativação às7h. Campanha, públicos e verba conferidos novamente sem alteração adicional.
