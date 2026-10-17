-- Reversão de 202610170036. Apaga os convites de atleta emitidos (links pendentes deixam de valer).
begin;
set local lock_timeout = '5s';
drop table if exists public."ConviteAtleta";
commit;
