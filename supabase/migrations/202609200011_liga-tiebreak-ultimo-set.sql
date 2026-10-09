alter table "Liga"
  add column if not exists "tieBreakUltimoSet" boolean not null default false,
  add column if not exists "pontosUltimoSet" integer;
