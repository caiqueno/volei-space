-- Reversão de 202610170032. DESTRUTIVO: apaga os consentimentos registrados e a auditoria de pedidos de exclusão
-- (prova de aceite e de exclusão). Exportar as duas tabelas para guarda restrita antes de reverter.
begin;
set local lock_timeout = '5s';
drop table if exists public."AtletaExclusaoPedido";
drop table if exists public."AtletaConsentimento";
alter table public."Atleta" drop column if exists "anonimizadoEm";
commit;
