-- Reversão de 202610170023_sumula_evento_append_only.sql
--
-- PERDE os eventos gravados em "SumulaEvento". Só reverter antes de existir evento real, ou com
-- backup da tabela (pg_dump -t '"SumulaEvento"'). O backend deve voltar ao fluxo antigo
-- (delete + insert em SetPartida/SumulaPresenca/OcorrenciaPartida) ANTES de rodar isto.
-- Os triggers de imutabilidade não impedem DROP TABLE.
-- Depois: supabase migration repair --status reverted 202610170023

begin;
set local lock_timeout = '5s';

drop function if exists public.purgar_eventos_simulacao(integer);
drop function if exists public.registrar_evento_sumula(
  integer, uuid, text, jsonb, text, text, smallint, integer, integer, bigint, timestamptz, integer
);
drop table if exists public."SumulaEvento";
drop function if exists public.sumula_evento_imutavel();

commit;
