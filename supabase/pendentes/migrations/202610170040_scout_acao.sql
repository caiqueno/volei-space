-- 202610170040_scout_acao.sql   (Rodada 11, scout de quadra)
--
-- OBJETIVO
--   "ScoutAcao": uma ação de scout (fundamento + resultado) de uma equipe em um set de uma partida de vôlei de quadra.
--   Fundamentos: SAQUE, RECEPCAO, LEVANTAMENTO, ATAQUE, BLOQUEIO, DEFESA, CONTRA_ATAQUE.
--   Resultados: PONTO, ERRO, CONTINUA, NEUTRO. Zonas de quadra 1..9 (origem e destino) e rotação 1..6 são opcionais.
--   "placarA"/"placarB" guardam o placar no momento da ação (opcional). "jogadorId" é opcional (ação sem autor definido).
--   Idempotência do cliente: UNIQUE ("partidaId","clientEventId"); reenvio offline não duplica a ação.
--   Correção sem apagar: "anuladoEm" marca a ação como anulada; o histórico fica.
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--
-- PRÉ-REQUISITOS
--   Tabelas "Partida", "Equipe" e "Jogador" existentes (supabase/migrations). Independe das demais pendentes.
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabela nova, nada existente é alterado).
--
-- BACKUP NECESSÁRIO
--   Nenhum agora (tabela nova). Depois do uso real, o scout é dado esportivo da partida: manter no backup.
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos; lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170040_scout_acao.sql (apaga todas as ações de scout).

begin;
set local lock_timeout = '5s';

create table if not exists public."ScoutAcao" (
  id               bigint generated always as identity primary key,
  "partidaId"      integer not null references public."Partida"(id) on delete cascade,
  "setNumero"      integer not null check ("setNumero" between 1 and 5),
  "equipeId"       integer not null references public."Equipe"(id) on delete cascade,
  "jogadorId"      integer references public."Jogador"(id) on delete set null,
  fundamento       text not null check (fundamento in ('SAQUE', 'RECEPCAO', 'LEVANTAMENTO', 'ATAQUE', 'BLOQUEIO', 'DEFESA', 'CONTRA_ATAQUE')),
  resultado        text not null check (resultado in ('PONTO', 'ERRO', 'CONTINUA', 'NEUTRO')),
  "zonaOrigem"     smallint check ("zonaOrigem" between 1 and 9),
  "zonaDestino"    smallint check ("zonaDestino" between 1 and 9),
  rotacao          smallint check (rotacao between 1 and 6),
  "placarA"        integer check ("placarA" is null or "placarA" >= 0),
  "placarB"        integer check ("placarB" is null or "placarB" >= 0),
  "clientEventId"  text not null check (char_length("clientEventId") between 1 and 100),
  "criadoPor"      text,
  "criadoEm"       timestamptz not null default now(),
  "anuladoEm"      timestamptz,
  constraint "ScoutAcao_partidaId_clientEventId_key" unique ("partidaId", "clientEventId")
);
create index if not exists "ScoutAcao_partidaId_setNumero_idx" on public."ScoutAcao" ("partidaId", "setNumero");

alter table public."ScoutAcao" enable row level security;
revoke all on table public."ScoutAcao" from public, anon, authenticated;
grant select, insert, update, delete on table public."ScoutAcao" to service_role;

commit;
