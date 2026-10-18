-- Reversão de 202610170043. Remove "SolicitacaoInscricao" (as solicitações gravadas se perdem) e a coluna
-- "modoInscricao" de "CategoriaCampeonato" (as categorias voltam ao fluxo automático implícito).
-- Não toca "Inscricao", "TimeClube" nem "Notificacao".
begin;
set local lock_timeout = '5s';
drop table if exists public."SolicitacaoInscricao";
alter table public."CategoriaCampeonato" drop constraint if exists "CategoriaCampeonato_modoInscricao_chk";
alter table public."CategoriaCampeonato" drop column if exists "modoInscricao";
commit;
