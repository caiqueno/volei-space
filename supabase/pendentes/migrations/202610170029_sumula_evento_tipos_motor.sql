-- 202610170029_sumula_evento_tipos_motor.sql   (Rodada 3)
--
-- OBJETIVO
--   Amplia o CHECK "SumulaEvento_tipo_check" para os tipos do motor (src/lib/regras-volei/eventos.ts,
--   interface PayloadPorTipo): SET_INICIADO, PONTO, RALLY_REPETIDO, SUBSTITUICAO, TEMPO, TROCA_LIBERO,
--   REDESIGNACAO_LIBERO, SANCAO, FALTA_POSICAO, FALTA_ROTACAO, TROCA_LADO, SET_ANULADO, INTERRUPCAO,
--   WO, EQUIPE_INCOMPLETA, OBSERVACAO, DISCREPANCIA_PAPELETA, CAPITAO_EM_JOGO, PROTESTO_ANUNCIADO,
--   PROTESTO_REGISTRADO, PROTESTO_DESISTIDO, DESFAZ. Os tipos da 0023 continuam aceitos (INICIO_SET, SAQUE,
--   LIBERO, DESAFIO, FIM_SET, FIM_PARTIDA, SNAPSHOT), para não invalidar linhas nem o backend atual.
--   Obs.: substituição excepcional NÃO é tipo próprio no motor: é SUBSTITUICAO com
--   payload.excepcional = true. SAQUE e FIM_SET não existem no motor (ficam só por compatibilidade).
--
--   A coluna "payload" (jsonb, objeto) guarda o detalhe de cada evento; o formato por tipo é o de
--   PayloadPorTipo (ex.: PONTO {equipe, sacador?}, SUBSTITUICAO {equipe, sai, entra, excepcional?,
--   motivo?}, SANCAO {equipe, membro, categoria, sancao, pontoParaAdversario, entreSets?}).
--   O banco só valida o tipo e que o payload é objeto; a validade do conteúdo é do motor.
--
-- PRÉ-REQUISITO: 202610170023. QUEBRA DE ROTAS: nenhuma (só alarga). O CHECK é inline na 0023, logo
--   o nome padrão é "SumulaEvento_tipo_check" (a verificar no banco real: select conname from
--   pg_constraint where conrelid = 'public."SumulaEvento"'::regclass). O trigger append-only bloqueia
--   UPDATE/DELETE/TRUNCATE, não DDL.
-- REVERSÃO: rollback/202610170029_sumula_evento_tipos_motor.sql (recusa se houver tipo novo gravado).

begin;
set local lock_timeout = '5s';

alter table public."SumulaEvento" drop constraint if exists "SumulaEvento_tipo_check";
alter table public."SumulaEvento"
  add constraint "SumulaEvento_tipo_check" check (tipo in (
    'INICIO_SET', 'SET_INICIADO', 'PONTO', 'SAQUE', 'RALLY_REPETIDO', 'SUBSTITUICAO', 'TEMPO',
    'TROCA_LIBERO', 'REDESIGNACAO_LIBERO', 'LIBERO', 'SANCAO', 'FALTA_POSICAO', 'FALTA_ROTACAO',
    'TROCA_LADO', 'SET_ANULADO', 'INTERRUPCAO', 'WO', 'EQUIPE_INCOMPLETA', 'OBSERVACAO', 'DESAFIO',
    'FIM_SET', 'FIM_PARTIDA', 'DESFAZ', 'SNAPSHOT',
    -- Rodada 3 do motor: papeleta, capitão em jogo e protesto (RG-FOR-006..009, RG-ELE-005, RG-PRO-001..003)
    'DISCREPANCIA_PAPELETA', 'CAPITAO_EM_JOGO', 'PROTESTO_ANUNCIADO', 'PROTESTO_REGISTRADO', 'PROTESTO_DESISTIDO',
    -- Rodada 8: pedido indevido de tempo/substituição (RG-TMP-003/005/006)
    'PEDIDO_INDEVIDO'));

comment on column public."SumulaEvento".payload is
  'Detalhe do evento (objeto jsonb). Formato por tipo: PayloadPorTipo em src/lib/regras-volei/eventos.ts.';

commit;
