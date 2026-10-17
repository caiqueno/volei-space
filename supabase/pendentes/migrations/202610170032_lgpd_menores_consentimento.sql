-- 202610170032_lgpd_menores_consentimento.sql   (Rodada 8, LGPD de menores no Meu Time)
--
-- OBJETIVO
--   * "AtletaConsentimento": autorização do responsável legal de atleta menor de 18 anos. Uma linha por aceite
--     (histórico); só uma ativa (revogadoEm nulo) por atleta. Guarda a versão do termo aceita, quando e quem
--     registrou, o nome do responsável e o CONTATO CIFRADO no aplicativo (bytea; a chave fica fora do banco).
--     Substitui, para o fluxo novo, as colunas "responsavelNome", "responsavelContatoCifrado",
--     "consentimentoEm" e "consentimentoVersaoTermo" de "AtletaDocumento" (0025), que ficam sem uso.
--   * "AtletaExclusaoPedido": auditoria mínima dos pedidos de exclusão (quem, quando, motivo, escopo). Sem FK com
--     cascade e sem apagar com o atleta: a prova do pedido sobrevive à anonimização.
--   * "Atleta"."anonimizadoEm": marca quando a PII (cpf, documento, foto) foi anonimizada.
--
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--   ATENÇÃO: nome do responsável e contato são dados pessoais de terceiro. Retenção, base legal e texto do termo
--   dependem de validação jurídica (docs/analise/25-lgpd-menores.md).
--
-- PRÉ-REQUISITOS
--   202610170025 aplicada ("Atleta" é referenciada).
--
-- QUEBRA DE ROTAS
--   Nenhuma (objetos novos; a coluna nova é nullable). Sem esta migration a API trata todo menor como
--   "consentimento pendente" e o DELETE de atleta cai no comportamento antigo (só desativa o vínculo).
--
-- BACKUP NECESSÁRIO
--   Nenhum agora. Depois que houver dado real, as duas tabelas entram no backup com acesso restrito.
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170032_lgpd_menores_consentimento.sql

begin;
set local lock_timeout = '5s';

alter table public."Atleta" add column if not exists "anonimizadoEm" timestamptz;

create table if not exists public."AtletaConsentimento" (
  id                          uuid primary key default gen_random_uuid(),
  "atletaId"                  uuid not null references public."Atleta"(id),
  "versaoTermo"               text not null check (char_length(btrim("versaoTermo")) between 1 and 60),
  "aceitoEm"                  timestamptz not null default now(),
  "registradoPor"             text not null,
  "responsavelNome"           text check ("responsavelNome" is null or char_length(btrim("responsavelNome")) between 1 and 200),
  "responsavelContatoCifrado" bytea,  -- AES-256-GCM no aplicativo; nulo depois da anonimização
  "chaveVersao"               smallint not null default 1,
  "revogadoEm"                timestamptz,
  "revogadoPor"               text,
  "criadoEm"                  timestamptz not null default now(),
  constraint "AtletaConsentimento_revogacao_chk" check ("revogadoEm" is null or "revogadoEm" >= "aceitoEm")
);
create unique index if not exists "AtletaConsentimento_ativo_key"
  on public."AtletaConsentimento" ("atletaId") where "revogadoEm" is null;
create index if not exists "AtletaConsentimento_atletaId_idx"
  on public."AtletaConsentimento" ("atletaId");

create table if not exists public."AtletaExclusaoPedido" (
  id              uuid primary key default gen_random_uuid(),
  "atletaId"      uuid not null,  -- sem FK de propósito: o registro do pedido não depende do atleta
  "clubeId"       uuid,
  "solicitadoPor" text not null,
  "solicitadoEm"  timestamptz not null default now(),
  motivo          text check (motivo is null or char_length(motivo) <= 500),
  escopo          text not null check (escopo in ('ANONIMIZACAO', 'VINCULO')),
  "concluidoEm"   timestamptz
);
create index if not exists "AtletaExclusaoPedido_atletaId_idx"
  on public."AtletaExclusaoPedido" ("atletaId");

do $lgpd$
declare
  nome text;
begin
  foreach nome in array array['AtletaConsentimento', 'AtletaExclusaoPedido'] loop
    execute format('alter table public.%I enable row level security', nome);
    execute format('revoke all on table public.%I from public, anon, authenticated', nome);
    execute format('grant select, insert, update, delete on table public.%I to service_role', nome);
  end loop;
end
$lgpd$;

commit;
