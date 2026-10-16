-- Reversão de 202610170027. DESTRUTIVA para os dados novos: apaga "ComissaoTime" e o vínculo
-- "InscricaoComissao"."comissaoTimeId" (o snapshot nomeSnapshot/funcao da inscrição permanece).
begin;
set local lock_timeout = '5s';
drop index if exists public."InscricaoComissao_comissaoTimeId_idx";
alter table public."InscricaoComissao" drop column if exists "comissaoTimeId";
drop table if exists public."ComissaoTime";
commit;
