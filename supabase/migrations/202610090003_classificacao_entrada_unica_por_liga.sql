-- A mesma equipe joga em mais de uma liga. A linha de classificação é
-- uma por (ligaId, equipeId), não uma global por equipeId.
--
-- 202609200010 já troca a unicidade nos bancos em que foi aplicada à mão.
-- Esta migration repete o passo de forma idempotente para o histórico que
-- a CLI passa a aplicar, e para o banco que ainda tiver a chave antiga.
--
-- Não apaga linha. Se existirem duas linhas com o mesmo (ligaId, equipeId),
-- o índice único falha e a transação desfaz a remoção da chave antiga.
-- ligaId nulo continua distinto: linhas órfãs antigas não são removidas.

alter table public."ClassificacaoEntrada"
  drop constraint if exists "ClassificacaoEntrada_equipeId_key";

drop index if exists public."ClassificacaoEntrada_equipeId_key";

create unique index if not exists "ClassificacaoEntrada_ligaId_equipeId_unique"
  on public."ClassificacaoEntrada" ("ligaId", "equipeId");
