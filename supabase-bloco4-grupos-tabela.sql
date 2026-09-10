-- Bloco 4 - Grupos e tabela de campeonato
-- Execute este script no SQL Editor do Supabase antes de usar a tela /painel/estrutura.

create table if not exists public."GrupoCampeonato" (
  id bigserial primary key,
  "ligaId" integer not null references public."Liga"(id) on delete cascade,
  nome text not null,
  ordem integer not null default 1,
  classificados integer not null default 0,
  "criadoEm" timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now(),
  constraint "GrupoCampeonato_liga_nome_key" unique ("ligaId", nome)
);

create table if not exists public."GrupoEquipeCampeonato" (
  id bigserial primary key,
  "grupoId" bigint not null references public."GrupoCampeonato"(id) on delete cascade,
  "ligaId" integer not null references public."Liga"(id) on delete cascade,
  "equipeId" integer not null references public."Equipe"(id) on delete cascade,
  posicao integer not null default 1,
  "criadoEm" timestamptz not null default now(),
  constraint "GrupoEquipeCampeonato_liga_equipe_key" unique ("ligaId", "equipeId"),
  constraint "GrupoEquipeCampeonato_grupo_equipe_key" unique ("grupoId", "equipeId")
);

alter table public."Partida"
  add column if not exists "grupoId" bigint references public."GrupoCampeonato"(id) on delete set null;

alter table public."Partida"
  add column if not exists fase text not null default 'GERAL';

create index if not exists "GrupoCampeonato_liga_idx"
  on public."GrupoCampeonato" ("ligaId", ordem);

create index if not exists "GrupoEquipeCampeonato_liga_idx"
  on public."GrupoEquipeCampeonato" ("ligaId", "equipeId");

create index if not exists "Partida_liga_grupo_idx"
  on public."Partida" ("ligaId", "grupoId", fase);

alter table public."GrupoCampeonato" enable row level security;
alter table public."GrupoEquipeCampeonato" enable row level security;

drop policy if exists "GrupoCampeonato_public_select" on public."GrupoCampeonato";
create policy "GrupoCampeonato_public_select"
  on public."GrupoCampeonato"
  for select
  using (true);

drop policy if exists "GrupoEquipeCampeonato_public_select" on public."GrupoEquipeCampeonato";
create policy "GrupoEquipeCampeonato_public_select"
  on public."GrupoEquipeCampeonato"
  for select
  using (true);

revoke insert, update, delete on public."GrupoCampeonato" from anon, authenticated;
revoke insert, update, delete on public."GrupoEquipeCampeonato" from anon, authenticated;
revoke usage, select on sequence public."GrupoCampeonato_id_seq" from anon, authenticated;
revoke usage, select on sequence public."GrupoEquipeCampeonato_id_seq" from anon, authenticated;

grant select on public."GrupoCampeonato" to anon, authenticated;
grant select on public."GrupoEquipeCampeonato" to anon, authenticated;
