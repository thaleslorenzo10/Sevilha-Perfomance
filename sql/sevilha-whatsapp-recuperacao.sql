-- Recuperação isolada da turma. Não altera o claim dos compradores.
create or replace function public.sevilha_validar_whatsapp_recuperacao(p_key text)
returns table (eligible boolean)
language sql
security invoker
set search_path = public, pg_temp
as $$
  with job as (
    select destination from public.sevilha_whatsapp_lembretes
    where key = p_key and key like 'sevilha:recuperacao-aula:2026-10-06:%'
      and channel = 'private' and state in ('queued', 'reserved')
      and due_at <= now() and now() < expires_at
  ), raw_contacts as (
    select 'destination' as source, null::text as email, destination as phone, null::text as lead_id from job
    union all
    select 'lead', lower(trim(email)), telefone, id::text from public.sevilha_leads
    where pagina = '/aula-gestao-operacional'
      and created_at >= '2026-09-15T00:00:00-03:00'::timestamptz
      and created_at <= now()
    union all
    select 'buyer', lower(trim(email)), telefone, lead_id::text from public.sevilha_compras_aula
    where status = 'paid' and valor_centavos > 500
      and payload->'Product'->>'product_id' = 'f1e55370-b1d3-11f1-8d3b-5d78e00f2487'
      and coalesce(payload->'Product'->>'product_offer_name', '') <> 'Teste'
    union all
    select 'optout', null::text, phones.raw, null::text
    from public.lorenzo_whatsapp_optout o
    cross join lateral (values (o.telefone), (o.telefone_8)) phones(raw)
  ), digits as (
    select source, email, lead_id, regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') as phone
    from raw_contacts
  ), full_phones as (
    select source, email, lead_id, case when length(phone) in (10, 11)
      then '55' || phone else phone end as phone from digits
  ), normalized as (
    select source, email, lead_id, case when length(phone) = 13 and phone like '55__9%'
      then substring(phone from 1 for 4) || substring(phone from 6)
      else phone end as phone from full_phones
  ), audience as (
    select l.email, l.phone, l.lead_id from normalized l
    join normalized j on j.source = 'destination' and j.phone = l.phone
    where l.source = 'lead' and l.phone ~ '^55[0-9]{10}$'
  )
  select exists (select 1 from audience)
    and not exists (
      select 1 from normalized b where b.source = 'buyer'
        and (b.phone in (select phone from audience)
          or b.email in (select email from audience where email <> '')
          or b.lead_id in (select lead_id from audience))
    ) and not exists (
      select 1 from normalized o where o.source = 'optout'
        and (o.phone in (select phone from audience)
          or (length(o.phone) = 8 and o.phone in (select right(phone, 8) from audience)))
    ) as eligible;
$$;

revoke all on function public.sevilha_validar_whatsapp_recuperacao(text)
  from public, anon, authenticated;
grant execute on function public.sevilha_validar_whatsapp_recuperacao(text) to service_role;

create or replace function public.sevilha_claim_whatsapp_recuperacao(p_limit integer default 10)
returns setof public.sevilha_whatsapp_lembretes
language sql
security invoker
set search_path = public, pg_temp
as $$
  with candidates as materialized (
    select key from public.sevilha_whatsapp_lembretes
    where state = 'queued'
      and key like 'sevilha:recuperacao-aula:2026-10-06:%'
      and due_at <= now() and now() < expires_at
    order by due_at, key
    limit greatest(0, least(coalesce(p_limit, 10), 10))
    for update skip locked
  ), claimed as (
    update public.sevilha_whatsapp_lembretes q
    set state = case when (select eligible from public.sevilha_validar_whatsapp_recuperacao(q.key))
      then 'reserved' else 'blocked' end,
      claimed_at = now(), updated_at = now()
    from candidates c where q.key = c.key
    returning q.*
  )
  select * from claimed where state = 'reserved';
$$;

revoke all on function public.sevilha_claim_whatsapp_recuperacao(integer)
  from public, anon, authenticated;
grant execute on function public.sevilha_claim_whatsapp_recuperacao(integer) to service_role;
