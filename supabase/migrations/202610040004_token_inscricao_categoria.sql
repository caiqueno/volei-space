alter table "CategoriaCampeonato"
  add column if not exists "tokenInscricao" text;

create unique index if not exists categoria_token_inscricao_unique
  on "CategoriaCampeonato" ("tokenInscricao")
  where "tokenInscricao" is not null;
