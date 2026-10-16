-- 202610170002_liga_pagamento_origem.sql
--
-- OBJETIVO
--   Decisão D4b: manter a confirmação de pagamento simulada em produção, mas
--   marcada. Adiciona "Liga"."pagamentoOrigem" (text, nullable) com CHECK
--   ('simulado','gateway'). O PR B5 grava 'simulado' na rota
--   pagamento/confirmar e 'gateway' no webhook assinado.
--
-- PRÉ-REQUISITOS
--   "Liga" existente. Nenhum outro.
--
-- QUEBRA DE ROTAS
--   Nenhuma. Coluna nullable sem default; nenhum código atual a conhece.
--   Linhas antigas ficam NULL (origem desconhecida). NÃO há backfill aqui:
--   um UPDATE em "Liga" dispararia os triggers de bloqueio de campeonato
--   FINALIZADO. Se o produto quiser classificar o histórico, fazer em passo
--   separado e aprovado, tratando NULL com pagamentoConfirmadoEm preenchido
--   como "origem não registrada".
--
-- BACKUP NECESSÁRIO
--   Nenhum (só adiciona coluna).
--
-- JANELA SEGURA
--   Lock curto em "Liga" (ADD COLUMN sem default é só catálogo; o ADD CONSTRAINT
--   varre a tabela, que é pequena). Evitar durante rodada por prudência.
--
-- REVERSÃO
--   supabase/rollback/202610170002_liga_pagamento_origem.sql

begin;
set local lock_timeout = '5s';

alter table public."Liga"
  add column if not exists "pagamentoOrigem" text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."Liga"'::regclass
      and conname = 'Liga_pagamentoOrigem_check'
  ) then
    alter table public."Liga"
      add constraint "Liga_pagamentoOrigem_check"
      check ("pagamentoOrigem" is null or "pagamentoOrigem" in ('simulado', 'gateway'));
  end if;
end
$$;

comment on column public."Liga"."pagamentoOrigem" is
  'Origem da confirmação de pagamento: simulado (Pix de teste) ou gateway (webhook assinado). NULL = não registrada.';

commit;
