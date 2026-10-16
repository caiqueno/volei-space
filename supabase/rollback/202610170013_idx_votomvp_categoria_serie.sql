-- Reversao de 202610170013_idx_votomvp_categoria_serie.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170013

drop index concurrently if exists public."VotoMVP_categoria_serie_idx";
