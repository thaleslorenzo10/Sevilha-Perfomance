# Lembretes — Aula de Gestão Operacional — 06/10/2026

Conteúdo e registro de execução no RD Station em 06/10/2026. Os estados abaixo foram informados pelo coordenador após conferência no RD; agendamento não confirma entrega.

- Aula: hoje, 06/10/2026, às 19h30 (Brasília).
- Remetente: Sevilha Performance <contato@sevilhaperformance.com.br>.
- Acesso: Google Meet — https://meet.google.com/wbh-hehw-sao.
- O JSON contém HTML, texto simples e horários com fuso -03:00; `scheduled_at: null` identifica o lembrete inicial.
- Se algum horário já passou, não enviar retroativamente nem concentrar lembretes atrasados; revisar somente os horários futuros.
- Conferir o Meet antes do envio: as quatro UTMs identificam cada mensagem; validar que o link com parâmetros abre a mesma sala.
- O descadastro utiliza o marcador nativo RD `*||UNSUBSCRIBE_LINK||*`; verificar sua substituição no teste do e-mail.

## Execução no RD Station

- Autorização OAuth concluída pelo aplicativo separado `44350`; preservada a integração existente do n8n.
- Audiência sincronizada: 79 compradores únicos, sendo 77 contatos existentes e 2 criados, com a tag `comprador-aula-gestao-operacional-2026-10-06`.
- Segmento principal `20188750`: contatos com essa tag. Excluídos os segmentos Hard Bounces `20106410` e Soft Bounces `20106413`; público elegível na conferência: 77 contatos.
- A sincronização representa o recorte conferido. Compras posteriores não recebem automaticamente essa tag; precisam de atualização da audiência ou integração específica.
- Previews dos e-mails conferidos: HTML, link Google Meet, quatro UTMs e descadastro nativo RD.

| Lembrete | Horário de Brasília em 06/10 | ID do e-mail | Estado confirmado |
|---|---|---|---|
| Inicial | 16h56 | `23411426` | Campanha `20333935`: 14 enviados e 14 entregues, confirmado no RD |
| Complemento do inicial | 17h07 | `23411640` | Campanha `20334136`: 63 enviados e 59 entregues (93,65%), confirmado ao vivo no RD |
| Falta 1 hora | 18h30 | `23411508` | Agendado; entrega ainda não confirmada |
| Faltam 15 minutos | 19h15 | `23411552` | Agendado; entrega ainda não confirmada |
| Estamos ao vivo | 19h30 | `23411573` | Agendado; entrega ainda não confirmada |
| Aula em andamento | 19h45 | `23411590` | Agendado; entrega ainda não confirmada |

O complemento usa exclusivamente o segmento `20188853`: possui a tag da turma **e não recebeu o e-mail inicial**. Na consulta atual, o lembrete inicial e seu complemento somam **77 enviados e 73 entregues**. Os 4 restantes não são tratados como falha definitiva; não reenviar por incerteza de estado e consultar o RD antes de qualquer nova ação.

## Critérios de audiência

- Incluir exclusivamente compradores com pagamento confirmado do produto exato Aula de Gestão Operacional para esta turma.
- Excluir compras reembolsadas ou canceladas, descadastrados e endereços com bounce; deduplicar por e-mail.
- Não aplicar exclusão genérica de compradores: eles são precisamente o público destes lembretes.
- Conferir a quantidade final e a origem dos pagamentos antes de agendar ou enviar.
- Validar remetente autenticado, link, horário e descadastro em teste interno antes dos envios.

## Lembrete inicial — envio às 16h56 e complemento às 17h07 — Brasília

**Assunto:** É hoje: sua Aula de Gestão Operacional às 19h30

```text
Olá!

Hoje, às 19h30 (horário de Brasília), temos nossa Aula de Gestão Operacional.

Reserve esse horário e deixe suas anotações e dúvidas à mão.

Até mais tarde!

Acessar a aula no Google Meet:
https://meet.google.com/wbh-hehw-sao?utm_source=rd_station&utm_medium=email&utm_campaign=aula-gestao-operacional-2026-10-06&utm_content=agora

Equipe Sevilha Performance

Descadastrar-se destes e-mails: *||UNSUBSCRIBE_LINK||*
```

## Falta 1 hora — 18h30 — Brasília

**Assunto:** Falta 1 hora para sua Aula de Gestão Operacional

```text
Olá!

Falta 1 hora para nossa Aula de Gestão Operacional. Começamos às 19h30 (horário de Brasília).

Prepare suas anotações e deixe o link de acesso à mão.

Nos vemos daqui a pouco!

Acessar a aula no Google Meet:
https://meet.google.com/wbh-hehw-sao?utm_source=rd_station&utm_medium=email&utm_campaign=aula-gestao-operacional-2026-10-06&utm_content=falta-1-hora

Equipe Sevilha Performance

Descadastrar-se destes e-mails: *||UNSUBSCRIBE_LINK||*
```

## Faltam 15 minutos — 19h15 — Brasília

**Assunto:** Começamos em 15 minutos: acesse sua aula

```text
Olá!

Nossa Aula de Gestão Operacional começa em 15 minutos, às 19h30 (horário de Brasília).

Pegue uma água e prepare suas anotações. Estamos esperando você!

Acessar a aula no Google Meet:
https://meet.google.com/wbh-hehw-sao?utm_source=rd_station&utm_medium=email&utm_campaign=aula-gestao-operacional-2026-10-06&utm_content=faltam-15-minutos

Equipe Sevilha Performance

Descadastrar-se destes e-mails: *||UNSUBSCRIBE_LINK||*
```

## Estamos ao vivo — 19h30 — Brasília

**Assunto:** Estamos ao vivo: entre na Aula de Gestão Operacional

```text
Olá!

Estamos ao vivo! Nossa Aula de Gestão Operacional está começando.

Entre agora para acompanhar desde o início.

Acessar a aula no Google Meet:
https://meet.google.com/wbh-hehw-sao?utm_source=rd_station&utm_medium=email&utm_campaign=aula-gestao-operacional-2026-10-06&utm_content=ao-vivo

Equipe Sevilha Performance

Descadastrar-se destes e-mails: *||UNSUBSCRIBE_LINK||*
```

## Aula em andamento — 19h45 — Brasília

**Assunto:** Sua Aula de Gestão Operacional já começou

```text
Olá!

Nossa Aula de Gestão Operacional já começou.

Se você ainda não entrou, venha acompanhar com a gente. Ainda dá tempo de participar!

Acessar a aula no Google Meet:
https://meet.google.com/wbh-hehw-sao?utm_source=rd_station&utm_medium=email&utm_campaign=aula-gestao-operacional-2026-10-06&utm_content=aula-em-andamento

Equipe Sevilha Performance

Descadastrar-se destes e-mails: *||UNSUBSCRIBE_LINK||*
```
