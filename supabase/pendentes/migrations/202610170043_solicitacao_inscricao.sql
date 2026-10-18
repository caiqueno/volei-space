-- 202610170043_solicitacao_inscricao.sql   (Rodada 14, Meu Time: solicitar participação em campeonato aberto)
--
-- OBJETIVO
--   O líder do time (Meu Time, "TimeClube") passa a ver os campeonatos abertos e a solicitar participação.
--   Cada categoria define se a inscrição é AUTOMATICA (fluxo atual: o líder cadastra a equipe direto) ou
--   com APROVACAO do organizador.
--   (a) "CategoriaCampeonato"."modoInscricao" text not null default 'AUTOMATICA'
--       CHECK in ('AUTOMATICA','APROVACAO'). ESCOLHA: na CATEGORIA, e não na "Liga", porque a inscrição
--       existente ("Inscricao", 0026) é por categoria (único por categoria + time) e a categoria já guarda
--       a configuração de inscrição ("inscricoesAbertas", "formularioInscricaoConfig"). Uma liga com várias
--       categorias pode ter categorias abertas e categorias com aprovação. O default mantém o
--       comportamento atual em todas as linhas existentes.
--       Observação: anon tem select em "CategoriaCampeonato" (202609220001); a coluna é pública
--       por natureza (o portal precisa mostrar "inscrição com aprovação") e não é dado pessoal.
--   (b) Tabela "SolicitacaoInscricao": pedido do líder (PENDENTE) decidido pelo organizador
--       (APROVADA/RECUSADA) ou cancelado pelo líder (CANCELADA). Ao aprovar, o servidor cria a
--       "Inscricao" e grava o id em "inscricaoId". Só uma solicitação PENDENTE por time e categoria
--       (índice único parcial); recusadas/canceladas ficam como histórico e o líder pode pedir de novo.
--   (c) Aviso ao organizador: nada a mudar em "Notificacao" (0039). Ela tem "usuarioId" text sem FK,
--       que serve também para o organizador (id de usuário do Supabase Auth em texto); o organizador usa
--       a MESMA tabela, com tipos novos de notificação definidos só no código (a coluna tipo não tem CHECK).
--
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--   O isolamento A x B (o organizador só decide solicitações das suas ligas) é do servidor: a rota deve
--   conferir "Liga".organizadorUuid / MembroOrganizador antes de decidir. "mensagem" e "motivoRecusa" são
--   texto livre: o servidor deve exibi-los só ao líder e ao organizador da liga.
--
-- PRÉ-REQUISITOS
--   * 202610170024 aplicada ("TimeClube" uuid);
--   * 202610170026 aplicada ("Inscricao" uuid; também exige "CategoriaCampeonato" única em (id, "ligaId"),
--     202609220001);
--   * 202610170039 (Notificacao) é recomendada para os avisos, mas esta migration não depende dela.
--   A migration aborta com mensagem clara se faltar "TimeClube", "Inscricao" ou "CategoriaCampeonato".
--
-- QUEBRA DE ROTAS
--   Nenhuma (coluna com default e tabela nova; nenhum código existente as usa). O portal passa a
--   poder ler "modoInscricao" por anon (select em CategoriaCampeonato), sem efeito em quem não a lê.
--
-- BACKUP NECESSÁRIO
--   Nenhum (aditiva). A coluna nova com default constante não reescreve a tabela.
--
-- JANELA SEGURA
--   Fora de rodada por prudência: add column e a FK composta pegam lock curto em "CategoriaCampeonato"
--   (lock_timeout 5 s; se estourar, nada é aplicado e se repete depois).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170043_solicitacao_inscricao.sql (drop da tabela e da coluna;
--   as solicitações gravadas se perdem; "Inscricao" e "CategoriaCampeonato" não são afetadas além da coluna).

begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."TimeClube"') is null then
    raise exception 'Aplique antes a 202610170024 (TimeClube)';
  end if;
  if to_regclass('public."Inscricao"') is null then
    raise exception 'Aplique antes a 202610170026 (Inscricao)';
  end if;
  if to_regclass('public."CategoriaCampeonato"') is null then
    raise exception 'Falta "CategoriaCampeonato" (202609220001)';
  end if;
end
$$;

alter table public."CategoriaCampeonato"
  add column if not exists "modoInscricao" text not null default 'AUTOMATICA';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."CategoriaCampeonato"'::regclass
      and conname = 'CategoriaCampeonato_modoInscricao_chk'
  ) then
    alter table public."CategoriaCampeonato"
      add constraint "CategoriaCampeonato_modoInscricao_chk"
      check ("modoInscricao" in ('AUTOMATICA', 'APROVACAO'));
  end if;
end
$$;

create table if not exists public."SolicitacaoInscricao" (
  id               uuid primary key default gen_random_uuid(),
  "timeId"         uuid not null references public."TimeClube"(id) on delete cascade,
  "categoriaId"    uuid not null,
  "ligaId"         integer not null,
  estado           text not null default 'PENDENTE'
                     check (estado in ('PENDENTE', 'APROVADA', 'RECUSADA', 'CANCELADA')),
  mensagem         text check (mensagem is null or char_length(mensagem) <= 500),
  "motivoRecusa"   text check ("motivoRecusa" is null or char_length("motivoRecusa") <= 500),
  "solicitadoPor"  text not null,
  "decididoPor"    text,
  "solicitadoEm"   timestamptz not null default now(),
  "decididoEm"     timestamptz,
  "inscricaoId"    uuid references public."Inscricao"(id) on delete set null,
  foreign key ("categoriaId", "ligaId")
    references public."CategoriaCampeonato"(id, "ligaId") on delete cascade,
  constraint "SolicitacaoInscricao_decidida_chk"
    check (estado not in ('APROVADA', 'RECUSADA') or "decididoEm" is not null)
);

create unique index if not exists "SolicitacaoInscricao_pendente_key"
  on public."SolicitacaoInscricao" ("timeId", "categoriaId")
  where estado = 'PENDENTE';
create index if not exists "SolicitacaoInscricao_categoriaId_estado_idx"
  on public."SolicitacaoInscricao" ("categoriaId", estado);
create index if not exists "SolicitacaoInscricao_timeId_estado_idx"
  on public."SolicitacaoInscricao" ("timeId", estado);
create index if not exists "SolicitacaoInscricao_inscricaoId_idx"
  on public."SolicitacaoInscricao" ("inscricaoId") where "inscricaoId" is not null;

alter table public."SolicitacaoInscricao" enable row level security;
revoke all on table public."SolicitacaoInscricao" from public, anon, authenticated;
grant select, insert, update, delete on table public."SolicitacaoInscricao" to service_role;

commit;
