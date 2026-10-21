-- Reversão de 202610170045. Remove a função de expurgo (desagendar antes, se agendada) e a tabela
-- "CodigoAcesso". Códigos em aberto se perdem (a pessoa pede outro). Não toca outras tabelas.
begin;
set local lock_timeout = '5s';
drop function if exists public.expurgar_codigos_acesso();
drop table if exists public."CodigoAcesso";
commit;
