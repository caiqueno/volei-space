-- Bloqueia numeros de camisa duplicados entre atletas ativos da mesma equipe.
-- Rode primeiro a consulta de auditoria: se ela retornar linhas, corrija/remova
-- duplicados antes de criar o indice unico.

select
  "equipeId",
  numero,
  count(*) as total,
  array_agg(id order by id) as jogador_ids
from "Jogador"
where numero is not null
  and coalesce(banido, false) = false
group by "equipeId", numero
having count(*) > 1;

create unique index if not exists "Jogador_equipe_numero_ativo_unique"
  on "Jogador" ("equipeId", numero)
  where numero is not null
    and coalesce(banido, false) = false;
