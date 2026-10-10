-- Alerta de rodízio ilegal. Null ou false não muda a súmula.
-- Idempotente. Não recria função e não concede a anon nem a authenticated.

alter table public."Liga" add column if not exists "alertaRodizioIlegal" boolean;
alter table public."CategoriaConfiguracao" add column if not exists "alertaRodizioIlegal" boolean;

notify pgrst, 'reload schema';
