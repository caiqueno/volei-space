-- Reversão de 202610170044. Remove a coluna "atletasEscolhidos" de "SolicitacaoInscricao" (a escolha dos atletas
-- das solicitações pendentes se perde; a aprovação volta a usar a seleção automática). Não toca "Inscricao".
begin;
set local lock_timeout = '5s';
alter table public."SolicitacaoInscricao" drop column if exists "atletasEscolhidos";
commit;
