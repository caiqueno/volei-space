-- Reversao de 202610170016_idx_premiacao_ligaid.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170016

drop index concurrently if exists public."Premiacao_ligaId_idx";
