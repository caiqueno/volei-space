-- Limite de substituições por equipe e set. Null mantém 8.
-- Idempotente: não apaga linha e pode rodar de novo.
-- Não recria função e não concede a anon nem a authenticated.
-- Sem a coluna, a súmula continua com 8 substituições.

alter table public."Liga" add column if not exists "limiteSubstituicoesPorSet" integer;
alter table public."CategoriaConfiguracao" add column if not exists "limiteSubstituicoesPorSet" integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Liga_limite_substituicoes_check'
      and conrelid = 'public."Liga"'::regclass
  ) then
    alter table public."Liga" add constraint "Liga_limite_substituicoes_check" check (
      "limiteSubstituicoesPorSet" is null or "limiteSubstituicoesPorSet" between 1 and 30
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'CategoriaConfiguracao_limite_substituicoes_check'
      and conrelid = 'public."CategoriaConfiguracao"'::regclass
  ) then
    alter table public."CategoriaConfiguracao" add constraint "CategoriaConfiguracao_limite_substituicoes_check" check (
      "limiteSubstituicoesPorSet" is null or "limiteSubstituicoesPorSet" between 1 and 30
    );
  end if;
end $$;

notify pgrst, 'reload schema';
