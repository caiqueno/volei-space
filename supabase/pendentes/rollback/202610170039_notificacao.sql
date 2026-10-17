-- Reversão de 202610170039. Apaga as notificações.
begin;
set local lock_timeout = '5s';
drop table if exists public."Notificacao";
commit;
