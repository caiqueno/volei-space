-- Reversão de 202610170024_meu_time_organizador_clube.sql
-- Tabelas novas: o drop apaga também os dados que o app tiver gravado nelas (inexistentes antes do
-- código de "Meu Time" entrar). Se já houver dados, fazer dump antes (pg_dump -t '"Clube"' ...).
-- Ordem inversa de dependência; depende de 202610170025/026 já terem sido revertidas.
-- Depois: supabase migration repair --status reverted 202610170024

begin;
set local lock_timeout = '5s';

alter table public."Liga" drop constraint if exists "Liga_organizadorUuid_fkey";
alter table public."Liga" drop column if exists "organizadorUuid";

drop table if exists public."MembroEquipe";
drop table if exists public."TimeClube";
drop table if exists public."Clube";
drop table if exists public."MembroOrganizador";
drop table if exists public."Organizador";

commit;
