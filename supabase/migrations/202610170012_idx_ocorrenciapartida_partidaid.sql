-- 202610170012_idx_ocorrenciapartida_partidaid.sql   (M6 do plano da Fase 0)
--
-- OBJETIVO
--   Indice para consultas quentes: OcorrenciaPartida ("partidaId").  Hot path da sumula. Redundante se existir indice com prefixo partidaId (ex.: OcorrenciaPartida_partidaId_set_idx da main); conferir em Q6.
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
--   ou psql e registrar com: supabase migration repair --status applied 202610170012
--   Se falhar no meio, o Postgres deixa um indice INVALID: ver docs/analise/16-plano-aplicacao-migrations.md
--   (secao M6) para detectar e refazer.
--
-- REVERSAO
--   supabase/rollback/202610170012_idx_ocorrenciapartida_partidaid.sql

create index concurrently if not exists "OcorrenciaPartida_partidaId_idx"
  on public."OcorrenciaPartida" ("partidaId");
