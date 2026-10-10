-- A API grava pelo cliente do Supabase, não pelo Prisma.
-- @default(uuid()) e @default(cuid()) do schema não criam default no Postgres.
-- Sem esse default, o insert chega com id nulo e a coluna NOT NULL recusa a linha.

do $$
declare
  coluna record;
begin
  for coluna in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.column_name = 'id'
      and c.is_nullable = 'NO'
      and c.column_default is null
      and c.data_type in ('uuid', 'text', 'character varying')
  loop
    if coluna.data_type = 'uuid' then
      execute format(
        'alter table %I alter column %I set default gen_random_uuid()',
        coluna.table_name,
        coluna.column_name
      );
    else
      execute format(
        'alter table %I alter column %I set default gen_random_uuid()::text',
        coluna.table_name,
        coluna.column_name
      );
    end if;
  end loop;
end $$;
