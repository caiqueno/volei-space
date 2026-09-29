-- Campeonato finalizado: consulta pública preservada e mutação operacional bloqueada.
-- O service role ignora RLS, então o bloqueio de escrita fica em trigger.

alter table public."Liga"
  add column if not exists "finalizadoEm" timestamptz,
  add column if not exists "finalizadoPor" text;

-- Inclui FINALIZADO nas políticas de leitura que já listam ENCERRADA dentro de um array.
-- Não cria RLS novo: neste banco "Liga" está sem row level security.
do $$
declare
  pol record;
  nova text;
begin
  for pol in
    select schemaname, tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and qual like '%''ENCERRADA''::text]%'
      and qual not like '%FINALIZADO%'
  loop
    nova := replace(pol.qual, '''ENCERRADA''::text]', '''ENCERRADA''::text, ''FINALIZADO''::text]');
    execute format('alter policy %I on %I.%I using (%s)', pol.policyname, pol.schemaname, pol.tablename, nova);
  end loop;
end $$;

create or replace function public.campeonato_esta_finalizado(p_liga_id integer)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public."Liga"
    where id = p_liga_id and status = 'FINALIZADO'
  );
$$;

create or replace function public.bloquear_liga_finalizada()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'FINALIZADO' then
    raise exception 'Campeonato finalizado: somente consulta' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.bloquear_filho_liga_finalizada()
returns trigger
language plpgsql
as $$
declare
  v_liga_id integer;
begin
  if tg_op = 'DELETE' then
    v_liga_id := old."ligaId";
  else
    v_liga_id := new."ligaId";
  end if;

  if v_liga_id is not null and public.campeonato_esta_finalizado(v_liga_id) then
    raise exception 'Campeonato finalizado: somente consulta' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.bloquear_filho_partida_finalizada()
returns trigger
language plpgsql
as $$
declare
  v_partida_id integer;
  v_liga_id integer;
begin
  v_partida_id := case when tg_op = 'DELETE' then old."partidaId" else new."partidaId" end;
  select p."ligaId" into v_liga_id from public."Partida" p where p.id = v_partida_id;
  if v_liga_id is not null and public.campeonato_esta_finalizado(v_liga_id) then
    raise exception 'Campeonato finalizado: somente consulta' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.bloquear_filho_equipe_finalizada()
returns trigger
language plpgsql
as $$
declare
  v_equipe_id integer;
  v_liga_id integer;
begin
  v_equipe_id := case when tg_op = 'DELETE' then old."equipeId" else new."equipeId" end;
  select e."ligaId" into v_liga_id from public."Equipe" e where e.id = v_equipe_id;
  if v_liga_id is not null and public.campeonato_esta_finalizado(v_liga_id) then
    raise exception 'Campeonato finalizado: somente consulta' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_liga_finalizada on public."Liga";
create trigger trg_bloquear_liga_finalizada
before update or delete on public."Liga"
for each row execute function public.bloquear_liga_finalizada();

do $$
declare
  r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'ligaId'
      and c.data_type = 'integer'
      and t.table_type = 'BASE TABLE'
      and c.table_name <> 'Liga'
  loop
    execute format('drop trigger if exists trg_bloquear_campeonato_finalizado on public.%I', r.table_name);
    execute format(
      'create trigger trg_bloquear_campeonato_finalizado before insert or update or delete on public.%I for each row execute function public.bloquear_filho_liga_finalizada()',
      r.table_name
    );
  end loop;

  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'partidaId'
      and c.data_type = 'integer'
      and t.table_type = 'BASE TABLE'
      and not exists (
        select 1 from information_schema.columns c2
        where c2.table_schema = 'public'
          and c2.table_name = c.table_name
          and c2.column_name = 'ligaId'
      )
  loop
    execute format('drop trigger if exists trg_bloquear_partida_finalizada on public.%I', r.table_name);
    execute format(
      'create trigger trg_bloquear_partida_finalizada before insert or update or delete on public.%I for each row execute function public.bloquear_filho_partida_finalizada()',
      r.table_name
    );
  end loop;

  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'equipeId'
      and c.data_type = 'integer'
      and t.table_type = 'BASE TABLE'
      and not exists (
        select 1 from information_schema.columns c2
        where c2.table_schema = 'public'
          and c2.table_name = c.table_name
          and c2.column_name = 'ligaId'
      )
      and not exists (
        select 1 from information_schema.columns c3
        where c3.table_schema = 'public'
          and c3.table_name = c.table_name
          and c3.column_name = 'partidaId'
      )
  loop
    execute format('drop trigger if exists trg_bloquear_equipe_finalizada on public.%I', r.table_name);
    execute format(
      'create trigger trg_bloquear_equipe_finalizada before insert or update or delete on public.%I for each row execute function public.bloquear_filho_equipe_finalizada()',
      r.table_name
    );
  end loop;
end $$;
