-- Reversao de 202610170017_idx_candidaturaequipe_liga_status.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170017

drop index concurrently if exists public."CandidaturaEquipe_ligaId_status_idx";
