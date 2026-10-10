-- Isola campeonatos de simulação dos campeonatos reais.
-- A coluna fica no servidor. Listagens públicas filtram simulacao = false.
-- A limpeza da central só apaga linhas com simulacao = true.

alter table public."Liga"
  add column if not exists simulacao boolean not null default false;

alter table public."Liga"
  add column if not exists "simulacaoRelogio" jsonb not null default '{}'::jsonb;

create index if not exists liga_simulacao_idx
  on public."Liga" (simulacao)
  where simulacao = true;

-- A limpeza da simulação precisa apagar um campeonato de teste mesmo depois
-- que ele foi marcado como FINALIZADO. Campeonato real finalizado continua bloqueado.
create or replace function public.campeonato_esta_finalizado(p_liga_id integer)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public."Liga"
    where id = p_liga_id and status = 'FINALIZADO' and simulacao = false
  );
$$;

create or replace function public.bloquear_liga_finalizada()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'FINALIZADO' and old.simulacao = false then
    raise exception 'Campeonato finalizado: somente consulta' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
