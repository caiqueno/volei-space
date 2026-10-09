-- Árbitro criado pelo organizador: vínculo da organização e senha temporária.

alter table "CandidaturaArbitro"
  add column if not exists "organizadorId" text;

alter table "CandidaturaArbitro"
  add column if not exists "trocarSenha" boolean not null default false;

create index if not exists "CandidaturaArbitro_organizadorId_idx"
  on "CandidaturaArbitro" ("organizadorId");

notify pgrst, 'reload schema';
