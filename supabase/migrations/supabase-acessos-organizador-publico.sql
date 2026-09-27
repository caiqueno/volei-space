-- ID de acesso do organizador, emitido pelo administrador.
-- Conta do público geral, só para acompanhar o evento.

create table if not exists "CodigoAcessoOrganizador" (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  "organizadorId" text unique,
  "criadoEm" timestamptz not null default now(),
  "usadoEm" timestamptz
);

create table if not exists "ContaPublico" (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  email text not null unique,
  "senhaHash" text not null,
  status text not null default 'ATIVA',
  "criadoEm" timestamptz not null default now()
);
