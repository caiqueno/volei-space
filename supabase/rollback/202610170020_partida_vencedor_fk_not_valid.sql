-- Reversão de 202610170020_partida_vencedor_fk_not_valid.sql
-- Remove a FK (também desfaz a validação de 021). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170020

begin;
set local lock_timeout = '5s';
alter table public."Partida" drop constraint if exists "Partida_vencedorId_fkey";
commit;
