-- Compras da aula paga (webhook da Kiwify). Projeto Lorenzo Media,
-- convenção <cliente>_<dominio>. Aplicar no SQL Editor do Supabase.
create table if not exists sevilha_compras_aula (
  order_id        text primary key,
  status          text not null,               -- paid | refunded
  email           text,
  nome            text,
  telefone        text,
  valor_centavos  integer not null,
  sck             text,                        -- event_id do lead (vem do checkout)
  lead_id         uuid,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  capi_status     text,                        -- ok | erro:<motivo> | pendente
  crm_status      text,                        -- ok | sem-deal | erro:<motivo>
  pago_em         timestamptz,
  payload         jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists sevilha_compras_aula_pago_em on sevilha_compras_aula (pago_em);
create index if not exists sevilha_compras_aula_email on sevilha_compras_aula (lower(email));
