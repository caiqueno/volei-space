-- 202610170039_notificacao.sql   (Rodada 10, Meu Time)
--
-- OBJETIVO
--   "Notificacao": notificações internas por usuário (convite aceito, pendência de inscrição, etc.).
--   "destinatarioUserId" text sem FK (não existe tabela Usuario; ids legados são texto), "tipo" text,
--   "payload" jsonb objeto (sem PII em claro: só ids e códigos), "lidaEm" nulo = não lida. Índice por
--   ("destinatarioUserId", "lidaEm") para a contagem de não lidas.
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role; o servidor
--   filtra sempre pelo usuário autenticado.
--
-- PRÉ-REQUISITOS
--   Nenhum (tabela independente).
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabela nova, nada existente é alterado).
--
-- BACKUP NECESSÁRIO
--   Nenhum agora (tabela nova).
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos; lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170039_notificacao.sql (apaga as notificações).

begin;
set local lock_timeout = '5s';

create table if not exists public."Notificacao" (
  id                   uuid primary key default gen_random_uuid(),
  "destinatarioUserId" text not null check (char_length("destinatarioUserId") between 1 and 100),
  tipo                 text not null check (char_length(btrim(tipo)) between 1 and 80),
  payload              jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  "lidaEm"             timestamptz,
  "criadoEm"           timestamptz not null default now()
);
create index if not exists "Notificacao_destinatarioUserId_lidaEm_idx" on public."Notificacao" ("destinatarioUserId", "lidaEm");

alter table public."Notificacao" enable row level security;
revoke all on table public."Notificacao" from public, anon, authenticated;
grant select, insert, update, delete on table public."Notificacao" to service_role;

commit;
