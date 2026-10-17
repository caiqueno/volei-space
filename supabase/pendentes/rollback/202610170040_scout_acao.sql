-- Reversão de 202610170040. Apaga todas as ações de scout (dado esportivo): só com backup.
begin;
set local lock_timeout = '5s';
drop table if exists public."ScoutAcao";
commit;
