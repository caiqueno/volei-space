-- 202610170041_desafio_video.sql   (Rodada 11, desafio por vídeo)
--
-- OBJETIVO
--   "DesafioVideo": pedido de revisão por vídeo de uma equipe em um set de uma partida de vôlei de quadra.
--   Estados: SOLICITADO (padrão), EM_ANALISE, MANTIDA, REVERTIDA, CANCELADO. Estados finais (MANTIDA, REVERTIDA,
--   CANCELADO) exigem "decididoEm" (CHECK "DesafioVideo_decisao_chk"). "motivo" e "linkVideo" são opcionais, até 500 caracteres.
--   "pedidoBancoId" liga o desafio ao pedido feito pelo banco (0035); se o pedido for apagado, vira null.
--   As regras (quantos desafios por set, quem decide) ficam no servidor; o banco só garante forma e consistência.
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--
-- PRÉ-REQUISITOS
--   Tabelas "Partida" e "Equipe" existentes (supabase/migrations) e "PedidoBanco" da 202610170035 aplicada
--   (a FK de "pedidoBancoId" aborta a migration se a 0035 faltar).
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabela nova, nada existente é alterado).
--
-- BACKUP NECESSÁRIO
--   Nenhum agora (tabela nova). Depois do uso real, a decisão do desafio é registro de jogo: manter no backup.
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos; lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170041_desafio_video.sql (apaga o histórico de desafios; não toca "PedidoBanco").

begin;
set local lock_timeout = '5s';

create table if not exists public."DesafioVideo" (
  id              uuid primary key default gen_random_uuid(),
  "partidaId"     integer not null references public."Partida"(id) on delete cascade,
  "setNumero"     integer not null check ("setNumero" between 1 and 5),
  "equipeId"      integer not null references public."Equipe"(id) on delete cascade,
  estado          text not null default 'SOLICITADO' check (estado in ('SOLICITADO', 'EM_ANALISE', 'MANTIDA', 'REVERTIDA', 'CANCELADO')),
  motivo          text check (motivo is null or char_length(motivo) <= 500),
  "linkVideo"     text check ("linkVideo" is null or char_length("linkVideo") <= 500),
  "pedidoBancoId" uuid references public."PedidoBanco"(id) on delete set null,
  "solicitadoEm"  timestamptz not null default now(),
  "decididoEm"    timestamptz,
  "decididoPor"   text,
  constraint "DesafioVideo_decisao_chk" check (estado not in ('MANTIDA', 'REVERTIDA', 'CANCELADO') or "decididoEm" is not null)
);
create index if not exists "DesafioVideo_partidaId_setNumero_equipeId_idx" on public."DesafioVideo" ("partidaId", "setNumero", "equipeId");

alter table public."DesafioVideo" enable row level security;
revoke all on table public."DesafioVideo" from public, anon, authenticated;
grant select, insert, update, delete on table public."DesafioVideo" to service_role;

commit;
