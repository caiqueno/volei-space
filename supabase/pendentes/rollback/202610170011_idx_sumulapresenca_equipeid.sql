-- Reversao de 202610170011_idx_sumulapresenca_equipeid.sql
-- Sem begin/commit (DROP INDEX CONCURRENTLY nao roda em transacao). Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170011

-- NO-OP DE PROPOSITO: o indice "SumulaPresenca_equipeId_idx" pertence a
-- supabase/migrations/202610090002_indices_chaves_estrangeiras.sql (mesmo nome). Um DROP aqui
-- removeria o indice da migration oficial. Para remover o indice, reverta a migration oficial.
select 1;
