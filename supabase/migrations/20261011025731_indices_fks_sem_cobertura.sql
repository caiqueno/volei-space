-- Já aplicada em produção. Os nove CREATE INDEX IF NOT EXISTS abaixo não
-- recriam índice existente, não apagam dado e não são executados por esta entrega.
--
-- Índices das chaves estrangeiras que a produção mostrou sem cobertura.
-- Só CREATE INDEX IF NOT EXISTS. Não apaga linha, não altera coluna e não
-- reescreve tabela. Não aplicar este arquivo sem aprovação: o campeonato
-- ao vivo grava súmula nestas tabelas enquanto o índice é construído.
--
-- Sem CONCURRENTLY. O `supabase db push` e o `supabase migration up` aplicam
-- cada arquivo dentro de uma transação. O Postgres recusa
-- CREATE INDEX CONCURRENTLY nesse modo (SQLSTATE 25001). O índice comum
-- segura a escrita da tabela até terminar. Por isso este arquivo fica no
-- repositório e não entra agora. Quem for aplicá-lo depois, com aprovação,
-- escolhe uma janela sem súmula ao vivo ou roda o mesmo SQL com CONCURRENTLY
-- fora de transação e só então marca a versão como applied. Este arquivo
-- não faz nenhum dos dois.
--
-- Não se assume índice composto. Conferido no SQL versionado:
--   Partida_liga_grupo_idx e Partida_categoria_idx começam em ligaId, e o
--     único Partida_categoria_fase_slot_key é parcial (não cobre a FK).
--     A produção ainda viu Partida.ligaId sem índice. Os compostos de
--     20261010015632 não estão aplicados.
--   SetPartida (partidaId, numero), SumulaPresenca (partidaId, jogadorId),
--     EscalaArbitro (partidaId, cargo) e DestaquesPartida (partidaId, tipo)
--     existem no Prisma. Nenhum CREATE UNIQUE deste diretório os cria.
--     O comentário de 202610090002 que pulava SetPartida.partidaId partia
--     dessa unicidade. Ela não está no SQL.
--   ClassificacaoEntrada_categoria_idx e InscricaoCampeonato_categoria_idx
--     são (ligaId, categoriaCampeonatoId). categoriaCampeonatoId não é a
--     primeira coluna, então não cobre a FK que começa por ela.
--   InscricaoCampeonato_ligaId_equipeId_key começa em ligaId e não indexa
--     equipeId nem categoriaCampeonatoId. O @@index([equipeId]) do Prisma
--     não tem CREATE INDEX correspondente.

create index if not exists "Partida_ligaId_idx"
  on public."Partida" ("ligaId");

create index if not exists "SetPartida_partidaId_idx"
  on public."SetPartida" ("partidaId");

create index if not exists "SumulaPresenca_partidaId_idx"
  on public."SumulaPresenca" ("partidaId");

create index if not exists "EscalaArbitro_partidaId_idx"
  on public."EscalaArbitro" ("partidaId");

create index if not exists "DestaquesPartida_partidaId_idx"
  on public."DestaquesPartida" ("partidaId");

create index if not exists "ClassificacaoEntrada_categoriaCampeonatoId_idx"
  on public."ClassificacaoEntrada" ("categoriaCampeonatoId");

create index if not exists "InscricaoCampeonato_ligaId_idx"
  on public."InscricaoCampeonato" ("ligaId");

create index if not exists "InscricaoCampeonato_equipeId_idx"
  on public."InscricaoCampeonato" ("equipeId");

create index if not exists "InscricaoCampeonato_categoriaCampeonatoId_idx"
  on public."InscricaoCampeonato" ("categoriaCampeonatoId");
