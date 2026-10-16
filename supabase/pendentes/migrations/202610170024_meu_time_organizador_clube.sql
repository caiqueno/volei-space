-- 202610170024_meu_time_organizador_clube.sql   (M3 do plano; docs/analise/07 seção 4, 14 seção 3)
--
-- OBJETIVO
--   Base de identidade do modelo "Meu Time" (PROMPT, modelo de dados de referência), aditiva:
--   * "Organizador" e "MembroOrganizador" (papel ADMINISTRADOR/FINANCEIRO/ARBITRAGEM);
--   * coluna "Liga"."organizadorUuid" (nullable, FK) para ligar campeonato a Organizador SEM mudar o
--     tipo de "Liga"."organizadorId" (texto legado). Backfill fica fora desta migration;
--   * "Clube" (dono do banco de atletas) e "TimeClube" (a equipe PERMANENTE do responsável);
--   * "MembroEquipe" (RESPONSAVEL/TECNICO/ASSISTENTE/CAPITAO) com índice por usuarioId.
--
--   DECISÃO PENDENTE (marcada): a lista de tabelas pedida não inclui a equipe permanente, e a
--   "Equipe" legada está presa a uma Liga ("ligaId" not null, 14 D14: não alterar). Por isso foi
--   criada "TimeClube", e "MembroEquipe" aponta para ela pela coluna "timeId" (no texto do 07, a
--   coluna se chama equipeId). Confirmar o nome com o produto antes de aplicar.
--
--   "usuarioId" é text SEM FK: ainda não existe tabela Usuario. Guarda o id da conta legada
--   (ContaPublico.id, CandidaturaEquipe.id, CandidaturaOrganizador.id, ... todos text). Quando
--   existir identidade única, uma migration nova troca para FK.
--
--   Segurança: RLS ligada em todas, SEM nenhuma policy e SEM grant para anon/authenticated. Só
--   service_role (o app autentica com JWT próprio e usa service_role). As policies por papel
--   ("fase B", dependem de claim no JWT) ficam para depois e são decisão do arquiteto-backend.
--
-- PRÉ-REQUISITOS
--   "Liga" existente. Sem outras dependências. Aplicar depois de M1 (esta migration já nasce fechada).
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabelas e coluna novas, nullable; nenhum código as conhece).
--
-- BACKUP NECESSÁRIO
--   Nenhum (só objetos novos; ADD COLUMN nullable em "Liga" não reescreve a tabela).
--
-- JANELA SEGURA
--   Fora de rodada por prudência: ALTER TABLE "Liga" pega lock curto (lock_timeout 5 s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170024_meu_time_organizador_clube.sql

begin;
set local lock_timeout = '5s';

create table if not exists public."Organizador" (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(btrim(nome)) between 1 and 200),
  "legadoId"    text unique,  -- = "Liga"."organizadorId" = "CandidaturaOrganizador".id (texto legado)
  "criadoEm"    timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now(),
  "arquivadoEm" timestamptz
);

create table if not exists public."MembroOrganizador" (
  "organizadorId" uuid not null references public."Organizador"(id) on delete cascade,
  "usuarioId"     text not null check (char_length("usuarioId") between 1 and 100),
  papel           text not null check (papel in ('ADMINISTRADOR', 'FINANCEIRO', 'ARBITRAGEM')),
  "criadoEm"      timestamptz not null default now(),
  primary key ("organizadorId", "usuarioId")
);
create index if not exists "MembroOrganizador_usuarioId_idx"
  on public."MembroOrganizador" ("usuarioId");

alter table public."Liga"
  add column if not exists "organizadorUuid" uuid;

do $m3$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."Liga"'::regclass and conname = 'Liga_organizadorUuid_fkey'
  ) then
    alter table public."Liga"
      add constraint "Liga_organizadorUuid_fkey"
      foreign key ("organizadorUuid") references public."Organizador"(id) on delete set null;
  end if;
end
$m3$;

create table if not exists public."Clube" (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(btrim(nome)) between 1 and 200),
  cnpj          text,
  cidade        text,
  uf            char(2),
  origem        text not null default 'APP' check (origem in ('APP', 'MIGRACAO')),
  "criadoPor"   text,  -- usuarioId (texto legado), sem FK
  "criadoEm"    timestamptz not null default now(),
  "arquivadoEm" timestamptz
);

-- Equipe permanente do responsável (o "Meu Time"); a "Equipe" legada continua sendo a equipe
-- inscrita numa competição.
create table if not exists public."TimeClube" (
  id            uuid primary key default gen_random_uuid(),
  "clubeId"     uuid not null references public."Clube"(id) on delete restrict,
  nome          text not null check (char_length(btrim(nome)) between 1 and 200),
  cidade        text,
  naipe         text not null check (naipe in ('FEMININO', 'MASCULINO', 'MISTO')),
  "escudoUrl"   text,
  "criadoEm"    timestamptz not null default now(),
  "arquivadoEm" timestamptz,
  unique (id, "clubeId")
);
create unique index if not exists "TimeClube_clube_nome_naipe_key"
  on public."TimeClube" ("clubeId", lower(btrim(nome)), naipe) where "arquivadoEm" is null;

create table if not exists public."MembroEquipe" (
  "timeId"    uuid not null references public."TimeClube"(id) on delete cascade,
  "usuarioId" text not null check (char_length("usuarioId") between 1 and 100),
  papel       text not null check (papel in ('RESPONSAVEL', 'TECNICO', 'ASSISTENTE', 'CAPITAO')),
  "criadoEm"  timestamptz not null default now(),
  primary key ("timeId", "usuarioId")
);
create index if not exists "MembroEquipe_usuarioId_idx"
  on public."MembroEquipe" ("usuarioId");

-- Fechadas por padrão: RLS sem policy e sem grant para anon/authenticated.
do $m3$
declare
  nome text;
begin
  foreach nome in array array['Organizador', 'MembroOrganizador', 'Clube', 'TimeClube', 'MembroEquipe'] loop
    execute format('alter table public.%I enable row level security', nome);
    execute format('revoke all on table public.%I from public, anon, authenticated', nome);
    execute format('grant select, insert, update, delete on table public.%I to service_role', nome);
  end loop;
end
$m3$;

commit;
