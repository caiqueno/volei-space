-- 202610170047_pessoa_perfil.sql   (Rodada 16, mesma pessoa com mais de um perfil)
--
-- OBJETIVO
--   Tabela "PessoaPerfil": liga um e-mail normalizado a cada perfil que a pessoa tem (LIDER ou
--   ORGANIZADOR), para ela trocar de perfil depois de entrar. "referenciaId" (text) guarda o id da conta
--   legada daquele perfil: LIDER = id de CandidaturaEquipe (ou ContaPublico), que é o "usuarioId" de
--   "MembroEquipe"; ORGANIZADOR = id de CandidaturaOrganizador (= "Organizador"."legadoId" = usuarioId de
--   "MembroOrganizador"). Sem FK de propósito (os ids vivem em tabelas legadas distintas).
--
--   POR QUE É NECESSÁRIA: hoje cada perfil é uma linha em tabela própria (CandidaturaEquipe,
--   CandidaturaArbitro, CandidaturaQuadra, CandidaturaOrganizador, ContaPublico) e o trigger
--   guard_unique_cadastro_contact (202609200003) BARRA o mesmo e-mail e telefone entre as quatro
--   tabelas de candidatura (DUPLICATE_CADASTRO_EMAIL). A resolução por e-mail em src/app/api/auth/route.ts
--   (findInTables) devolve o primeiro perfil achado. Logo, hoje uma pessoa não consegue ser líder e
--   organizador com o mesmo e-mail; esta tabela é o vínculo explícito. Ela NÃO remove o trigger: o
--   servidor deve gravar o perfil adicional aqui, apontando para a conta existente (ou o trigger precisa
--   ser ajustado em migration própria; decisão a confirmar com o dono).
--
--   Segurança: RLS ligada, sem policy, sem grant para anon/authenticated; só service_role. O servidor
--   deve listar perfis só do e-mail autenticado (isolamento entre pessoas e entre organizadores).
--
-- PRÉ-REQUISITOS
--   Nenhum (tabela nova, sem FK). Backfill (um registro por conta legada) fica fora desta migration.
--
-- QUEBRA DE ROTAS
--   Nenhuma (aditiva; nada lê a tabela até o seletor de perfil entrar).
--
-- BACKUP NECESSÁRIO
--   Nenhum.
--
-- JANELA SEGURA
--   Qualquer horário (tabela nova, lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170047_pessoa_perfil.sql (apaga a tabela; cada pessoa volta a ter
--   só o perfil achado pelo e-mail na conta legada).

begin;
set local lock_timeout = '5s';

create table if not exists public."PessoaPerfil" (
  id                 uuid primary key default gen_random_uuid(),
  "emailNormalizado" text not null
                       check ("emailNormalizado" = lower(btrim("emailNormalizado"))
                              and char_length("emailNormalizado") between 3 and 320),
  perfil             text not null check (perfil in ('LIDER', 'ORGANIZADOR')),
  "referenciaId"     text not null check (char_length("referenciaId") between 1 and 100),
  "criadoEm"         timestamptz not null default now(),
  constraint "PessoaPerfil_email_perfil_ref_key" unique ("emailNormalizado", perfil, "referenciaId")
);

create index if not exists "PessoaPerfil_perfil_referenciaId_idx"
  on public."PessoaPerfil" (perfil, "referenciaId");

alter table public."PessoaPerfil" enable row level security;
revoke all on table public."PessoaPerfil" from public, anon, authenticated;
grant select, insert, update, delete on table public."PessoaPerfil" to service_role;

commit;
