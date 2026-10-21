-- Reversão de 202610170049. Remove os CHECKs e as colunas novas de "TimeClube" (cnpj, contatoEmail,
-- contatoTelefoneCifrado, corPrimaria, corSecundaria, escudoPath). Os dados gravados nelas se perdem; o
-- escudo no Storage e "escudoUrl" (0024) ficam intactos.
begin;
set local lock_timeout = '5s';
alter table public."TimeClube" drop constraint if exists "TimeClube_cnpj_chk";
alter table public."TimeClube" drop constraint if exists "TimeClube_contatoEmail_chk";
alter table public."TimeClube" drop constraint if exists "TimeClube_contatoTelefoneCifrado_chk";
alter table public."TimeClube" drop constraint if exists "TimeClube_corPrimaria_chk";
alter table public."TimeClube" drop constraint if exists "TimeClube_corSecundaria_chk";
alter table public."TimeClube" drop constraint if exists "TimeClube_escudoPath_chk";
alter table public."TimeClube" drop column if exists "cnpj";
alter table public."TimeClube" drop column if exists "contatoEmail";
alter table public."TimeClube" drop column if exists "contatoTelefoneCifrado";
alter table public."TimeClube" drop column if exists "corPrimaria";
alter table public."TimeClube" drop column if exists "corSecundaria";
alter table public."TimeClube" drop column if exists "escudoPath";
commit;
