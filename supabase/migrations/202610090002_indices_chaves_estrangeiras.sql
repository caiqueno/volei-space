-- Índices para chaves estrangeiras cuja coluna não era a primeira de
-- nenhum índice. CREATE INDEX IF NOT EXISTS não reescreve dados.
--
-- SetPartida.partidaId não ganha índice novo: a unicidade (partidaId, numero)
-- já indexa partidaId como primeira coluna.
-- Equipe.ligaId, Premiacao.ligaId, CandidaturaEquipe.ligaId e
-- ClassificacaoEntrada.ligaId também aparecem como prefixo de índices
-- compostos das migrations de categoria. O índice simples abaixo deixa a
-- busca pela chave explícita e não falha se o composto já existir.

create index if not exists "Equipe_ligaId_idx"
  on public."Equipe" ("ligaId");

create index if not exists "Jogador_equipeId_idx"
  on public."Jogador" ("equipeId");

create index if not exists "Partida_equipeAId_idx"
  on public."Partida" ("equipeAId");

create index if not exists "Partida_equipeBId_idx"
  on public."Partida" ("equipeBId");

create index if not exists "SumulaPresenca_jogadorId_idx"
  on public."SumulaPresenca" ("jogadorId");

create index if not exists "SumulaPresenca_equipeId_idx"
  on public."SumulaPresenca" ("equipeId");

create index if not exists "OcorrenciaPartida_partidaId_idx"
  on public."OcorrenciaPartida" ("partidaId");

create index if not exists "OcorrenciaPartida_jogadorId_idx"
  on public."OcorrenciaPartida" ("jogadorId");

create index if not exists "DestaquesPartida_jogadorId_idx"
  on public."DestaquesPartida" ("jogadorId");

create index if not exists "EscalaArbitro_arbitroId_idx"
  on public."EscalaArbitro" ("arbitroId");

create index if not exists "Premiacao_ligaId_idx"
  on public."Premiacao" ("ligaId");

create index if not exists "Midia_ligaId_idx"
  on public."Midia" ("ligaId");

create index if not exists "Mensagem_ligaId_idx"
  on public."Mensagem" ("ligaId");

create index if not exists "CandidaturaEquipe_ligaId_idx"
  on public."CandidaturaEquipe" ("ligaId");

create index if not exists "ClassificacaoEntrada_ligaId_idx"
  on public."ClassificacaoEntrada" ("ligaId");

create index if not exists "ClassificacaoEntrada_equipeId_idx"
  on public."ClassificacaoEntrada" ("equipeId");

create index if not exists "ConviteEquipe_candidaturaEquipeId_idx"
  on public."ConviteEquipe" ("candidaturaEquipeId");

create index if not exists "CandidaturaQuadra_ligaId_idx"
  on public."CandidaturaQuadra" ("ligaId");

create index if not exists "CategoriaConfiguracao_ligaId_idx"
  on public."CategoriaConfiguracao" ("ligaId");

create index if not exists "CategoriaSetupSecao_ligaId_idx"
  on public."CategoriaSetupSecao" ("ligaId");

create index if not exists "ConviteVagaEquipe_equipeId_idx"
  on public."ConviteVagaEquipe" ("equipeId");

create index if not exists "CategoriaReplicacaoAuditoria_ligaId_idx"
  on public."CategoriaReplicacaoAuditoria" ("ligaId");

create index if not exists "CategoriaReplicacaoAuditoria_origemCategoriaId_idx"
  on public."CategoriaReplicacaoAuditoria" ("origemCategoriaId");

create index if not exists "CategoriaReplicacaoAuditoria_destinoCategoriaId_idx"
  on public."CategoriaReplicacaoAuditoria" ("destinoCategoriaId");
