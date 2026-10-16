-- 202610170001_rate_limit.sql
--
-- OBJETIVO
--   Store do rate limit em tabela do Supabase (decisão D3, PR B2 do backend).
--   Cria "RateLimit" (chave, contagem, expiraEm), com RLS ligada e sem nenhum
--   privilégio para anon/authenticated: só service_role lê e escreve.
--   Extra pequeno e opcional para o backend (evita corrida no incremento):
--   rate_limit_hit(chave, janela_segundos) e rate_limit_limpar(), ambas só
--   para service_role.
--
-- PRÉ-REQUISITOS
--   Nenhum (tabela nova, sem FK). Só aplicar com aprovação, em preview primeiro.
--
-- QUEBRA DE ROTAS
--   Nenhuma. Nada lê esta tabela até o PR B2 entrar. Aditiva.
--
-- BACKUP NECESSÁRIO
--   Nenhum (nenhum dado existente é tocado).
--
-- JANELA SEGURA
--   Qualquer horário, inclusive durante rodada: DDL de tabela nova, sem lock
--   em tabela existente.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170001_rate_limit.sql

begin;

create table if not exists public."RateLimit" (
  chave      text primary key check (char_length(chave) between 1 and 200),
  contagem   integer not null default 0 check (contagem >= 0),
  "expiraEm" timestamptz not null
);

create index if not exists "RateLimit_expiraEm_idx"
  on public."RateLimit" ("expiraEm");

alter table public."RateLimit" enable row level security;

-- Sem policy alguma: anon e authenticated não passam nem se alguém conceder
-- privilégio por engano. service_role ignora RLS.
revoke all on table public."RateLimit" from public, anon, authenticated;
grant select, insert, update, delete on table public."RateLimit" to service_role;

-- Incremento atômico: uma única instrução decide se a janela expirou.
-- Devolve a contagem depois do incremento e quando a janela termina.
create or replace function public.rate_limit_hit(p_chave text, p_janela_segundos integer)
returns table (out_contagem integer, out_expira_em timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_chave is null or char_length(p_chave) not between 1 and 200
     or p_janela_segundos is null or p_janela_segundos not between 1 and 86400 then
    raise exception 'Parametros invalidos para rate_limit_hit' using errcode = '22023';
  end if;

  return query
  insert into public."RateLimit" as r (chave, contagem, "expiraEm")
  values (p_chave, 1, now() + make_interval(secs => p_janela_segundos))
  on conflict (chave) do update
    set contagem   = case when r."expiraEm" <= now() then 1 else r.contagem + 1 end,
        "expiraEm" = case when r."expiraEm" <= now()
                          then now() + make_interval(secs => p_janela_segundos)
                          else r."expiraEm" end
  returning r.contagem, r."expiraEm";
end;
$$;

-- Limpeza de linhas vencidas há mais de 1 hora (chamada por job ou pela rota).
create or replace function public.rate_limit_limpar()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removidas integer;
begin
  delete from public."RateLimit" where "expiraEm" < now() - interval '1 hour';
  get diagnostics removidas = row_count;
  return removidas;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer) from public, anon, authenticated;
revoke all on function public.rate_limit_limpar() from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer) to service_role;
grant execute on function public.rate_limit_limpar() to service_role;

commit;
