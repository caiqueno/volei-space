-- Execute este script no SQL Editor do Supabase.
-- Cria o cadastro de "Criador de campeonatos" e inclui esse perfil
-- na trava de e-mail/telefone únicos entre todos os cadastros públicos.

create extension if not exists pgcrypto;

create table if not exists "CandidaturaOrganizador" (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  email text not null,
  telefone text not null,
  "senhaHash" text,
  organizacao text not null,
  cidade text,
  plano text not null default 'PADRAO',
  status text not null default 'ATIVA',
  "criadaEm" timestamp with time zone not null default now(),
  "atualizadaEm" timestamp with time zone not null default now()
);

alter table "CandidaturaOrganizador"
  add column if not exists "senhaHash" text,
  add column if not exists organizacao text,
  add column if not exists cidade text,
  add column if not exists plano text not null default 'PADRAO',
  add column if not exists status text not null default 'ATIVA',
  add column if not exists "criadaEm" timestamp with time zone not null default now(),
  add column if not exists "atualizadaEm" timestamp with time zone not null default now();

create unique index if not exists "CandidaturaOrganizador_email_key"
  on "CandidaturaOrganizador"(email);

create index if not exists "CandidaturaOrganizador_status_idx"
  on "CandidaturaOrganizador"(status);

alter table "CandidaturaOrganizador"
  drop column if exists experiencia,
  drop column if exists objetivo;

alter table "CandidaturaOrganizador"
  alter column status set default 'ATIVA',
  alter column plano set default 'PADRAO';

update "CandidaturaOrganizador"
set plano = 'PADRAO'
where plano is null or plano in ('', 'STARTER', 'PRO', 'ELITE');

create or replace function "touchAtualizadaEm"()
returns trigger
language plpgsql
as $$
begin
  new."atualizadaEm" = now();
  return new;
end;
$$;

drop trigger if exists "CandidaturaOrganizador_touchAtualizadaEm" on "CandidaturaOrganizador";
create trigger "CandidaturaOrganizador_touchAtualizadaEm"
before update on "CandidaturaOrganizador"
for each row execute function "touchAtualizadaEm"();

create or replace function public.normalize_cadastro_phone(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(value, ''), '\D', '', 'g');
$$;

create or replace function public.guard_unique_cadastro_contact()
returns trigger
language plpgsql
as $$
declare
  normalized_email text;
  normalized_phone text;
  current_id text;
begin
  normalized_email := lower(trim(coalesce(new.email, '')));
  normalized_phone := public.normalize_cadastro_phone(new.telefone);
  current_id := coalesce(new.id::text, '');

  if exists (
    select 1 from "CandidaturaEquipe"
    where lower(trim(coalesce(email, ''))) = normalized_email
      and not (tg_table_name = 'CandidaturaEquipe' and id::text = current_id)
    union all
    select 1 from "CandidaturaArbitro"
    where lower(trim(coalesce(email, ''))) = normalized_email
      and not (tg_table_name = 'CandidaturaArbitro' and id::text = current_id)
    union all
    select 1 from "CandidaturaQuadra"
    where lower(trim(coalesce(email, ''))) = normalized_email
      and not (tg_table_name = 'CandidaturaQuadra' and id::text = current_id)
    union all
    select 1 from "CandidaturaOrganizador"
    where lower(trim(coalesce(email, ''))) = normalized_email
      and not (tg_table_name = 'CandidaturaOrganizador' and id::text = current_id)
  ) then
    raise exception 'DUPLICATE_CADASTRO_EMAIL';
  end if;

  if normalized_phone <> '' and exists (
    select 1 from "CandidaturaEquipe"
    where public.normalize_cadastro_phone(telefone) = normalized_phone
      and not (tg_table_name = 'CandidaturaEquipe' and id::text = current_id)
    union all
    select 1 from "CandidaturaArbitro"
    where public.normalize_cadastro_phone(telefone) = normalized_phone
      and not (tg_table_name = 'CandidaturaArbitro' and id::text = current_id)
    union all
    select 1 from "CandidaturaQuadra"
    where public.normalize_cadastro_phone(telefone) = normalized_phone
      and not (tg_table_name = 'CandidaturaQuadra' and id::text = current_id)
    union all
    select 1 from "CandidaturaOrganizador"
    where public.normalize_cadastro_phone(telefone) = normalized_phone
      and not (tg_table_name = 'CandidaturaOrganizador' and id::text = current_id)
  ) then
    raise exception 'DUPLICATE_CADASTRO_TELEFONE';
  end if;

  new.email := normalized_email;
  return new;
end;
$$;

drop trigger if exists "CandidaturaEquipe_guard_unique_contact" on "CandidaturaEquipe";
create trigger "CandidaturaEquipe_guard_unique_contact"
before insert or update of email, telefone on "CandidaturaEquipe"
for each row execute function public.guard_unique_cadastro_contact();

drop trigger if exists "CandidaturaArbitro_guard_unique_contact" on "CandidaturaArbitro";
create trigger "CandidaturaArbitro_guard_unique_contact"
before insert or update of email, telefone on "CandidaturaArbitro"
for each row execute function public.guard_unique_cadastro_contact();

drop trigger if exists "CandidaturaQuadra_guard_unique_contact" on "CandidaturaQuadra";
create trigger "CandidaturaQuadra_guard_unique_contact"
before insert or update of email, telefone on "CandidaturaQuadra"
for each row execute function public.guard_unique_cadastro_contact();

drop trigger if exists "CandidaturaOrganizador_guard_unique_contact" on "CandidaturaOrganizador";
create trigger "CandidaturaOrganizador_guard_unique_contact"
before insert or update of email, telefone on "CandidaturaOrganizador"
for each row execute function public.guard_unique_cadastro_contact();

grant usage on schema public to anon, authenticated;
grant select, insert, update on table "CandidaturaOrganizador" to anon, authenticated;

alter table "CandidaturaOrganizador" enable row level security;

drop policy if exists "Cadastro publico de organizador" on "CandidaturaOrganizador";
create policy "Cadastro publico de organizador"
on "CandidaturaOrganizador"
for insert
to anon, authenticated
with check (
  status = 'ATIVA'
  and coalesce(plano, 'PADRAO') = 'PADRAO'
);

drop policy if exists "Organizador consulta proprio cadastro" on "CandidaturaOrganizador";
create policy "Organizador consulta proprio cadastro"
on "CandidaturaOrganizador"
for select
to anon, authenticated
using (true);
