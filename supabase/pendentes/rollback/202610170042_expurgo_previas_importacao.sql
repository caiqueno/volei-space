-- Reversão de 202610170042. Remove a função de expurgo (desagendar antes, se agendada). Não toca dados.
begin;
set local lock_timeout = '5s';
drop function if exists public.expurgar_previas_importacao();
commit;
