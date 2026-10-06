# Retornos públicos do painel — correção de privacidade

Alternativa mais segura após rejeição automática do upload anterior. Implementada e revisada na livebase, publicada em produção no deployment dpl_EBqu1eMmpKQKjYmQhNBWSG8Ye2yX (fonte cb8079e). Releitura pública de /api/leads-unificados e /api/rd-stats retornou agregados HTTP200, sem campos de contato; GET /api/leads retornou405 esperado. Evidência: sessao-estrategica-producao-readback-2026-10-05.json.

## Rastreio real

- GET /api/leads não lista contatos: endpoint aceita apenas POST e retorna 405 para GET.
- GET /api/leads-unificados usa rewrite para /api/sheet-leads?modo=unificados. Planilhas/Supabase leem contatos internamente para dedupe por oferta, mas unificar retorna agregados.
- GET /api/sheet-leads legado retorna agregados de planilhas.
- GET /api/rd-stats retorna contagens/valores por etapa e campanha, sem deals/contatos brutos. Não existe api/rd.js nesta base.
- UI assets/js/dash consome somente agregados; nenhum contrato de contato/hash público é necessário.

## Correção concreta

lib/metricas-publicas.js aplica whitelist de campos públicos no nível superior e nos objetos aninhados. Campos brutos de contato, identificadores pessoais/cliques/eventos, recibos individuais, records/rows e atributos novos inesperados não são publicados. IDs de campanha continuam strings exatas. Rótulos contaminados por e-mail, telefone, token de URL ou JWT são substituídos por marcador; detecção inclui valores URL encoded. Mapas de qualificação admitem somente contagens numéricas e somam chaves que colidem após anonimização, preservando totais.

Falhas Supabase/Sheets/RD retornam somente Fonte indisponível e, quando reconhecido, HTTP status. Corpos de provider, SQL, URLs tentadas e detalhes de contato não aparecem nos erros públicos. API de inscrição retorna enums fixos para status de falha Sheets, sem motivo bruto. HTTP200 RD com error/envelope inválido gera falha, nunca zero saudável.

PII necessário à gravação CRM e dedupe continua exclusivamente no servidor. Não foi introduzido login/framework/dependência nem hash público de contato. Métricas MQL10+, dedupe, null para indisponibilidade e assinatura dos consumidores foram preservados.

## Evidência offline

scripts/test-metricas-publicas.js usa handlers reais com fontes mockadas. Testa GET inscrição405, contato/campos inesperados omitidos, MQL preservado, IDs grandes exatos, rótulos encoded e colisões2+3=5, campos legados, erros sem URLs/PII e RD providererror200→502. Testes fontes, formatos, recibos, dedupe e agregação RD pertinentes passaram. Os testes offline não fizeram fetch real, não criaram lead e não enviaram mensagens. A correção foi depois publicada e conferida pelo coordenador, conforme o registro de produção acima.
