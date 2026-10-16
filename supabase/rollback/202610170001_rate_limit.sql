-- Reversão de 202610170001_rate_limit.sql
-- Efeito: apaga o store do rate limit. O backend (B2) deve voltar ao store em
-- memória ANTES de rodar isto, senão o login passa a falhar ao consultar a tabela.
-- Perda de dados: só contadores temporários (sem valor histórico).
-- Registro da migration: depois de reverter, remover a linha da versão
-- 202610170001 de supabase_migrations.schema_migrations (supabase migration repair --status reverted 202610170001).

begin;
drop function if exists public.rate_limit_limpar();
drop function if exists public.rate_limit_hit(text, integer);
drop table if exists public."RateLimit";
commit;
