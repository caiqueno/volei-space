-- Reversão de 202610170038. Apaga os vínculos ClubeEquipe e a coluna donoUserId (perde o dono gravado).
-- NÃO derruba "Clube" (pertence à 0024).
begin;
set local lock_timeout = '5s';
drop table if exists public."ClubeEquipe";
drop index if exists public."Clube_donoUserId_idx";
alter table public."Clube" drop column if exists "donoUserId";
commit;
