-- Tempos da súmula. Null mantém 2 tempos e um único botão.
-- Idempotente: não apaga linha e pode rodar de novo.
-- Não recria função e não concede a anon nem a authenticated.
-- Sem as colunas, a súmula continua com 2 tempos técnicos.

alter table public."Liga" add column if not exists "limiteTemposPorSet" integer;
alter table public."CategoriaConfiguracao" add column if not exists "limiteTemposPorSet" integer;
alter table public."Liga" add column if not exists "separarTempos" boolean;
alter table public."CategoriaConfiguracao" add column if not exists "separarTempos" boolean;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Liga_limite_tempos_check'
      and conrelid = 'public."Liga"'::regclass
  ) then
    alter table public."Liga" add constraint "Liga_limite_tempos_check" check (
      "limiteTemposPorSet" is null or "limiteTemposPorSet" between 1 and 4
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'CategoriaConfiguracao_limite_tempos_check'
      and conrelid = 'public."CategoriaConfiguracao"'::regclass
  ) then
    alter table public."CategoriaConfiguracao" add constraint "CategoriaConfiguracao_limite_tempos_check" check (
      "limiteTemposPorSet" is null or "limiteTemposPorSet" between 1 and 4
    );
  end if;
end $$;

notify pgrst, 'reload schema';
