-- Reversao de 202610170009_idx_partida_liga_categoria_status_datahora.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170009

drop index concurrently if exists public."Partida_ligaId_categoriaCampeonatoId_status_dataHora_idx";
