-- Reversão de 202610170035. Apaga o histórico de pedidos do banco (tempo, substituição, desafio).
begin;
set local lock_timeout = '5s';
drop table if exists public."PedidoBanco";
commit;
