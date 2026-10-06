# Aula: ocupação informada do Lote 1

Pedido: exibir 96% preenchido e retirar a quantidade de ingressos restantes.

Implementação no commit `1dac54f237113c8df518f54559fef2e38c9d9d91`, preservado na branch `codex/se-captacao-google-20261005`. Os dois cartões exibem “Lote 1 · 96% preenchido”, barras e ARIA em 96%. O percentual informado não altera os registros de venda; sem configuração manual, o cálculo original continua disponível. Nenhuma campanha alterada nesta tarefa.

Validação: teste offline de urgência e ocupação, sintaxe JS e diff passaram. ESLint dos arquivos alterados: zero erros e duas advertências preexistentes no HTML. Agent-browser local: desktop 1440px/mobile 390px, capturas inspecionadas, modal abre/fecha, sem overflow ou erros JS; axe sem violações. Sem inscrição enviada. Evidências locais em `/private/tmp/sevilha-lote96-qa`.

Preview `dpl_AwQ8WvTSifQm8EgZ8wwZx5qdc6Rw`: READY, mas protegido por SSO; página não validada no preview. Produção reconstruída do mesmo código: `dpl_BWrLhM3Qocx6frHVjzzgC7BWhs2T`, READY, alias confirmado em https://sevilha-perfomance.vercel.app/aula-gestao-operacional/.

Agent-browser em produção: PASS desktop/mobile; dois rótulos e barras/ARIA 96%, sem ingressos restantes, overflow, chamadas de stats ou erros JS. Capturas inspecionadas. Browser e servidor local encerrados ao final.

Comparação do pacote anterior: 108 arquivos, 106 idênticos; apenas HTML e JS desta página alterados, sem adicionar/remover arquivos. O primeiro pedido de produção foi rejeitado pelo auto-review por abrangência do pacote; a comparação provou o escopo e a nova solicitação foi aceita. Readback público HTTP 200, bytes idênticos ao código validado: HTML `cede0a8408dcf4ef0ff45bbf1af3167788f6a1cd`, JS `6ee9c4de6122ba8c036bf6356991d77883ba7f44`, CSS preservado `ce09bb0cce83a72f1c5d564e6aa268699089270b`.
