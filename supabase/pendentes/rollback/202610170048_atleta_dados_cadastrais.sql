-- Reversão de 202610170048. Remove os CHECKs e as colunas novas ("fotoRostoPath", "fotoRostoEnviadaEm" em
-- "Atleta"; "documentoPath", "documentoEnviadoEm" em "AtletaDocumento"). Os caminhos gravados se perdem; os
-- arquivos no Storage ficam intactos. As colunas cifradas e "documentoTipo" são da 0025 e NÃO são removidas.
begin;
set local lock_timeout = '5s';
alter table public."Atleta" drop constraint if exists "Atleta_documentoTipo_chk";
alter table public."Atleta" drop constraint if exists "Atleta_fotoRostoPath_chk";
alter table public."AtletaDocumento" drop constraint if exists "AtletaDocumento_documentoPath_chk";
alter table public."AtletaDocumento" drop constraint if exists "AtletaDocumento_cpfCifrado_chk";
alter table public."AtletaDocumento" drop constraint if exists "AtletaDocumento_documentoNumeroCifrado_chk";
alter table public."AtletaDocumento" drop constraint if exists "AtletaDocumento_telefoneCifrado_chk";
alter table public."AtletaDocumento" drop constraint if exists "AtletaDocumento_telefoneEmergenciaCifrado_chk";
alter table public."Atleta" drop column if exists "fotoRostoPath";
alter table public."Atleta" drop column if exists "fotoRostoEnviadaEm";
alter table public."AtletaDocumento" drop column if exists "documentoPath";
alter table public."AtletaDocumento" drop column if exists "documentoEnviadoEm";
commit;
