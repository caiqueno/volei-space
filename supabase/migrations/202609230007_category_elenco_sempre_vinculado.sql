-- Inscrição sempre vinculada ao elenco: a inscrição da equipe é o mesmo
-- formulário que cadastra os jogadores, nunca uma etapa opcional separada.
-- Normaliza qualquer CategoriaConfiguracao existente com
-- elencoCadastroDuranteInscricao=false e trava o valor no banco (defesa em
-- profundidade além da camada de aplicação em setup/inscricoes/route.ts e
-- category-replication.ts, que já param de aceitar/propagar false).
--
-- Não aplicada à produção junto com o restante das migrations de categoria
-- (202609220001..202609230006) — faz parte do mesmo lote ainda pendente de
-- ensaio contra dados de produção sanitizados antes da aplicação real.

update "CategoriaConfiguracao"
set "elencoCadastroDuranteInscricao" = true
where "elencoCadastroDuranteInscricao" = false;

alter table "CategoriaConfiguracao"
  add constraint "categoria_configuracao_elenco_sempre_vinculado"
  check ("elencoCadastroDuranteInscricao" = true);
