-- Reversao de 202610170011_idx_sumulapresenca_equipeid.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170011

drop index concurrently if exists public."SumulaPresenca_equipeId_idx";
