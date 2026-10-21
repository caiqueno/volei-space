-- Reversão de 202610170053. Remove a função de expurgo (desagendar antes, se agendada) e as quatro
-- tabelas. Preferências, assinaturas push, histórico de entregas e controle de lembretes se perdem
-- (o usuário reativa o push e os lembretes voltam a ser calculados). Não toca "Notificacao".
begin;
set local lock_timeout = '5s';
drop function if exists public.expurgar_entregas_antigas();
drop table if exists public."NotificacaoEntrega";
drop table if exists public."LembreteEnviado";
drop table if exists public."PushAssinatura";
drop table if exists public."PreferenciaNotificacao";
commit;
