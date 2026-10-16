-- Reversao de 202610170008_idx_partida_equipeb.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170008

drop index concurrently if exists public."Partida_equipeBId_idx";
