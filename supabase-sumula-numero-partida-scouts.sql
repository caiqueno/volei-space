-- Permite registrar, por partida, um número de camisa diferente do cadastro
-- do atleta (numero de elenco), e atribuir cada ocorrência de scout ao
-- atleta (jogadorId) em vez de depender só do número exibido em tela.

alter table public."SumulaPresenca"
  add column if not exists numero integer;

alter table public."OcorrenciaPartida"
  add column if not exists "jogadorId" integer references public."Jogador"(id);
