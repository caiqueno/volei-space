-- 202610170019_checks_estado_validate.sql   (M7, etapa 2 de 4: VALIDATE dos CHECKs)
--
-- OBJETIVO
--   Valida as linhas antigas contra os CHECKs criados em 202610170018. VALIDATE CONSTRAINT pega só
--   SHARE UPDATE EXCLUSIVE (não bloqueia leitura nem escrita), mas varre a tabela.
--
-- PRÉ-REQUISITOS
--   a. 202610170018 aplicada.
--   b. Consulta de contagem de violações igual a zero para cada constraint (modelo no
--      docs/analise/16-plano-aplicacao-migrations.md, seção M7). Se houver violação, o VALIDATE falha
--      e a transação inteira volta sem efeito: corrigir os dados (com aprovação) ou ajustar a lista
--      de valores em 018 e repetir.
--
-- QUEBRA DE ROTAS
--   Nenhuma além das de 018.
--
-- BACKUP NECESSÁRIO
--   Nenhum (só leitura das linhas).
--
-- JANELA SEGURA
--   Baixa carga; evitar rodada (varre Partida e Equipe).
--
-- REVERSÃO
--   supabase/rollback/202610170019_checks_estado_validate.sql (não há "desvalidar": o rollback derruba
--   e recria como NOT VALID).

begin;
set local lock_timeout = '5s';

do $m7$
declare
  item record;
begin
  for item in
    select c.conrelid::regclass as tabela, c.conname
    from pg_constraint c
    where c.connamespace = 'public'::regnamespace
      and c.conname in (
        'liga_status_chk', 'partida_status_chk', 'inscricao_campeonato_status_chk',
        'equipe_categoria_formato_chk', 'equipe_serie_chk', 'equipe_status_equipe_chk'
      )
      and not c.convalidated
  loop
    execute format('alter table %s validate constraint %I', item.tabela, item.conname);
  end loop;
end
$m7$;

commit;
