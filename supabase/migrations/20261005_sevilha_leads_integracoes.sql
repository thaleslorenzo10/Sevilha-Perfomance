-- PREPARED ONLY: validar projeto/tabela do cliente antes de aplicar.
-- Não aplicado nesta tarefa. A API faz fallback de leitura se a coluna faltar.
ALTER TABLE public.sevilha_leads
  ADD COLUMN IF NOT EXISTS integracoes jsonb;
COMMENT ON COLUMN public.sevilha_leads.integracoes IS
  'Recibos da própria inscrição: Supabase, Sheets e RD CRM; sem contatos ou segredos.';
