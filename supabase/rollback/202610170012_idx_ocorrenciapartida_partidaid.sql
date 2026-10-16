-- Reversao de 202610170012_idx_ocorrenciapartida_partidaid.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170012

drop index concurrently if exists public."OcorrenciaPartida_partidaId_idx";
