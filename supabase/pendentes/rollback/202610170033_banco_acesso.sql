-- Reversão de 202610170033. Apaga os acessos do banco emitidos (links deixam de funcionar). Sem dado pessoal.
begin;
set local lock_timeout = '5s';
drop table if exists public."BancoAcesso";
commit;
