-- Reversão de 202610170030_liga_visibilidade.sql
-- Efeito: remove a coluna; competições PRIVADAS voltam a ser tratadas como públicas.
-- Antes: avisar os organizadores de competições PRIVADAS (elas passam a aparecer nas listas).
-- O código tolera a coluna ausente. Depois: supabase migration repair --status reverted 202610170030

begin;
set local lock_timeout = '5s';
alter table public."Liga" drop constraint if exists "Liga_visibilidade_check";
alter table public."Liga" drop column if exists "visibilidade";
commit;
