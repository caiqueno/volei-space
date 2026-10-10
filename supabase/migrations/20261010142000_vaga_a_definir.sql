-- Vaga a definir no mata-mata: o jogo nasce com data, quadra e link do juiz
-- antes dos times. origemVagaA/origemVagaB guardam textos como
-- "1º Grupo A", "2º Grupo B", "Vencedor Semi 1" e "Perdedor Semi 2".
-- Quando a classificação fecha ou a semi termina, o aplicativo preenche
-- equipeAId/equipeBId nesta mesma linha.
-- Não apaga linha. Não concede a anon nem a authenticated. Não foi aplicada.
-- O código fica desligado enquanto estas colunas não existirem.

alter table public."Partida" alter column "equipeAId" drop not null;
alter table public."Partida" alter column "equipeBId" drop not null;

alter table public."Partida" add column if not exists "origemVagaA" text;
alter table public."Partida" add column if not exists "origemVagaB" text;

alter table public."Partida" drop constraint if exists "Partida_vaga_definida_check";
alter table public."Partida" add constraint "Partida_vaga_definida_check" check (
  ("equipeAId" is not null or nullif(btrim("origemVagaA"), '') is not null)
  and ("equipeBId" is not null or nullif(btrim("origemVagaB"), '') is not null)
);
