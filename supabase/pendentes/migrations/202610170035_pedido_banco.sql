-- 202610170035_pedido_banco.sql   (Rodada 9, app de banco)
--
-- OBJETIVO
--   "PedidoBanco": pedidos feitos pelo banco da equipe durante a partida (TEMPO, SUBSTITUICAO, DESAFIO), com
--   "payload" jsonb por tipo e decisão do mesário/árbitro (estado PENDENTE, ACEITO, RECUSADO, CANCELADO;
--   "decididoEm", "decididoPor"). Índice por ("partidaId","estado") para a fila de pendentes. As regras do
--   pedido ficam no servidor; o banco só garante forma e consistência do estado.
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--
-- PRÉ-REQUISITOS
--   Tabelas "Partida" e "Equipe" existentes (supabase/migrations). Independe de 0033 e 0034.
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
--   supabase/pendentes/rollback/202610170035_pedido_banco.sql (apaga o histórico de pedidos).

begin;
set local lock_timeout = '5s';

create table if not exists public."PedidoBanco" (
  id            uuid primary key default gen_random_uuid(),
  "partidaId"   integer not null references public."Partida"(id) on delete cascade,
  "equipeId"    integer not null references public."Equipe"(id) on delete cascade,
  tipo          text not null check (tipo in ('TEMPO', 'SUBSTITUICAO', 'DESAFIO')),
  payload       jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  estado        text not null default 'PENDENTE' check (estado in ('PENDENTE', 'ACEITO', 'RECUSADO', 'CANCELADO')),
  "criadoEm"    timestamptz not null default now(),
  "decididoEm"  timestamptz,
  "decididoPor" text,
  constraint "PedidoBanco_decisao_chk" check (estado = 'PENDENTE' or "decididoEm" is not null)
);
create index if not exists "PedidoBanco_partidaId_estado_idx" on public."PedidoBanco" ("partidaId", estado);
create index if not exists "PedidoBanco_partidaId_equipeId_idx" on public."PedidoBanco" ("partidaId", "equipeId");

alter table public."PedidoBanco" enable row level security;
revoke all on table public."PedidoBanco" from public, anon, authenticated;
grant select, insert, update, delete on table public."PedidoBanco" to service_role;

commit;
