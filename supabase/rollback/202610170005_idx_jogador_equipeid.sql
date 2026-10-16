-- Reversao de 202610170005_idx_jogador_equipeid.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170005

drop index concurrently if exists public."Jogador_equipeId_idx";
