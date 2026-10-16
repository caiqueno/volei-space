-- Reversao de 202610170006_idx_equipe_liga_categoria.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170006

drop index concurrently if exists public."Equipe_ligaId_categoriaCampeonatoId_idx";
