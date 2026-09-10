-- Execute no SQL Editor do Supabase.
-- Garante compatibilidade das candidaturas com login por senha
-- e bloqueia e-mail/telefone repetidos entre equipe, arbitro e fornecedor de quadra.

alter table "CandidaturaEquipe"
  add column if not exists "senhaHash" text;

alter table "CandidaturaArbitro"
  add column if not exists "senhaHash" text;

alter table "CandidaturaQuadra"
  add column if not exists "senhaHash" text,
  add column if not exists cep text;

alter table "CandidaturaEquipe" disable row level security;
alter table "CandidaturaArbitro" disable row level security;
alter table "CandidaturaQuadra" disable row level security;

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
