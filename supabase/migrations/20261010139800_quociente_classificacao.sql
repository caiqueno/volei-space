-- Amplia a lista de critérios da categoria com média de sets e média de pontos.
-- Não apaga linha. Não cria tabela. Não concede a anon nem a authenticated.
-- Não foi aplicada. O prefixo fica depois de 20261010139700 e antes de 20261010140000.
-- Enquanto esta checagem não existir, o aplicativo grava a categoria sem esses
-- dois critérios e o desempate padrão continua o mesmo.

do $$
declare
  nome text;
begin
  if to_regclass('public."CategoriaConfiguracao"') is null then
    return;
  end if;

  for nome in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'CategoriaConfiguracao'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%SALDO_PONTOS%'
      and pg_get_constraintdef(con.oid) not like '%SET_AVERAGE%'
  loop
    execute format('alter table public."CategoriaConfiguracao" drop constraint %I', nome);
  end loop;

  if not exists (
    select 1 from pg_constraint where conname = 'CategoriaConfiguracao_criterios_conhecidos_check'
  ) then
    alter table public."CategoriaConfiguracao"
      add constraint "CategoriaConfiguracao_criterios_conhecidos_check"
      check (
        jsonb_typeof("criteriosClassificacao"::jsonb) = 'array'
        and "criteriosClassificacao"::jsonb <@ '["PONTOS","VITORIAS","DERROTAS","SALDO_SETS","SALDO_PONTOS","SETS_PRO","PONTOS_PRO","SET_AVERAGE","POINT_AVERAGE"]'::jsonb
      );
  end if;
end $$;
