-- Líbero da súmula. Null mantém a exigência atual de um líbero inicial.
-- Idempotente. Não recria função e não concede a anon nem a authenticated.
-- Sem as colunas, a troca de líbero continua fora da cota de substituições.

alter table public."Liga" add column if not exists "exigirLiberoInicial" boolean;
alter table public."CategoriaConfiguracao" add column if not exists "exigirLiberoInicial" boolean;
alter table public."Liga" add column if not exists "quantidadeLiberos" integer;
alter table public."CategoriaConfiguracao" add column if not exists "quantidadeLiberos" integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Liga_quantidade_liberos_check'
      and conrelid = 'public."Liga"'::regclass
  ) then
    alter table public."Liga" add constraint "Liga_quantidade_liberos_check" check (
      "quantidadeLiberos" is null or "quantidadeLiberos" between 1 and 2
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'CategoriaConfiguracao_quantidade_liberos_check'
      and conrelid = 'public."CategoriaConfiguracao"'::regclass
  ) then
    alter table public."CategoriaConfiguracao" add constraint "CategoriaConfiguracao_quantidade_liberos_check" check (
      "quantidadeLiberos" is null or "quantidadeLiberos" between 1 and 2
    );
  end if;
end $$;

notify pgrst, 'reload schema';
