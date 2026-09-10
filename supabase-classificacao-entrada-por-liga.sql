-- ClassificacaoEntrada hoje tem uma linha global por equipeId (unique(equipeId)).
-- Times que jogam em mais de uma liga ao mesmo tempo tinham sua linha sobrescrita
-- toda vez que a classificação de QUALQUER outra liga deles era recalculada.
-- Passa a existir uma linha por (ligaId, equipeId).

alter table "ClassificacaoEntrada"
  add column if not exists "ligaId" integer references "Liga"(id);

alter table "ClassificacaoEntrada"
  drop constraint if exists "ClassificacaoEntrada_equipeId_key";

create unique index if not exists "ClassificacaoEntrada_ligaId_equipeId_unique"
  on "ClassificacaoEntrada" ("ligaId", "equipeId");

-- Linhas antigas (ligaId nulo) ficam órfãs e inofensivas: nenhuma leitura nova
-- as encontra, já que todas passam a filtrar por ligaId.
