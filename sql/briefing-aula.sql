-- Briefing interno isolado de leads, CRM e demais clientes.
create table if not exists public.sevilha_briefings_aula (
  id uuid primary key,
  created_at timestamptz not null default now(),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$')
);

alter table public.sevilha_briefings_aula enable row level security;
revoke all on table public.sevilha_briefings_aula from public, anon, authenticated;
grant select, insert on table public.sevilha_briefings_aula to service_role;

comment on table public.sevilha_briefings_aula is
  'Briefing interno da aula Sevilha Performance. Sem leitura pública e sem eventos de Lead.';
