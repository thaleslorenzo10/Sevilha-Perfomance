# Lembretes WhatsApp — Aula Gestão Operacional — 06/10/2026

Escopo final autorizado: instância Evolution `teste`, somente lembretes privados aos compradores pagos do produto exato. A própria Sevilha fará os envios no grupo. Link do Google Meet informado pelo usuário. Horários em `America/Sao_Paulo` (-03:00). Não gravar convite, contatos ou credenciais no repositório.

1. Aplicar `sql/sevilha-whatsapp-lembretes.sql` com acesso administrativo. Conferir PK, RLS, permissões e função `SECURITY INVOKER`; somente `service_role` acessa a fila/RPC.
2. Conferir conexão da instância. Reconciliar compradores atuais por produto, pagamento confirmado e ausência de reembolso; excluir oferta Teste/R$5. Normalizar telefone BR e deduplicar com equivalência do nono dígito. Snapshot de audiência: 82 pedidos reais pagos, 81 e-mails únicos e 76 telefones únicos válidos; 5 pedidos sem telefone válido. Fonte: `sevilha_compras_aula.telefone`, proveniente de `payload.Customer.mobile` no webhook Kiwify. Não restringir a turma ao recorte de e-mails de um disparo anterior. Novos compradores não são inseridos automaticamente nesta fila; exigem atualização explícita da audiência sem reinicializar registros existentes.
3. Inserir fila com chave determinística `sevilha:aula:2026-10-06:<lembrete>:<canal>:<destino>`. Em conflito de PK, preservar registro existente; não reinicializar estado. Dados ficam exclusivamente no banco e arquivos temporários privados.
4. Consumidor separado chama a RPC uma vez por minuto, com limite 10. Claim reserva atomicamente via `FOR UPDATE SKIP LOCKED`, confere compra ainda paga e optout atual e devolve só reservados. Processar individualmente, com intervalo de 2 segundos. Imediatamente antes de cada envio privado, conferir histórico de recusa e reler `lorenzo_whatsapp_optout`; recusa vira `blocked`. Revalidar expiração antes do POST. Os cinco registros de grupo estão bloqueados e não são enviados pelo workflow.
5. Salvar `message_id` e estado retornado: aceite confirmado vira `accepted`; erro de transporte ou resposta ambígua vira `uncertain`. `reserved` e `uncertain` não são reenviados automaticamente. Reconciliar status remoto antes de intervenção; `PENDING` é aceite pendente, não entrega.

| Canal | Horário | Expira em |
|---|---|---|
| Privado — inicial | 17h35 | 18h15 |
| Privado — faltam 15 minutos | 19h15 | 19h29 |

Não enviar horários vencidos retroativamente. Nenhum workflow deve consumir filas de outros clientes. Chaves fora do prefixo exato desta turma não são reservadas pela RPC.

## Estado verificado pelo coordenador

- Schema SQL aplicado e revalidado.
- Workflow `0sKF4SsXfwMKnoJV` ativo, 13 nodes, fuso `America/Sao_Paulo`, exclusivamente envio privado.
- Fila no momento da ativação: 152 registros privados `queued` (76 telefones × dois horários); cinco registros de grupo `blocked`, `provider_status=sevilha_envio_manual`, zero envios ao grupo.
- Validação n8n: zero erros e zero avisos. Testes com dados fixados: `536170` (rota), `536181` (loop com dois recibos distintos) e `536182` (recusa SAIR); nenhum envio real nesses testes.
- `node scripts/check-whatsapp-aula.cjs` e ESLint passaram.
- Ativação, teste e aceite do provedor não comprovam entrega. Consultar execução, recibo e estado remoto antes de reportar mensagem entregue ou considerar reenvio.

## Verificação executável

Após aplicar, executar em banco de teste ou fila vazia, como administrador em transação de teste; telefone fictício, rollback obrigatório. Exercita claim único, limite zero, escopo e ausência de retry. O SQL usa bloqueio de linha para concorrência; o workflow relê optout antes de cada envio.

```sql
begin;
insert into public.sevilha_whatsapp_lembretes
  (key, destination, channel, message, due_at, expires_at)
values
  ('sevilha:aula:2026-10-06:self-check', '5500000000000', 'group', 'Teste sem envio', now(), now() + interval '1 minute'),
  ('sevilha:outra-turma:self-check', '5500000000000', 'group', 'Teste sem envio', now(), now() + interval '1 minute');
do $$
begin
  if exists (select 1 from public.sevilha_claim_whatsapp_lembretes(0)) then
    raise exception 'Limite zero reservou mensagem';
  end if;
  perform public.sevilha_claim_whatsapp_lembretes(10);
  if not exists (select 1 from public.sevilha_whatsapp_lembretes
      where key = 'sevilha:aula:2026-10-06:self-check' and state = 'reserved') then
    raise exception 'Claim não reservou mensagem elegível';
  end if;
  if exists (select 1 from public.sevilha_whatsapp_lembretes
      where key = 'sevilha:outra-turma:self-check' and state <> 'queued') then
    raise exception 'Claim escapou do escopo';
  end if;
  if exists (select 1 from public.sevilha_claim_whatsapp_lembretes(10)
      where key = 'sevilha:aula:2026-10-06:self-check') then
    raise exception 'Claim repetiu reserva';
  end if;
end $$;
rollback;
```

Não executar o self-check sobre a fila real ativa: usar ambiente de teste ou fila vazia, sem consumidor. O canal `group` das fixtures evita exigir uma compra fictícia; nenhuma fixture é enviada. Entrega real permanece dependente da leitura posterior dos recibos.
