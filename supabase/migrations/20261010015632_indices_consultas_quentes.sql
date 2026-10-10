-- Índices das consultas quentes de campeonato, equipe, atleta, partida e súmula.
-- Só CREATE INDEX IF NOT EXISTS. Não apaga linha, não remove índice e não
-- reescreve tabela. Não aplicar este arquivo na mão em produção a partir daqui.
--
-- Já cobertos, e por isso sem segundo índice:
--   SetPartida (partidaId, numero) — pontos do set; a unicidade já começa em partidaId.
--   SumulaPresenca (partidaId, jogadorId) — presença da partida; jogadorId e equipeId
--     já têm índice próprio em 202610090002.
--   DestaquesPartida (partidaId, tipo) — destaque da súmula.
--   Partida_categoria_fase_slot_key — unicidade do mata-mata quando a categoria
--     entra no filtro e a fase é eliminatória. Não serve ligaId + fase sem categoria.
--   Jogador_equipeId_idx e a unicidade (equipeId, chaveCadastro) — busca só pela equipe.
--     Os compostos abaixo acrescentam a ordenação que essa busca faz em seguida.

-- Vitrine pública: simulacao = false, ordenada por criação.
-- O índice antigo liga_simulacao_idx só cobre simulacao = true.
CREATE INDEX IF NOT EXISTS "Liga_publica_criadoEm_idx"
  ON public."Liga" ("criadoEm" DESC)
  WHERE simulacao = false;

-- A mesma vitrine com o filtro de status (EM_BREVE, ATIVA, ENCERRADA, FINALIZADO).
CREATE INDEX IF NOT EXISTS "Liga_publica_status_criadoEm_idx"
  ON public."Liga" (status, "criadoEm" DESC)
  WHERE simulacao = false;

-- Painel do organizador: campeonatos dele, do mais novo para o mais antigo.
-- Liga_organizadorId_idx filtra, mas não ordena criadoEm.
CREATE INDEX IF NOT EXISTS "Liga_organizadorId_criadoEm_idx"
  ON public."Liga" ("organizadorId", "criadoEm");

-- Lista de categorias do campeonato, na ordem da tela.
-- As unicidades (ligaId, codigo) e (ligaId, slug) não ordenam por ordem.
CREATE INDEX IF NOT EXISTS "CategoriaCampeonato_ligaId_ordem_idx"
  ON public."CategoriaCampeonato" ("ligaId", ordem);

-- Classificação e portal: equipes ativas do campeonato, em ordem de nome.
-- Equipe_ligaId_idx e Equipe_categoria_idx não trazem statusEquipe nem nome.
CREATE INDEX IF NOT EXISTS "Equipe_ligaId_statusEquipe_nome_idx"
  ON public."Equipe" ("ligaId", "statusEquipe", nome);

-- Chave estrangeira Equipe(id). Nas unicidades (ligaId, equipeId) e
-- (grupoId, equipeId), equipeId não é a primeira coluna, então o ON DELETE
-- da equipe varre a tabela.
CREATE INDEX IF NOT EXISTS "GrupoEquipeCampeonato_equipeId_idx"
  ON public."GrupoEquipeCampeonato" ("equipeId");

-- Elenco da equipe ordenado por número e nome (página pública e capitão).
-- O único (equipeId, numero) é parcial e deixa de fora número nulo e o nome.
CREATE INDEX IF NOT EXISTS "Jogador_equipeId_numero_nome_idx"
  ON public."Jogador" ("equipeId", numero, nome);

-- Rascunho de inscrição: atletas não banidos da equipe, na ordem de cadastro.
CREATE INDEX IF NOT EXISTS "Jogador_equipeId_banido_criadoEm_idx"
  ON public."Jogador" ("equipeId", banido, "criadoEm");

-- Chave estrangeira GrupoCampeonato(id). Partida_liga_grupo_idx começa em
-- ligaId, então grupoId sozinho (ON DELETE SET NULL e a FK composta que
-- abre com grupoId) não usa esse índice.
CREATE INDEX IF NOT EXISTS "Partida_grupoId_idx"
  ON public."Partida" ("grupoId");

-- Mata-mata e chave: partidas do campeonato numa fase e rodada.
-- Partida_liga_grupo_idx é (ligaId, grupoId, fase); fase não fica em segundo.
CREATE INDEX IF NOT EXISTS "Partida_ligaId_fase_rodada_idx"
  ON public."Partida" ("ligaId", fase, rodada);

-- Agenda do campeonato e jogos do organizador: status e horário.
CREATE INDEX IF NOT EXISTS "Partida_ligaId_status_dataHora_idx"
  ON public."Partida" ("ligaId", status, "dataHora");

-- /jogos, ao vivo e o painel admin filtram status e ordenam dataHora
-- sem campeonato na consulta.
CREATE INDEX IF NOT EXISTS "Partida_status_dataHora_idx"
  ON public."Partida" (status, "dataHora");

-- Lista da categoria/rodada: GET /api/partidas, estrutura e admin ordenam
-- rodada e, em seguida, dataHora. O índice (ligaId, categoria, serie, rodada)
-- só ordena rodada se categoria e série também estiverem no filtro.
CREATE INDEX IF NOT EXISTS "Partida_ligaId_rodada_dataHora_idx"
  ON public."Partida" ("ligaId", rodada, "dataHora");

-- Súmula: ponto, substituição e cartão ficam em OcorrenciaPartida com o set.
-- O índice simples de partidaId não agrupa o set.
CREATE INDEX IF NOT EXISTS "OcorrenciaPartida_partidaId_set_idx"
  ON public."OcorrenciaPartida" ("partidaId", "set");

-- Scouts e ranking: ocorrências da partida filtradas pelo tipo
-- (attack, block, ace, substitution).
CREATE INDEX IF NOT EXISTS "OcorrenciaPartida_partidaId_tipo_idx"
  ON public."OcorrenciaPartida" ("partidaId", tipo);
