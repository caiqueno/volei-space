-- Reversão de 202610170002_liga_pagamento_origem.sql
-- Efeito: remove a coluna e a marca de origem do pagamento. Perde a informação
-- gravada depois da migration. Antes: reverter o código do B5 que grava a coluna.
-- Depois de reverter: supabase migration repair --status reverted 202610170002

begin;
set local lock_timeout = '5s';
alter table public."Liga" drop constraint if exists "Liga_pagamentoOrigem_check";
alter table public."Liga" drop column if exists "pagamentoOrigem";
commit;
