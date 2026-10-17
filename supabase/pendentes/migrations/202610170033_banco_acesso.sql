-- 202610170033_banco_acesso.sql   (Rodada 9, app de banco)
--
-- OBJETIVO
--   "BancoAcesso": acesso do banco de reservas (tablet/celular) a UMA partida e UMA equipe, por link com token.
--   O banco guarda SÓ O HASH do token ("tokenHash", único); o token em claro nunca é gravado. Acesso expira
--   ("expiraEm") e pode ser revogado ("revogadoEm"). Escrita e leitura só pelo servidor (service_role).
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated.
--
-- PRÉ-REQUISITOS
--   Tabelas "Partida" e "Equipe" existentes (supabase/migrations). Nenhuma outra pendente é necessária.
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabela nova, nada existente é alterado).
--
-- BACKUP NECESSÁRIO
--   Nenhum agora (tabela nova). Depois do uso real, a tabela entra no backup normal; os hashes não revelam o token.
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos; lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170033_banco_acesso.sql (apaga os acessos emitidos; os links deixam de valer).

begin;
set local lock_timeout = '5s';

create table if not exists public."BancoAcesso" (
  id           uuid primary key default gen_random_uuid(),
  "partidaId"  integer not null references public."Partida"(id) on delete cascade,
  "equipeId"   integer not null references public."Equipe"(id) on delete cascade,
  "tokenHash"  text not null check (char_length("tokenHash") between 32 and 128),
  "criadoPor"  text,
  "criadoEm"   timestamptz not null default now(),
  "expiraEm"   timestamptz not null,
  "revogadoEm" timestamptz,
  constraint "BancoAcesso_tokenHash_key" unique ("tokenHash"),
  constraint "BancoAcesso_expira_chk" check ("expiraEm" > "criadoEm")
);
create index if not exists "BancoAcesso_partidaId_equipeId_idx"
  on public."BancoAcesso" ("partidaId", "equipeId");

alter table public."BancoAcesso" enable row level security;
revoke all on table public."BancoAcesso" from public, anon, authenticated;
grant select, insert, update, delete on table public."BancoAcesso" to service_role;

commit;
