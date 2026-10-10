-- Tempo médico e substituição por lesão. Null não muda a súmula.
-- Idempotente. Não recria função e não concede a anon nem a authenticated.

alter table public."Liga" add column if not exists "tempoMedico" boolean;
alter table public."CategoriaConfiguracao" add column if not exists "tempoMedico" boolean;
alter table public."Liga" add column if not exists "substituicaoPorLesao" boolean;
alter table public."CategoriaConfiguracao" add column if not exists "substituicaoPorLesao" boolean;

notify pgrst, 'reload schema';
