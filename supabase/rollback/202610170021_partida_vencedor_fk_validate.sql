-- Reversão de 202610170021_partida_vencedor_fk_validate.sql
-- Não existe "desvalidar". Para voltar ao estado NOT VALID: derrubar e recriar a FK.
-- Nenhuma perda de dado. Depois: supabase migration repair --status reverted 202610170021

begin;
set local lock_timeout = '5s';
alter table public."Partida" drop constraint if exists "Partida_vencedorId_fkey";
alter table public."Partida"
  add constraint "Partida_vencedorId_fkey"
  foreign key ("vencedorId") references public."Equipe" (id) not valid;
commit;
