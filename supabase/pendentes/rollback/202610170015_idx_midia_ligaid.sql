-- Reversao de 202610170015_idx_midia_ligaid.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170015

drop index concurrently if exists public."Midia_ligaId_idx";
