-- Reversão de 202610170019_checks_estado_validate.sql
-- O Postgres não "desvalida" uma constraint. Para voltar ao estado NOT VALID, derrubar e recriar.
-- Reaplicar 202610170018 depois do drop. Nenhuma perda de dado.
-- Depois: supabase migration repair --status reverted 202610170019

begin;
set local lock_timeout = '5s';
alter table public."Liga" drop constraint if exists liga_status_chk;
alter table public."Partida" drop constraint if exists partida_status_chk;
alter table public."InscricaoCampeonato" drop constraint if exists inscricao_campeonato_status_chk;
alter table public."Equipe" drop constraint if exists equipe_categoria_formato_chk;
alter table public."Equipe" drop constraint if exists equipe_serie_chk;
alter table public."Equipe" drop constraint if exists equipe_status_equipe_chk;
commit;
-- Em seguida, reaplicar o conteúdo de supabase/migrations/202610170018_checks_estado_not_valid.sql
