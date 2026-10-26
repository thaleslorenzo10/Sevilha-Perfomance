# Aula e gravação por lançamento — plano de implementação

**Objetivo:** separar inscrições, gravações e receita combinada no dashboard e importar as vendas pagas da gravação do CSV autorizado, sem duplicar pedidos ou reenviar integrações históricas.

**Arquitetura:** reutilizar `sevilha_compras_aula` com classificação pelo produto do payload, conservar os IDs existentes e deduplicar importação/webhook pela referência original Kiwify (`payload.order_ref`). Dados pessoais e CSV ficam fora do Git. Receitas de produto (sem juros), valor cobrado e líquido têm significados separados.

**Premissas:** edições 06/10/2026 (17/09–06/10) e 27/10/2026 (14/10–27/10), Brasília. CSV sem data de aprovação: usar criação como aproximação explicitamente marcada; atualização pode ocorrer dias depois. Gravação custa R$97 e não é nova inscrição. Testes, desconhecidos e Clube não entram na Aula. Histórico importado não dispara CAPI/CRM. Publicação aguarda autorização aplicável, com resultado local pronto e validado.

## Tarefas e propriedade

- [x] Integração e agregação (worker backend): `lib/kiwify.js`, novo `lib/kiwify-produtos.js`, `lib/eventos-dashboard-compras.js`, testes correspondentes. Classificação, exclusão de testes, reconciliação por referência, proteção dos recibos existentes e leitura agregada sem PII.
- [x] Dashboard (worker frontend): `assets/js/dash/eventos.js`, `assets/css/dashboard-eventos.css`, `dashboard.html`, `lib/eventos-dashboard.js` e testes de apresentação. Depende do contrato abaixo; adicionar edição anterior sem trocar índices existentes; exibir Aula, gravação, combinado, taxa de adesão e custo/receita por inscrição.
- [x] Retroativo e auditoria (coordenador): parser/importador CSV com dry-run, índice único parcial de referência, importação somente de gravações pagas ausentes; conferir referências existentes, datas, status, edições e execução repetida. Evidência privada sem PII no repositório.
- [x] Integração/revisão: regressões locais, lint/gates, revisão independente e navegador desktop/mobile com dados agregados reais, falha de fonte e zero vendas. Registrar limites da data aproximada e do deploy.

## Contrato de agregação

`compras.pagas/reembolsadas/receita/valor_reembolsado` continuam representando exclusivamente Aula (receita cobrada legada). Novos `aula` e `gravacao` possuem `pagas`, `reembolsadas`, `receita` (preço base), `valor_reembolsado`, `cobrado`, `liquido` (null se ausente), `compradores`. `combinado` contém `receita`, `cobrado`, `liquido`, `ticket_medio` (receita base / inscrições pagas) e `adesao` (compradores da gravação também compradores da aula / compradores da aula), com null para denominador zero. `datas_aproximadas` informa quantidade de registros CSV com data de criação usada. Sem dados pessoais no retorno público.

## Revisão e aceite

Reembolso prevalece sobre importação antiga; repetição não duplica por order_ref; teste Example product e oferta Teste não contam nem disparam integrações; desconhecido não avança deal Aula; CAPI de gravação usa nome real do produto. Importação não fabrica IDs UUID do provedor nem data exata de pagamento. Filtrar período antes de dedupe e manter contabilização por edição. Ajustar contrato apenas com decisão documentada aqui.

## Estado final desta etapa

Implementação e validações concluídas pelo coordenador; subagentes sem ferramentas fizeram revisão de contratos em texto. Índice/RPC aplicados e testados com rollback. Retroativo conferido:35, repetição0, sem persistência definitiva para não contaminar dashboard antigo. Publicação depende de autorização conforme AGENTS.md. Registro detalhado: `docs/operacoes/aula-order-bump-2026-10-26.md`.

## Conclusão autorizada

Publicação autorizada pelo usuário, deploy READY e alias verificados. Sete arquivos publicados sem alterações alheias.35 gravações importadas, readback e dashboard de produção confirmados; CAPI/CRM históricos não reenviados. Detalhes no registro operacional.

Ajuste final: campanha anterior já gastou R$37,03 em17/09; início da edição no painel passou a17/09 para incluir todo o investimento antes da primeira compra.
