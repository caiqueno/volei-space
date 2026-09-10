-- Blocos 1 a 3 do relatório de testes MVP
-- Garante no banco que uma equipe não tenha dois atletas com o mesmo número.
-- Equipes diferentes continuam podendo reutilizar a mesma numeração.

create unique index if not exists "Jogador_equipeId_numero_key"
  on public."Jogador" ("equipeId", "numero")
  where "numero" is not null;
