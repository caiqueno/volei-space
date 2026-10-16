-- Reversão de 202610170022_pagamento_valor_numeric_DESTRUTIVO.sql
--
-- DESTRUTIVO / PARCIAL: volta o tipo para double precision, mas NÃO recupera precisão perdida
-- (valores arredondados para 2 casas continuam arredondados). Se houve arredondamento aceito,
-- restaurar os valores originais a partir do backup (dump de "Pagamento" feito antes da migration).
-- Depois: supabase migration repair --status reverted 202610170022

begin;
set local lock_timeout = '5s';
alter table public."Pagamento"
  alter column valor type double precision using valor::double precision;
commit;
