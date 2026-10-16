-- 202610170022_pagamento_valor_numeric_DESTRUTIVO.sql   (M7, ALTER TYPE isolado)
--
-- ############################ DESTRUTIVO ############################
-- Reescreve a tabela "Pagamento" e converte "valor" de double precision para numeric(12,2).
-- Perde precisão além de 2 casas (o guard abaixo recusa a conversão se houver resto de centavos).
-- A reversão NÃO recupera precisão perdida. Exige backup comprovado e confirmação explícita.
-- ####################################################################
--
-- OBJETIVO
--   "Pagamento"."valor" é Float; dinheiro deve ser numeric(12,2) (docs/analise/07, "Outras lacunas").
--
-- PRÉ-REQUISITOS
--   a. Q8 rodada: tipo atual e maior resto de centavos. Se maior_resto_centavos > 0,001, o guard
--      desta migration aborta. Para aceitar arredondamento (decisão do dono), rodar a sessão com
--      `set app.aceita_arredondamento_pagamento = 'on';` antes de aplicar.
--   b. Nenhum pagamento em andamento (status AGUARDANDO) e webhook InfinitePay desativado (D4: 410).
--   c. Etapas 018 a 021 já aplicadas (não dependem, mas a ordem de risco é essa).
--   d. Código preparado para receber `valor` como STRING do driver (PostgREST/supabase-js devolve
--      numeric como número JSON em geral, mas confirmar): webhooks/infinitepay e
--      organizador/ligas/[id]/pagamento/confirmar. Comparações `===` com número devem usar Number().
--
-- QUEBRA DE ROTAS
--   api/webhooks/infinitepay/route.ts e api/organizador/ligas/[id]/pagamento/confirmar/route.ts
--   (leitura/escrita de valor); qualquer view ou função que use Pagamento.valor como float (Q11).
--
-- BACKUP NECESSÁRIO (obrigatório)
--   Dump de "Pagamento" e de "Partida" com contagem e checksum:
--     select count(*), sum(valor), md5(string_agg(id::text || valor::text, ',' order by id)) from "Pagamento";
--   guardados fora do repositório (a tabela guarda webhookPayload: não copiar conteúdo para arquivos).
--   Confirmar PITR/backup diário e, de preferência, restauração testada em preview.
--
-- JANELA SEGURA
--   ALTER TYPE com reescrita pega ACCESS EXCLUSIVE em "Pagamento" (tabela pequena). Fora de rodada e
--   sem cobrança em andamento. lock_timeout de 5 s.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170022_pagamento_valor_numeric_DESTRUTIVO.sql

begin;
set local lock_timeout = '5s';

do $m7$
declare
  tipo text;
  resto numeric;
begin
  select data_type into tipo
  from information_schema.columns
  where table_schema = 'public' and table_name = 'Pagamento' and column_name = 'valor';

  if tipo is null then
    raise exception 'Pagamento.valor nao existe neste banco (a verificar)';
  elsif tipo = 'numeric' then
    raise notice 'Pagamento.valor ja e numeric; nada a fazer';
    return;
  end if;

  select coalesce(max(abs(valor::numeric * 100 - round(valor::numeric * 100))), 0) into resto
  from public."Pagamento" where valor is not null;

  if resto > 0.001 and coalesce(current_setting('app.aceita_arredondamento_pagamento', true), '') <> 'on' then
    raise exception 'Pagamento.valor tem valores com mais de 2 casas (maior resto % centavo). Abortado.', resto;
  end if;

  alter table public."Pagamento"
    alter column valor type numeric(12, 2) using round(valor::numeric, 2);
end
$m7$;

commit;
