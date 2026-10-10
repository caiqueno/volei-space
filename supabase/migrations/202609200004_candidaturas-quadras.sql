-- Execute este script no SQL Editor do Supabase.
-- Ele cria a tabela usada pelo formulario "Fornecedor de quadra".

create extension if not exists pgcrypto;

insert into "Liga" (
  slug,
  nome,
  subtitulo,
  descricao,
  "corTematica",
  status,
  "criadoEm",
  "atualizadoEm"
)
values (
  'luva-2026',
  'LUVA',
  'Temporada oficial',
  'Liga Unica de Volei',
  '#0F2C52',
  'ATIVA',
  now(),
  now()
)
on conflict (slug) do nothing;

create table if not exists "CandidaturaQuadra" (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  responsavel text not null,
  email text not null,
  telefone text not null,
  endereco text not null,
  bairro text,
  estrutura text,
  horarios text,
  cobertura boolean not null default false,
  banheiro boolean not null default false,
  estacionamento boolean not null default false,
  "ligaId" integer references "Liga"(id) on delete set null,
  status text not null default 'PENDENTE',
  "criadaEm" timestamp with time zone not null default now(),
  "atualizadaEm" timestamp with time zone not null default now()
);

create index if not exists "CandidaturaQuadra_status_idx"
  on "CandidaturaQuadra"(status);

create index if not exists "CandidaturaQuadra_ligaId_idx"
  on "CandidaturaQuadra"("ligaId");

create unique index if not exists "CandidaturaQuadra_email_pendente_idx"
  on "CandidaturaQuadra"(email)
  where status = 'PENDENTE';

create or replace function "touchAtualizadaEm"()
returns trigger
language plpgsql
as $$
begin
  new."atualizadaEm" = now();
  return new;
end;
$$;

drop trigger if exists "CandidaturaQuadra_touchAtualizadaEm" on "CandidaturaQuadra";

create trigger "CandidaturaQuadra_touchAtualizadaEm"
before update on "CandidaturaQuadra"
for each row
execute function "touchAtualizadaEm"();

alter table "CandidaturaQuadra" disable row level security;

-- Observacao:
-- O projeto atual acessa o Supabase pelo servidor usando a anon key.
-- Por isso, esta tabela fica sem RLS para manter o mesmo padrao das demais tabelas do prototipo.
-- Quando migrarmos para service role no backend, podemos reativar RLS com politicas mais restritas.
