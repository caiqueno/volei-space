-- Reversao de 202610170007_idx_partida_equipea.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170007

drop index concurrently if exists public."Partida_equipeAId_idx";
