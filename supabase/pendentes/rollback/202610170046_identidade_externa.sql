-- Reversão de 202610170046. Remove "IdentidadeExterna" (os vínculos com o Google se perdem e são
-- refeitos no próximo login Google). Não toca contas.
begin;
set local lock_timeout = '5s';
drop table if exists public."IdentidadeExterna";
commit;
