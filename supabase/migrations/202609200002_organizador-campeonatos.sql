alter table "Liga"
  add column if not exists "organizadorId" text;

alter table "Liga"
  add column if not exists "quantidadeEquipes" integer,
  add column if not exists "formato" text;

alter table "Liga"
  add column if not exists "inscricoesAbertas" boolean default true,
  add column if not exists "categoriasConfig" text;

create index if not exists "Liga_organizadorId_idx"
  on "Liga" ("organizadorId");

alter table "Liga" disable row level security;

grant select, insert, update on table "Liga" to anon, authenticated;
grant usage, select on sequence "Liga_id_seq" to anon, authenticated;

alter table "InscricaoCampeonato" disable row level security;

grant select, insert, update on table "InscricaoCampeonato" to anon, authenticated;

alter table "Equipe" disable row level security;
alter table "Partida" disable row level security;
alter table "ClassificacaoEntrada" disable row level security;

grant select, insert, update on table "Equipe" to anon, authenticated;
grant select, insert, update on table "Partida" to anon, authenticated;
grant select, insert, update on table "ClassificacaoEntrada" to anon, authenticated;

grant usage, select on sequence "Equipe_id_seq" to anon, authenticated;
grant usage, select on sequence "Partida_id_seq" to anon, authenticated;
grant usage, select on sequence "ClassificacaoEntrada_id_seq" to anon, authenticated;
