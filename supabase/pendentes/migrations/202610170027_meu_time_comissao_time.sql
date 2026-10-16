-- 202610170027_meu_time_comissao_time.sql   (Rodada 3, Meu Time)
--
-- OBJETIVO
--   * Nova tabela "ComissaoTime": a comissão técnica DO TIME (nome e função que vão para a súmula).
--     Não confundir com "MembroEquipe" (contas com acesso ao Meu Time) nem com "InscricaoComissao"
--     (cópia/snapshot por inscrição).
--   * "InscricaoComissao"."comissaoTimeId": coluna nullable com FK para "ComissaoTime"
--     (on delete set null: o snapshot da inscrição sobrevive à remoção do membro do time).
--     Linhas existentes ficam com NULL; nada muda para quem já usa a tabela.
--   Segurança: RLS ligada, sem policy, sem nenhum privilégio para anon/authenticated; só service_role.
--
-- PRÉ-REQUISITOS: 202610170024 ("TimeClube") e 202610170026 ("InscricaoComissao") aplicadas.
-- QUEBRA DE ROTAS: nenhuma (aditiva). Idempotente.
-- REVERSÃO: supabase/pendentes/rollback/202610170027_meu_time_comissao_time.sql

begin;
set local lock_timeout = '5s';

create table if not exists public."ComissaoTime" (
  id          uuid primary key default gen_random_uuid(),
  "timeId"    uuid not null references public."TimeClube"(id) on delete cascade,
  nome        text not null check (char_length(btrim(nome)) between 1 and 200),
  funcao      text not null check (funcao in
                ('TECNICO', 'ASSISTENTE', 'PREPARADOR_FISICO', 'FISIOTERAPEUTA', 'MEDICO')),
  "criadoEm"  timestamptz not null default now()
);
create index if not exists "ComissaoTime_timeId_idx" on public."ComissaoTime" ("timeId");

alter table public."ComissaoTime" enable row level security;
revoke all on table public."ComissaoTime" from public, anon, authenticated;
grant select, insert, update, delete on table public."ComissaoTime" to service_role;

alter table public."InscricaoComissao"
  add column if not exists "comissaoTimeId" uuid references public."ComissaoTime"(id) on delete set null;
create index if not exists "InscricaoComissao_comissaoTimeId_idx"
  on public."InscricaoComissao" ("comissaoTimeId") where "comissaoTimeId" is not null;

commit;
