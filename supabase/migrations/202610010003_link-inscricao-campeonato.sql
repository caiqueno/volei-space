-- Link de inscrição exclusivo do campeonato. O token não é o id numérico.

create table if not exists "LinkInscricaoCampeonato" (
  id text primary key default gen_random_uuid()::text,
  "ligaId" integer not null unique references "Liga"(id) on delete cascade,
  token text not null unique,
  ativo boolean not null default true,
  "criadoPor" text,
  "criadoEm" timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now(),
  "expiraEm" timestamptz,
  "ultimoAcessoEm" timestamptz,
  "revogadoEm" timestamptz,
  "revogadoPor" text
);

create table if not exists "LinkInscricaoEvento" (
  id text primary key default gen_random_uuid()::text,
  "ligaId" integer not null references "Liga"(id) on delete cascade,
  "linkId" text,
  tipo text not null,
  "organizadorId" text,
  resultado text not null,
  "criadoEm" timestamptz not null default now()
);

create index if not exists link_inscricao_evento_liga_idx on "LinkInscricaoEvento" ("ligaId", "criadoEm");

alter table "Equipe" add column if not exists "seedKey" text;
create unique index if not exists equipe_seed_key_unique on "Equipe" ("seedKey") where "seedKey" is not null;

alter table "Jogador" add column if not exists "seedKey" text;
create unique index if not exists jogador_seed_key_unique on "Jogador" ("seedKey") where "seedKey" is not null;

alter table "LinkInscricaoCampeonato" enable row level security;
alter table "LinkInscricaoEvento" enable row level security;

revoke all on table "LinkInscricaoCampeonato" from anon, authenticated;
revoke all on table "LinkInscricaoEvento" from anon, authenticated;

grant all on table "LinkInscricaoCampeonato" to service_role;
grant all on table "LinkInscricaoEvento" to service_role;
