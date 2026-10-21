-- 202610170046_identidade_externa.sql   (Rodada 16, login com Google)
--
-- OBJETIVO
--   Tabela "IdentidadeExterna": liga o identificador estável do provedor ("subExterno", o "sub" do token
--   do Google) ao e-mail normalizado da pessoa. O e-mail pode mudar no Google; o "sub" não. Único por
--   (provedor, "subExterno"): uma identidade externa pertence a um só e-mail. Nenhum token, segredo ou
--   dado além de e-mail e "sub" é guardado. Por ora só 'GOOGLE' (CHECK); novo provedor exige migration.
--   Segurança: RLS ligada, sem policy, sem grant para anon/authenticated; só service_role.
--
-- PRÉ-REQUISITOS
--   Nenhum (tabela nova, sem FK: o vínculo com a conta legada é por e-mail, ver 0047).
--
-- QUEBRA DE ROTAS
--   Nenhuma (aditiva; nada lê a tabela até a rota de login Google entrar).
--
-- BACKUP NECESSÁRIO
--   Nenhum.
--
-- JANELA SEGURA
--   Qualquer horário (tabela nova, lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170046_identidade_externa.sql (apaga a tabela; quem entrou com
--   Google passa a entrar por código ou senha e o vínculo é refeito no próximo login Google).

begin;
set local lock_timeout = '5s';

create table if not exists public."IdentidadeExterna" (
  id                 uuid primary key default gen_random_uuid(),
  "emailNormalizado" text not null
                       check ("emailNormalizado" = lower(btrim("emailNormalizado"))
                              and char_length("emailNormalizado") between 3 and 320),
  provedor           text not null check (provedor in ('GOOGLE')),
  "subExterno"       text not null check (char_length("subExterno") between 1 and 255),
  "criadoEm"         timestamptz not null default now(),
  constraint "IdentidadeExterna_provedor_sub_key" unique (provedor, "subExterno")
);

create index if not exists "IdentidadeExterna_email_idx"
  on public."IdentidadeExterna" ("emailNormalizado");

alter table public."IdentidadeExterna" enable row level security;
revoke all on table public."IdentidadeExterna" from public, anon, authenticated;
grant select, insert, update, delete on table public."IdentidadeExterna" to service_role;

commit;
