-- Reversão de 202610170047. Remove "PessoaPerfil" (os vínculos de perfil se perdem; as contas legadas
-- ficam intactas).
begin;
set local lock_timeout = '5s';
drop table if exists public."PessoaPerfil";
commit;
