-- Reversao de 202610170010_idx_sumulapresenca_jogadorid.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170010

drop index concurrently if exists public."SumulaPresenca_jogadorId_idx";
