-- 202610170037_importacao_atletas.sql   (Rodada 10, Meu Time)
--
-- OBJETIVO
--   "ImportacaoAtletas": guarda a PRÉVIA da planilha de atletas ("linhas" jsonb, com o resultado da
--   validação por linha) até o líder confirmar ou descartar. Estados RASCUNHO, CONFIRMADA, DESCARTADA.
--   "resumo" jsonb traz contagens (válidas, com aviso, rejeitadas). Atenção LGPD: as linhas contêm dados
--   pessoais; o servidor NÃO deve gravar CPF/telefone em claro (só cifrado ou omitido) e deve apagar
--   "linhas" das prévias CONFIRMADA/DESCARTADA após o prazo de retenção definido pelo jurídico (25).
--   "equipeId" referencia "TimeClube" (0024).
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--
-- PRÉ-REQUISITOS
--   202610170024 ("TimeClube") aplicada.
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabela nova, nada existente é alterado).
--
-- BACKUP NECESSÁRIO
--   Nenhum agora (tabela nova). Prévias são descartáveis; reavaliar se entrarem no backup (PII).
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos; lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170037_importacao_atletas.sql (perde prévias ainda não confirmadas).

begin;
set local lock_timeout = '5s';

create table if not exists public."ImportacaoAtletas" (
  id          uuid primary key default gen_random_uuid(),
  "equipeId"  uuid not null references public."TimeClube"(id) on delete cascade,
  "criadoPor" text not null check (char_length("criadoPor") between 1 and 100),
  "criadoEm"  timestamptz not null default now(),
  estado      text not null default 'RASCUNHO' check (estado in ('RASCUNHO', 'CONFIRMADA', 'DESCARTADA')),
  linhas      jsonb not null check (jsonb_typeof(linhas) = 'array'),
  resumo      jsonb check (resumo is null or jsonb_typeof(resumo) = 'object')
);
create index if not exists "ImportacaoAtletas_equipeId_estado_idx" on public."ImportacaoAtletas" ("equipeId", estado);

alter table public."ImportacaoAtletas" enable row level security;
revoke all on table public."ImportacaoAtletas" from public, anon, authenticated;
grant select, insert, update, delete on table public."ImportacaoAtletas" to service_role;

commit;
