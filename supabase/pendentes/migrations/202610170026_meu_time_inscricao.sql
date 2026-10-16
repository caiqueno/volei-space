-- 202610170026_meu_time_inscricao.sql   (M4, parte 2 de 2: RegraElenco, Inscricao, InscricaoAtleta,
--                                        InscricaoComissao, PedidoTroca)
--
-- OBJETIVO
--   Inscrição por competição com CÓPIA própria da lista de atletas (PROMPT, "Inscrição"):
--   * "RegraElenco": regras de elenco por categoria (modelos FIVB/CBV/AMADOR_LIVRE/PERSONALIZADO),
--     1:1 com "CategoriaCampeonato";
--   * "Inscricao": inscrição AUTOMÁTICA (decisão do dono, Rodada 2: o líder cadastra a equipe direto,
--     sem análise do organizador). Status: RASCUNHO, CONFIRMADA, CONFIRMADA_COM_PENDENCIAS,
--     AJUSTE_PEDIDO (organizador pediu ajuste) e REMOVIDA. Unique por (categoria, time) apenas para
--     inscrições NÃO removidas; "avisos" (jsonb) guarda as pendências calculadas pelo servidor
--     (documento faltando, elenco fora do mínimo etc.); pontes opcionais para o legado ("Equipe",
--     "InscricaoCampeonato"), preenchidas na confirmação;
--   * "InscricaoAtleta": snapshot (nome, nascimento, número, capitão, líbero). Garantias de banco:
--     número único por inscrição, no máximo 1 capitão por inscrição, atleta em UM time por categoria
--     (índice parcial; o estado da inscrição é copiado para a linha por trigger, ver abaixo);
--   * "InscricaoComissao": comissão técnica da inscrição (snapshot, com limite aplicado pelo app);
--   * "PedidoTroca": depois do prazo, a troca de atleta vira pedido aprovado/recusado pelo organizador.
--
--   DECISÃO PENDENTE D-1 (14, seção 3.1): exclusividade do atleta por CATEGORIA (como aqui) ou por
--   campeonato inteiro. Para campeonato, trocar o índice "InscricaoAtleta_exclusividade_key" para
--   ("ligaId", "atletaId").
--   DECIDIDO (Rodada 2): inscrição direta, como no CLAUDE.md. Não existem estados de análise nem de
--   lista de espera. As colunas "decididaEm", "motivoDecisao" e "comentarioPendencia" mantêm o nome
--   por compatibilidade com o backend e passam a registrar a remoção ou o pedido de ajuste.
--
--   "InscricaoCampeonato" continua sendo o fluxo legado, intocado.
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--   Organizador A vs B: o isolamento ainda é do servidor; policies por organizador são fase B.
--
-- PRÉ-REQUISITOS
--   * 202610170024 e 202610170025 aplicadas ("TimeClube", "Atleta");
--   * "CategoriaCampeonato" com unique (id, "ligaId") (202609220001 aplicada: a verificar, D7 do
--     relatório 14; sem ela a migration falha na criação da tabela, o que é desejado);
--   * "Equipe", "InscricaoCampeonato" (id text) e "Jogador" existentes.
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabelas novas, sem código que as use).
--
-- BACKUP NECESSÁRIO
--   Nenhum (objetos novos; nenhuma tabela legada alterada).
--
-- JANELA SEGURA
--   Fora de rodada por prudência: as FKs para "Equipe", "Jogador" e "InscricaoCampeonato" pegam lock
--   curto (lock_timeout 5 s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170026_meu_time_inscricao.sql

begin;
set local lock_timeout = '5s';

create table if not exists public."RegraElenco" (
  "categoriaCampeonatoId"     uuid primary key,
  "ligaId"                    integer not null,
  modelo                      text check (modelo in ('FIVB', 'CBV', 'AMADOR_LIVRE', 'PERSONALIZADO')),
  "atletasMin"                smallint check ("atletasMin" is null or "atletasMin" > 0),
  "atletasMax"                smallint check ("atletasMax" is null or "atletasMax" > 0),
  "liberosMax"                smallint not null default 2 check ("liberosMax" between 0 and 6),
  "nascimentoDe"              date,
  "nascimentoAte"             date,
  "documentosExigidos"        text[] not null default '{}',
  "comissaoMax"               smallint check ("comissaoMax" is null or "comissaoMax" >= 0),
  "prazoTrocaEm"              timestamptz,
  "exigeConsentimentoMenor"   boolean not null default true,
  "criadoEm"                  timestamptz not null default now(),
  "atualizadoEm"              timestamptz not null default now(),
  foreign key ("categoriaCampeonatoId", "ligaId")
    references public."CategoriaCampeonato"(id, "ligaId") on delete cascade,
  check ("atletasMin" is null or "atletasMax" is null or "atletasMin" <= "atletasMax"),
  check ("nascimentoDe" is null or "nascimentoAte" is null or "nascimentoDe" <= "nascimentoAte")
);

create table if not exists public."Inscricao" (
  id                              uuid primary key default gen_random_uuid(),
  "ligaId"                        integer not null,
  "categoriaCampeonatoId"         uuid not null,
  "timeId"                        uuid not null references public."TimeClube"(id) on delete restrict,
  "equipeLegadoId"                integer references public."Equipe"(id) on delete set null,
  "inscricaoCampeonatoLegadoId"   text unique references public."InscricaoCampeonato"(id) on delete set null,
  status                          text not null default 'RASCUNHO' check (status in (
                                    'RASCUNHO', 'CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS',
                                    'AJUSTE_PEDIDO', 'REMOVIDA')),
  avisos                          jsonb not null default '[]'::jsonb
                                    check (jsonb_typeof(avisos) = 'array'),
  versao                          integer not null default 1 check (versao > 0),
  "enviadaEm"                     timestamptz,
  "decididaEm"                    timestamptz,
  "motivoDecisao"                 text,
  "comentarioPendencia"           text,
  "aceiteRegulamentoEm"           timestamptz,
  "aceiteRegulamentoVersao"       text,
  "aceitePor"                     text,
  "prazoEdicaoEm"                 timestamptz,
  "criadoPor"                     text,
  "criadoEm"                      timestamptz not null default now(),
  "atualizadoEm"                  timestamptz not null default now(),
  foreign key ("categoriaCampeonatoId", "ligaId")
    references public."CategoriaCampeonato"(id, "ligaId") on delete restrict,
  unique (id, "ligaId", "categoriaCampeonatoId"),
  constraint "Inscricao_aceite_par_chk"
    check (("aceiteRegulamentoEm" is null) = ("aceiteRegulamentoVersao" is null))
);

-- Idempotência: se a tabela já existir sem a coluna, acrescenta (o CHECK vai junto só em tabela nova).
alter table public."Inscricao"
  add column if not exists avisos jsonb not null default '[]'::jsonb;

create unique index if not exists "Inscricao_categoria_time_key"
  on public."Inscricao" ("categoriaCampeonatoId", "timeId")
  where status <> 'REMOVIDA';
create index if not exists "Inscricao_liga_status_idx" on public."Inscricao" ("ligaId", status);
create index if not exists "Inscricao_timeId_idx" on public."Inscricao" ("timeId");
create index if not exists "Inscricao_equipeLegadoId_idx"
  on public."Inscricao" ("equipeLegadoId") where "equipeLegadoId" is not null;

create table if not exists public."InscricaoAtleta" (
  id                         uuid primary key default gen_random_uuid(),
  "inscricaoId"              uuid not null,
  "ligaId"                   integer not null,
  "categoriaCampeonatoId"    uuid not null,
  "atletaId"                 uuid not null references public."Atleta"(id) on delete restrict,
  "jogadorLegadoId"          integer references public."Jogador"(id) on delete set null,
  "nomeSnapshot"             text not null,
  "dataNascimentoSnapshot"   date,
  numero                     smallint check (numero between 0 and 99),
  posicao                    text,
  capitao                    boolean not null default false,
  libero                     boolean not null default false,
  "documentosOk"             boolean not null default false,
  ativo                      boolean not null default true,       -- false = removido da lista
  "inscricaoAtiva"           boolean not null default true,       -- cópia de (Inscricao.status não recusada/cancelada)
  "adicionadoEm"             timestamptz not null default now(),
  "removidoEm"               timestamptz,
  foreign key ("inscricaoId", "ligaId", "categoriaCampeonatoId")
    references public."Inscricao"(id, "ligaId", "categoriaCampeonatoId") on delete cascade,
  check (not (capitao and libero))
);
-- Atleta em um único time por categoria (D-1). Só vale para linhas ativas de inscrições vivas.
create unique index if not exists "InscricaoAtleta_exclusividade_key"
  on public."InscricaoAtleta" ("categoriaCampeonatoId", "atletaId") where ativo and "inscricaoAtiva";
create unique index if not exists "InscricaoAtleta_numero_key"
  on public."InscricaoAtleta" ("inscricaoId", numero) where ativo and numero is not null;
create unique index if not exists "InscricaoAtleta_capitao_key"
  on public."InscricaoAtleta" ("inscricaoId") where ativo and capitao;
create index if not exists "InscricaoAtleta_inscricaoId_idx" on public."InscricaoAtleta" ("inscricaoId");
create index if not exists "InscricaoAtleta_atletaId_idx" on public."InscricaoAtleta" ("atletaId");
create index if not exists "InscricaoAtleta_jogadorLegadoId_idx"
  on public."InscricaoAtleta" ("jogadorLegadoId") where "jogadorLegadoId" is not null;

-- Copia o estado da inscrição para a linha do atleta (necessário ao índice parcial acima).
create or replace function public.inscricao_atleta_herda_estado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select status <> 'REMOVIDA' into new."inscricaoAtiva"
  from public."Inscricao" where id = new."inscricaoId";
  return new;
end;
$$;

drop trigger if exists "InscricaoAtleta_herda_estado" on public."InscricaoAtleta";
create trigger "InscricaoAtleta_herda_estado"
  before insert on public."InscricaoAtleta"
  for each row execute function public.inscricao_atleta_herda_estado();

create or replace function public.inscricao_propaga_estado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    update public."InscricaoAtleta"
    set "inscricaoAtiva" = (new.status <> 'REMOVIDA')
    where "inscricaoId" = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists "Inscricao_propaga_estado" on public."Inscricao";
create trigger "Inscricao_propaga_estado"
  after update of status on public."Inscricao"
  for each row execute function public.inscricao_propaga_estado();

create table if not exists public."InscricaoComissao" (
  id                uuid primary key default gen_random_uuid(),
  "inscricaoId"     uuid not null references public."Inscricao"(id) on delete cascade,
  "nomeSnapshot"    text not null,
  funcao            text not null check (funcao in
                      ('TECNICO', 'ASSISTENTE', 'PREPARADOR_FISICO', 'FISIOTERAPEUTA', 'MEDICO')),
  "noBanco"         boolean not null default true,
  "documentoRef"    text,  -- caminho em bucket privado, nunca o número em claro
  "criadoEm"        timestamptz not null default now()
);
create index if not exists "InscricaoComissao_inscricaoId_idx" on public."InscricaoComissao" ("inscricaoId");

create table if not exists public."PedidoTroca" (
  id                uuid primary key default gen_random_uuid(),
  "inscricaoId"     uuid not null references public."Inscricao"(id) on delete cascade,
  tipo              text not null check (tipo in ('ADICIONAR', 'REMOVER', 'SUBSTITUIR')),
  "atletaSaiId"     uuid references public."Atleta"(id),
  "atletaEntraId"   uuid references public."Atleta"(id),
  "numeroNovo"      smallint check ("numeroNovo" between 0 and 99),
  justificativa     text,
  status            text not null default 'PENDENTE'
                      check (status in ('PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO')),
  "solicitadoPor"   text,
  "solicitadoEm"    timestamptz not null default now(),
  "decididoPor"     text,
  "decididoEm"      timestamptz,
  "motivoDecisao"   text,
  check (tipo <> 'SUBSTITUIR' or ("atletaSaiId" is not null and "atletaEntraId" is not null)),
  check (tipo <> 'ADICIONAR' or "atletaEntraId" is not null),
  check (tipo <> 'REMOVER' or "atletaSaiId" is not null),
  check (status = 'PENDENTE' or "decididoEm" is not null or status = 'CANCELADO')
);
create index if not exists "PedidoTroca_inscricao_status_idx" on public."PedidoTroca" ("inscricaoId", status);
create index if not exists "PedidoTroca_atletaSaiId_idx"
  on public."PedidoTroca" ("atletaSaiId") where "atletaSaiId" is not null;
create index if not exists "PedidoTroca_atletaEntraId_idx"
  on public."PedidoTroca" ("atletaEntraId") where "atletaEntraId" is not null;

do $m4$
declare
  nome text;
begin
  foreach nome in array array[
    'RegraElenco', 'Inscricao', 'InscricaoAtleta', 'InscricaoComissao', 'PedidoTroca'
  ] loop
    execute format('alter table public.%I enable row level security', nome);
    execute format('revoke all on table public.%I from public, anon, authenticated', nome);
    execute format('grant select, insert, update, delete on table public.%I to service_role', nome);
  end loop;
end
$m4$;

-- Trigger functions: nada de EXECUTE para ninguém além do dono/service_role.
revoke all on function public.inscricao_atleta_herda_estado() from public, anon, authenticated;
revoke all on function public.inscricao_propaga_estado() from public, anon, authenticated;

commit;
