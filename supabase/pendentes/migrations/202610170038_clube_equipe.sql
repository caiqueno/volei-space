-- 202610170038_clube_equipe.sql   (Rodada 10, Meu Time)
--
-- NÃO APLICAR: redundante com TimeClube.clubeId; mantida só como referência.
--   O backend não usa "ClubeEquipe" nem "Clube"."donoUserId". Fica fora da ordem de aplicação em preview.
--
-- OBJETIVO
--   Clube com várias equipes. "Clube" JÁ É CRIADA na 202610170024 (nome, criadoPor, criadoEm, ...), então
--   esta migration NÃO a recria: só acrescenta a coluna "donoUserId" text (nullable, sem FK, dono do clube;
--   sem backfill: o servidor preenche e trata NULL como "criadoPor") e cria "ClubeEquipe"
--   ("clubeId", "equipeId", unique) como vínculo explícito clube <-> equipe. "equipeId" referencia
--   "TimeClube" (0024). Atenção: "TimeClube"."clubeId" já liga cada time a um clube; "ClubeEquipe" permite
--   a relação N:N (ex.: time compartilhado). DECISÃO PENDENTE: se o produto só quiser 1:N, dispensar
--   esta tabela e usar "TimeClube"."clubeId".
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--
-- PRÉ-REQUISITOS
--   202610170024 aplicada ("Clube" e "TimeClube").
--
-- QUEBRA DE ROTAS
--   Nenhuma (coluna nullable e tabela nova; nada existente muda de comportamento).
--
-- BACKUP NECESSÁRIO
--   Nenhum (aditiva).
--
-- JANELA SEGURA
--   Qualquer horário. O add column em "Clube" é só de catálogo (nullable, sem default); lock_timeout de 5s.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170038_clube_equipe.sql (apaga "ClubeEquipe" e a coluna "donoUserId").

begin;
set local lock_timeout = '5s';

alter table public."Clube"
  add column if not exists "donoUserId" text;

create table if not exists public."ClubeEquipe" (
  id         uuid primary key default gen_random_uuid(),
  "clubeId"  uuid not null references public."Clube"(id) on delete cascade,
  "equipeId" uuid not null references public."TimeClube"(id) on delete cascade,
  "criadoEm" timestamptz not null default now(),
  constraint "ClubeEquipe_clubeId_equipeId_key" unique ("clubeId", "equipeId")
);
create index if not exists "ClubeEquipe_equipeId_idx" on public."ClubeEquipe" ("equipeId");
create index if not exists "Clube_donoUserId_idx" on public."Clube" ("donoUserId");

alter table public."ClubeEquipe" enable row level security;
revoke all on table public."ClubeEquipe" from public, anon, authenticated;
grant select, insert, update, delete on table public."ClubeEquipe" to service_role;

commit;
