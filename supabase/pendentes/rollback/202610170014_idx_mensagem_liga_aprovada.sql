-- Reversao de 202610170014_idx_mensagem_liga_aprovada.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170014

drop index concurrently if exists public."Mensagem_ligaId_aprovada_idx";
