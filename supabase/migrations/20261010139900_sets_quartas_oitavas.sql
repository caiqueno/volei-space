-- Quantidade de sets das quartas e das oitavas.
-- Null herda setsPorPartida. Idempotente: não apaga linha e pode rodar de novo.
-- Não recria função e não concede a anon nem a authenticated.
-- Enquanto estas colunas não existirem, a súmula continua com setsPorPartida.

alter table public."Liga" add column if not exists "setsPorPartidaQuartas" integer;
alter table public."Liga" add column if not exists "setsPorPartidaOitavas" integer;

alter table public."CategoriaConfiguracao" add column if not exists "setsPorPartidaQuartas" integer;
alter table public."CategoriaConfiguracao" add column if not exists "setsPorPartidaOitavas" integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Liga_sets_quartas_oitavas_check'
      and conrelid = 'public."Liga"'::regclass
  ) then
    alter table public."Liga" add constraint "Liga_sets_quartas_oitavas_check" check (
      ("setsPorPartidaQuartas" is null or "setsPorPartidaQuartas" between 1 and 5)
      and ("setsPorPartidaOitavas" is null or "setsPorPartidaOitavas" between 1 and 5)
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'CategoriaConfiguracao_sets_quartas_oitavas_check'
      and conrelid = 'public."CategoriaConfiguracao"'::regclass
  ) then
    alter table public."CategoriaConfiguracao" add constraint "CategoriaConfiguracao_sets_quartas_oitavas_check" check (
      ("setsPorPartidaQuartas" is null or "setsPorPartidaQuartas" between 1 and 5)
      and ("setsPorPartidaOitavas" is null or "setsPorPartidaOitavas" between 1 and 5)
    );
  end if;
end $$;

notify pgrst, 'reload schema';
