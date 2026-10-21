-- Reversão de 202610170052. Apaga os comentários de inscrição. Não toca "Inscricao".
begin;
set local lock_timeout = '5s';
drop table if exists public."ComentarioInscricao";
commit;
