-- 202610170009_idx_partida_liga_categoria_status_datahora.sql   (M6 do plano da Fase 0)
--
-- OBJETIVO
--   Indice para consultas quentes: Partida ("ligaId", "categoriaCampeonatoId", status, "dataHora").  Agenda, ao vivo e portal por categoria.
--
-- PRE-REQUISITOS
--   Q6/Q6b rodadas: se ja existir indice equivalente (mesmas colunas, na mesma ordem, ou um indice
--   que tenha estas colunas como prefixo), NAO aplicar; o "if not exists" so protege por nome.
--
-- QUEBRA DE ROTAS
--   Nenhuma (so cria indice).
--
-- BACKUP NECESSARIO
--   Nenhum.
--
-- JANELA SEGURA
--   Baixa carga, fora de rodada. CREATE INDEX CONCURRENTLY nao bloqueia escrita, mas consome IO/CPU.
--
-- EXECUCAO
--   Um unico comando, SEM begin/commit: CONCURRENTLY nao roda em transacao. Se o runner da CLI
--   embrulhar o arquivo em transacao (a verificar em preview), aplicar este comando pelo SQL Editor
--   ou psql e registrar com: supabase migration repair --status applied 202610170009
--   Se falhar no meio, o Postgres deixa um indice INVALID: ver docs/analise/16-plano-aplicacao-migrations.md
--   (secao M6) para detectar e refazer.
--
-- REVERSAO
--   supabase/pendentes/rollback/202610170009_idx_partida_liga_categoria_status_datahora.sql

create index concurrently if not exists "Partida_ligaId_categoriaCampeonatoId_status_dataHora_idx"
  on public."Partida" ("ligaId", "categoriaCampeonatoId", status, "dataHora");
