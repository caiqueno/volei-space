-- 202610170025_meu_time_atleta.sql   (M4, parte 1 de 2: Atleta, AtletaDocumento, VinculoAtletaClube)
--
-- OBJETIVO
--   Identidade única do atleta (independente de equipe/campeonato), com a PII isolada:
--   * "Atleta": nome, nascimento, sexo, foto, identidade única por hash de CPF (HMAC calculado no
--     servidor, nunca o CPF) ou por (documentoTipo, documentoHash). Nome + nascimento NUNCA unificam
--     sozinhos (a fusão é revisada por humano);
--   * "AtletaDocumento": toda a PII sensível em tabela própria, 1:1 com "Atleta", valores CIFRADOS no
--     aplicativo (bytea; a chave fica fora do banco), caminhos de documentos em bucket PRIVADO,
--     responsável legal e consentimento para menores (LGPD art. 14, relatório 13);
--   * "VinculoAtletaClube": o banco de atletas é do CLUBE (cada equipe usa os atletas que precisar).
--
--   Nenhuma tabela legada é alterada ("Jogador" não é tocado; ponte "Jogador" <-> "Atleta" e backfill
--   são etapa futura, em lotes, ver docs/analise/14 seção 3.7).
--
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--   Organizador nunca lê o banco completo do clube: o acesso por inscrição será via RPC/policy da
--   fase B (14, seção 3.5).
--
-- PRÉ-REQUISITOS
--   202610170024 aplicada ("Clube" é referenciada).
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabelas novas).
--
-- BACKUP NECESSÁRIO
--   Nenhum. Depois que houver dado real, "AtletaDocumento" entra no backup com acesso restrito.
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos). Preferir fora de rodada.
--
-- REVERSÃO
--   supabase/rollback/202610170025_meu_time_atleta.sql

begin;
set local lock_timeout = '5s';

create table if not exists public."Atleta" (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null check (char_length(btrim(nome)) between 1 and 200),
  "nomeNormalizado"  text generated always as (lower(btrim(nome))) stored,
  "dataNascimento"   date,
  sexo               text check (sexo in ('F', 'M')),
  "fotoUrl"          text,
  "cpfHash"          text,  -- HMAC-SHA256(pepper do servidor, só dígitos); nunca o CPF
  "documentoTipo"    text,
  "documentoHash"    text,
  origem             text not null default 'APP' check (origem in ('APP', 'CONVITE', 'MIGRACAO')),
  "usuarioId"        text unique,  -- atleta que reivindicou o próprio perfil (conta legada, sem FK)
  "mescladoParaId"   uuid references public."Atleta"(id),
  "mescladoEm"       timestamptz,
  "criadoPor"        text,
  "criadoEm"         timestamptz not null default now(),
  "atualizadoEm"     timestamptz not null default now(),
  constraint "Atleta_nascimento_obrigatorio_chk" check (origem = 'MIGRACAO' or "dataNascimento" is not null),
  constraint "Atleta_nascimento_faixa_chk" check ("dataNascimento" is null or "dataNascimento" >= date '1920-01-01'),
  constraint "Atleta_documento_par_chk" check (("documentoTipo" is null) = ("documentoHash" is null))
);
create unique index if not exists "Atleta_cpfHash_key"
  on public."Atleta" ("cpfHash") where "cpfHash" is not null and "mescladoParaId" is null;
create unique index if not exists "Atleta_documento_key"
  on public."Atleta" ("documentoTipo", "documentoHash")
  where "documentoHash" is not null and "mescladoParaId" is null;
create index if not exists "Atleta_nome_nascimento_idx"
  on public."Atleta" ("nomeNormalizado", "dataNascimento");

create table if not exists public."AtletaDocumento" (
  "atletaId"                   uuid primary key references public."Atleta"(id) on delete cascade,
  "cpfCifrado"                 bytea,
  "documentoNumeroCifrado"     bytea,
  "telefoneCifrado"            bytea,
  "telefoneEmergenciaCifrado"  bytea,
  "documentosPaths"            text[] not null default '{}',  -- caminhos no bucket PRIVADO atleta-arquivos
  "responsavelNome"            text,
  "responsavelContatoCifrado"  bytea,
  "consentimentoEm"            timestamptz,
  "consentimentoVersaoTermo"   text,
  "chaveVersao"                smallint not null default 1,
  "atualizadoEm"               timestamptz not null default now(),
  constraint "AtletaDocumento_consentimento_par_chk"
    check (("consentimentoEm" is null) = ("consentimentoVersaoTermo" is null))
);

create table if not exists public."VinculoAtletaClube" (
  id          uuid primary key default gen_random_uuid(),
  "clubeId"   uuid not null references public."Clube"(id) on delete cascade,
  "atletaId"  uuid not null references public."Atleta"(id),
  status      text not null default 'ATIVO' check (status in ('CONVIDADO', 'ATIVO', 'INATIVO')),
  desde       date not null default current_date,
  ate         date,
  "criadoEm"  timestamptz not null default now(),
  unique ("clubeId", "atletaId"),
  check (ate is null or ate >= desde)
);
create index if not exists "VinculoAtletaClube_atletaId_idx"
  on public."VinculoAtletaClube" ("atletaId");

do $m4$
declare
  nome text;
begin
  foreach nome in array array['Atleta', 'AtletaDocumento', 'VinculoAtletaClube'] loop
    execute format('alter table public.%I enable row level security', nome);
    execute format('revoke all on table public.%I from public, anon, authenticated', nome);
    execute format('grant select, insert, update, delete on table public.%I to service_role', nome);
  end loop;
end
$m4$;

commit;
