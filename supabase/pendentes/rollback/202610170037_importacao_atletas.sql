-- Reversão de 202610170037. Apaga as prévias de importação (as ainda não confirmadas se perdem).
begin;
set local lock_timeout = '5s';
drop table if exists public."ImportacaoAtletas";
commit;
