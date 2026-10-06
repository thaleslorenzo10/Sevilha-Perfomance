-- Fila isolada; aceite da Evolution não confirma entrega.
create table if not exists public.sevilha_whatsapp_lembretes (
  key text primary key,
  destination text not null,
  channel text not null check (channel in ('group', 'private')),
  message text not null check (length(trim(message)) > 0),
  due_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > due_at),
  state text not null default 'queued'
    check (state in ('queued', 'reserved', 'accepted', 'blocked', 'uncertain')),
  message_id text,
  provider_status text,
  claimed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.sevilha_whatsapp_lembretes enable row level security;
revoke all on public.sevilha_whatsapp_lembretes from public, anon, authenticated;
grant all on public.sevilha_whatsapp_lembretes to service_role;

create or replace function public.sevilha_claim_whatsapp_lembretes(p_limit integer default 10)
returns setof public.sevilha_whatsapp_lembretes
language sql
security invoker
set search_path = public, pg_temp
as $$
  with candidates as materialized (
    select q.key, q.channel,
      case when length(q.destination) = 13 and q.destination like '55__9%'
        then substring(q.destination from 1 for 4) || substring(q.destination from 6)
        else q.destination end as phone8
    from public.sevilha_whatsapp_lembretes q
    where q.state = 'queued'
      and q.key like 'sevilha:aula:2026-10-06:%'
      and q.due_at <= now() and now() < q.expires_at
    order by q.due_at, q.key
    limit greatest(0, least(coalesce(p_limit, 10), 10))
    for update skip locked
  ), claimed as (
    update public.sevilha_whatsapp_lembretes q
    set state = case when c.channel = 'private' and (not exists (
      select 1 from public.sevilha_compras_aula purchase
      cross join lateral (
        select regexp_replace(coalesce(purchase.telefone, ''), '[^0-9]', '', 'g') as digits
      ) cleaned
      cross join lateral (
        select case when length(cleaned.digits) in (10, 11)
          then '55' || cleaned.digits else cleaned.digits end as full_phone
      ) normalized
      where purchase.status = 'paid' and purchase.valor_centavos > 500
        and purchase.payload->'Product'->>'product_id' = 'f1e55370-b1d3-11f1-8d3b-5d78e00f2487'
        and coalesce(purchase.payload->'Product'->>'product_offer_name', '') <> 'Teste'
        and c.phone8 = case
          when length(normalized.full_phone) = 13 and normalized.full_phone like '55__9%'
            then substring(normalized.full_phone from 1 for 4) || substring(normalized.full_phone from 6)
          else normalized.full_phone end
    ) or exists (
      select 1
      from public.lorenzo_whatsapp_optout o
      cross join lateral (values (o.telefone), (o.telefone_8)) phones(raw)
      cross join lateral (
        select regexp_replace(coalesce(phones.raw, ''), '[^0-9]', '', 'g') as digits
      ) cleaned
      cross join lateral (
        select case when length(cleaned.digits) in (10, 11)
          then '55' || cleaned.digits else cleaned.digits end as full_phone
      ) normalized
      where c.phone8 = case
        when length(normalized.full_phone) = 13 and normalized.full_phone like '55__9%'
          then substring(normalized.full_phone from 1 for 4) || substring(normalized.full_phone from 6)
        else normalized.full_phone end
    )) then 'blocked' else 'reserved' end,
      claimed_at = now(), updated_at = now()
    from candidates c
    where q.key = c.key
    returning q.*
  )
  select * from claimed where state = 'reserved';
$$;

revoke all on function public.sevilha_claim_whatsapp_lembretes(integer)
  from public, anon, authenticated;
grant execute on function public.sevilha_claim_whatsapp_lembretes(integer) to service_role;
