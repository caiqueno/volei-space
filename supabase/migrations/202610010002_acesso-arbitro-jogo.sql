-- Acesso do árbitro por link exclusivo e código definido pelo organizador.
-- O código fica só como hash. O token da URL não é o id numérico da partida.

alter table "Liga" add column if not exists "seedKey" text;
create unique index if not exists liga_seed_key_unique on "Liga" ("seedKey") where "seedKey" is not null;

alter table "Partida" add column if not exists "seedKey" text;
create unique index if not exists partida_seed_key_unique on "Partida" ("seedKey") where "seedKey" is not null;

create table if not exists "AcessoArbitroJogo" (
  id text primary key default gen_random_uuid()::text,
  "partidaId" integer not null unique references "Partida"(id) on delete cascade,
  token text not null unique,
  "codigoHash" text not null,
  ativo boolean not null default true,
  "criadoPor" text,
  "criadoEm" timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now(),
  "expiraEm" timestamptz,
  "ultimoAcessoEm" timestamptz,
  "tentativasFalhas" integer not null default 0,
  "bloqueadoAte" timestamptz,
  "revogadoEm" timestamptz,
  "revogadoPor" text
);

create table if not exists "AcessoArbitroEvento" (
  id text primary key default gen_random_uuid()::text,
  "partidaId" integer not null references "Partida"(id) on delete cascade,
  "acessoId" text,
  tipo text not null,
  "organizadorId" text,
  resultado text not null,
  "criadoEm" timestamptz not null default now()
);

create index if not exists acesso_arbitro_evento_partida_idx on "AcessoArbitroEvento" ("partidaId", "criadoEm");

alter table "AcessoArbitroJogo" enable row level security;
alter table "AcessoArbitroEvento" enable row level security;

revoke all on table "AcessoArbitroJogo" from anon, authenticated;
revoke all on table "AcessoArbitroEvento" from anon, authenticated;

grant all on table "AcessoArbitroJogo" to service_role;
grant all on table "AcessoArbitroEvento" to service_role;
