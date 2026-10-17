-- Reversão de 202610170041. Apaga o histórico de desafios por vídeo. Não toca "PedidoBanco".
begin;
set local lock_timeout = '5s';
drop table if exists public."DesafioVideo";
commit;
