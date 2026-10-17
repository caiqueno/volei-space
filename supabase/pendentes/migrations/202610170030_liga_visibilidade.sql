-- 202610170030_liga_visibilidade.sql
--
-- OBJETIVO
--   Competição privada (Rodada 6). Adiciona "Liga"."visibilidade" (text, not null,
--   default 'PUBLICA') com CHECK em ('PUBLICA','PRIVADA'). Competição PRIVADA só é
--   encontrada por link/código e exige convite para inscrever; o código lê a coluna
--   (src/lib/meu-time/convite.ts, src/lib/visibilidade-competicao.ts) e tolera a coluna ausente.
--
-- PRÉ-REQUISITOS
--   "Liga" existente. Nenhum outro.
--
-- QUEBRA DE ROTAS
--   Nenhuma. Todas as linhas existentes ficam 'PUBLICA' (default), como hoje. Sem grant
--   novo: a coluna herda os grants da tabela e nada é concedido a anon. O backfill é o
--   próprio default; não há UPDATE (um UPDATE em "Liga" dispararia os triggers de
--   bloqueio de campeonato FINALIZADO).
--
-- ATENÇÃO (RLS)
--   As policies luv_public_select_* de "Liga" não filtram por visibilidade. A ocultação
--   de competição PRIVADA nas listas é feita pelo servidor (service role). Se "Liga"
--   ainda for legível por anon, as linhas PRIVADAS também serão; decidir em passo
--   separado restringir a policy a visibilidade = 'PUBLICA'.
--
-- BACKUP NECESSÁRIO
--   Nenhum (só adiciona coluna).
--
-- JANELA SEGURA
--   Lock curto em "Liga" (ADD COLUMN com default constante é só catálogo no Postgres 11+;
--   o ADD CONSTRAINT varre a tabela, que é pequena). Evitar durante rodada por prudência.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170030_liga_visibilidade.sql

begin;
set local lock_timeout = '5s';

alter table public."Liga"
  add column if not exists "visibilidade" text not null default 'PUBLICA';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."Liga"'::regclass
      and conname = 'Liga_visibilidade_check'
  ) then
    alter table public."Liga"
      add constraint "Liga_visibilidade_check"
      check ("visibilidade" in ('PUBLICA', 'PRIVADA'));
  end if;
end
$$;

comment on column public."Liga"."visibilidade" is
  'PUBLICA (padrão): aparece nas listas. PRIVADA: só por link/código, exige convite para inscrever.';

commit;
