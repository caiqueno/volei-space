-- Reversão de 202610170025_meu_time_atleta.sql
-- Apaga as tabelas de atleta e a PII cifrada que o app tiver gravado nelas. Se houver dado real,
-- fazer dump antes e guardar com acesso restrito (contém dados de menores, cifrados).
-- Pré-condição: 202610170026 já revertida (InscricaoAtleta/PedidoTroca referenciam "Atleta").
-- Depois: supabase migration repair --status reverted 202610170025

begin;
set local lock_timeout = '5s';
drop table if exists public."VinculoAtletaClube";
drop table if exists public."AtletaDocumento";
drop table if exists public."Atleta";
commit;
