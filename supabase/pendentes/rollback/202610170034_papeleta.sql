-- Reversão de 202610170034. DESTRUTIVO: apaga as papeletas (prova da formação inicial). Exportar antes.
begin;
set local lock_timeout = '5s';
drop trigger if exists papeleta_imutavel_trg on public."Papeleta";
drop table if exists public."Papeleta";
drop function if exists public.papeleta_imutavel();
commit;
