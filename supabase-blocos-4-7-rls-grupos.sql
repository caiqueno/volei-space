-- Blocos 4 a 7 - ajuste incremental de seguranca para grupos do campeonato.
-- Rode este script se as tabelas GrupoCampeonato e GrupoEquipeCampeonato ja existem no Supabase.

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
