-- Reversão de 202610170026_meu_time_inscricao.sql
-- Nota (R14c): NÃO remove a unique "CategoriaCampeonato_id_ligaId_key" criada pela 0026: é aditiva, inofensiva e a 0043 depende dela.
-- Apaga inscrições novas, listas de atletas, comissão e pedidos de troca que o app tiver gravado.
-- O fluxo legado ("InscricaoCampeonato", "Equipe", "Jogador") não é tocado. Se já houver dado real,
-- fazer dump das 5 tabelas antes.
-- Depois: supabase migration repair --status reverted 202610170026

begin;
set local lock_timeout = '5s';

drop table if exists public."PedidoTroca";
drop table if exists public."InscricaoComissao";
drop table if exists public."InscricaoAtleta";
drop table if exists public."Inscricao";
drop table if exists public."RegraElenco";
drop function if exists public.inscricao_propaga_estado();
drop function if exists public.inscricao_atleta_herda_estado();

commit;
