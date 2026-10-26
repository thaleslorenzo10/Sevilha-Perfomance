-- A referência curta existe no CSV e no webhook. Preserva IDs e recibos atuais.
-- O índice também impede duplicação entre importação e webhook concorrentes.
create unique index if not exists sevilha_compras_aula_order_ref_unico
on public.sevilha_compras_aula ((payload->>'order_ref'))
where nullif(payload->>'order_ref', '') is not null;

-- Serializa importação/reentrega por referência e preserva estornos e recibos.
create or replace function public.sevilha_registrar_compra_kiwify(registro jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  r public.sevilha_compras_aula;
  anterior public.sevilha_compras_aula;
  candidato public.sevilha_compras_aula;
  salvo public.sevilha_compras_aula;
  referencia text := nullif(registro->'payload'->>'order_ref', '');
begin
  r := jsonb_populate_record(null::public.sevilha_compras_aula, registro);
  if r.order_id is null or r.status not in ('paid', 'refunded') or r.valor_centavos is null or r.valor_centavos < 0 or r.pago_em is null then
    raise exception 'invalid_purchase';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('sevilha-kiwify:' || coalesce(referencia, r.order_id), 0));
  for candidato in select * from public.sevilha_compras_aula
    where order_id = r.order_id or (referencia is not null and payload->>'order_ref' = referencia)
    order by order_id for update loop
    if anterior.order_id is not null then raise exception 'purchase_identity_divergence'; end if;
    anterior := candidato;
  end loop;
  if anterior.order_id is not null then
    if anterior.status = 'refunded' and r.status = 'paid' then return to_jsonb(anterior); end if;
    if anterior.payload ? 'importacao' then
      r.payload := r.payload || jsonb_build_object('importacao', anterior.payload->'importacao' ||
        case when registro->>'aprovacao_confirmada' = 'true' then jsonb_build_object('data_pagamento', 'aprovacao_webhook') else '{}'::jsonb end);
    end if;
    update public.sevilha_compras_aula set
      status = r.status, email = r.email, nome = coalesce(r.nome, anterior.nome), telefone = coalesce(r.telefone, anterior.telefone),
      valor_centavos = r.valor_centavos, sck = coalesce(r.sck, anterior.sck), lead_id = coalesce(r.lead_id, anterior.lead_id),
      utm_source = coalesce(r.utm_source, anterior.utm_source), utm_medium = coalesce(r.utm_medium, anterior.utm_medium),
      utm_campaign = coalesce(r.utm_campaign, anterior.utm_campaign), utm_content = coalesce(r.utm_content, anterior.utm_content),
      utm_term = coalesce(r.utm_term, anterior.utm_term),
      capi_status = coalesce(anterior.capi_status, r.capi_status), crm_status = coalesce(anterior.crm_status, r.crm_status),
      pago_em = r.pago_em, payload = r.payload, updated_at = now()
      where order_id = anterior.order_id returning * into salvo;
  else
    insert into public.sevilha_compras_aula
      (order_id,status,email,nome,telefone,valor_centavos,sck,lead_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,capi_status,crm_status,pago_em,payload,created_at,updated_at)
    values (r.order_id,r.status,r.email,r.nome,r.telefone,r.valor_centavos,r.sck,r.lead_id,r.utm_source,r.utm_medium,r.utm_campaign,r.utm_content,r.utm_term,r.capi_status,r.crm_status,r.pago_em,r.payload,now(),now())
    returning * into salvo;
  end if;
  return to_jsonb(salvo);
end;
$$;
revoke all on function public.sevilha_registrar_compra_kiwify(jsonb) from public, anon, authenticated;
grant execute on function public.sevilha_registrar_compra_kiwify(jsonb) to service_role;
