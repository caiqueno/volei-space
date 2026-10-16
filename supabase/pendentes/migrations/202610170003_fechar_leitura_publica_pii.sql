-- 202610170003_fechar_leitura_publica_pii.sql   (M1 do plano da Fase 0)
--
-- OBJETIVO
--   Fechar a leitura/escrita pública de dados pessoais pelo PostgREST com a chave anon:
--   1. liga RLS em toda tabela ordinária de public que ainda não tem;
--   2. dropa as policies abertas public_read_* (using (true)) criadas em
--      supabase-producao-elenco-sumula-rls.sql:63-111, mais luv_public_select_jogador
--      e as duas policies abertas de CandidaturaOrganizador;
--   3. revoga tudo de anon/authenticated em Jogador, CandidaturaEquipe/Arbitro/Quadra/Organizador,
--      Pagamento, Admin, ContaPublico, Interessado, CodigoAcessoOrganizador, ConviteEquipe (+ Arbitro),
--      e também em Equipe e InscricaoCampeonato (gate da Fase 0: anon lê 0 linhas delas);
--   4. revoga INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER de anon/authenticated em TODAS as
--      tabelas de public e o uso das sequences (desfaz os grants de supabase-organizador-campeonatos.sql:15-34);
--   5. em Partida, restringe a leitura anon às colunas públicas (fora sumulaToken e sumulaTokenExpira);
--   6. cria a view public.jogador_publico (id, nome, numero, posicao, fotoUrl, equipeId) com
--      select para anon/authenticated, só jogadores não banidos de campeonatos
--      ATIVA/ENCERRADA/FINALIZADO (docs/analise/07, M1).
--   A migration termina com asserções: se anon ainda puder ler Jogador, Equipe, InscricaoCampeonato,
--   CandidaturaOrganizador ou Pagamento, ela aborta e desfaz tudo (é uma transação única).
--
-- PRÉ-REQUISITOS (todos obrigatórios; nada disso é verificado pela migration)
--   a. Consultas Q1, Q2, Q3, Q3b, Q3c, Q10 do PLANO (seção 5.1) rodadas e guardadas fora do
--      repositório (ponto de reversão das policies e grants).
--   b. SUPABASE_SERVICE_ROLE_KEY confirmada na Vercel (produção e preview).
--   c. O código que sai do client anon JÁ está em produção e estável por um ciclo (item 1 do 5.2).
--      Sem isso, as rotas abaixo passam a falhar assim que a migration roda.
--   d. Se a main já tiver 202610060004, 202610060005, 202610090001 e 202610100002 aplicadas (Q10),
--      esta migration é compatível: só repete revokes e acrescenta a view, as asserções e o
--      fechamento de Equipe/InscricaoCampeonato/Jogador/CandidaturaOrganizador.
--
-- QUEBRA DE ROTAS
--   Código que usa o client anon (src/lib/supabase.ts) e quebra, com a tabela que lê/escreve
--   (levantamento por grep nesta base; PLANO 5.3). Cada item deve migrar para supabaseAdmin
--   + checagem de sessão/dono ANTES desta migration:
--     src/app/api/equipes/route.ts ............. CategoriaCampeonato, Equipe, InscricaoCampeonato
--     src/app/api/equipes/[id]/route.ts ........ Equipe
--     src/app/api/jogadores/route.ts ........... Equipe, Jogador
--     src/app/api/jogadores/[id]/route.ts ...... Jogador
--     src/app/api/jogadores/qr/[token]/route.ts  Jogador
--     src/app/api/partidas/[id]/route.ts ....... Partida
--     src/app/api/partidas/[id]/aprovar/route.ts Partida
--     src/app/api/mensagens/route.ts e [id] .... Mensagem
--     src/app/api/ligas/route.ts ............... Equipe, Liga, LigaLocal
--     src/app/api/portal/ativos/route.ts ....... Liga, Partida
--     src/app/api/ping/route.ts ................ Equipe
--     src/app/api/auth/forgot-password/route.ts  Admin
--     src/app/api/auth/reset-password/route.ts . Admin
--     src/app/api/webhooks/infinitepay/route.ts  Arbitro, CandidaturaArbitro, CandidaturaEquipe, Equipe, Pagamento
--     (e as rotas classificacao e rankings citadas no PLANO 5.3; conferir com grep, não aparecem
--      com import direto do client anon nesta base)
--   Páginas e libs de servidor que importam o client anon:
--     src/app/admin/page.tsx (Equipe, Jogador, Partida)
--     src/app/campeonatos/page.tsx e campeonatos/[slug]/page.tsx (Liga, Partida, InscricaoCampeonato)
--     src/app/sitemap.ts (Equipe, Liga)   src/lib/portal-home.ts (InscricaoCampeonato, Liga, Mensagem, Premiacao)
--     src/utils/slug.ts (Equipe)
--     equipes/[slug]/page.tsx, jogos/page.tsx, fase-mata-mata/page.tsx e JogosPublicos.tsx só importam
--     isSupabaseConfigured; conferir se algum caminho ainda usa o client anon.
--   Uploads direto do navegador com o client anon NÃO são afetados por esta migration (são pelo M2):
--     capitao/page.tsx, cadastro/page.tsx, CandidateEditForm, GaleriaOrganizador, OrganizacaoForm,
--     InformacoesWizard, FormularioInscricaoRapida.
--   Realtime (postgres_changes) com a chave anon em Partida/SetPartida/ClassificacaoEntrada já está
--   fechado na main por 202610100002; aqui não é reaberto.
--
-- NÃO RESOLVIDO AQUI (anotado para decisão)
--   * Liga e Partida (colunas públicas) continuam legíveis por anon, só de campeonatos publicados
--     (policies luv_public_select_*), porque o gate da Fase 0 só exige 0 linhas de Jogador, Equipe e
--     InscricaoCampeonato. Se o código também sair do anon para Liga/Partida, revogar o select depois.
--   * A policy categoria_publica de CategoriaCampeonato (using (true)) expõe categorias removidas.
--   * A view jogador_publico usa os privilégios do dono (security definer implícito) de propósito:
--     é o único caminho público para Jogador. Mantê-la com lista fixa de colunas.
--
-- BACKUP NECESSÁRIO
--   Dump lógico do schema public (--schema-only) e o resultado de Q2/Q3 (policies e grants).
--   Confirmar backup diário/PITR do projeto. Nenhum dado de linha é alterado.
--
-- JANELA SEGURA
--   Madrugada de dia sem jogos, depois de o código estar estável por um ciclo. A migration é curta
--   (catálogo) mas pega lock breve em cada tabela; lock_timeout de 5 s aborta sem efeito se houver
--   transação longa (rodada em andamento).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170003_fechar_leitura_publica_pii.sql (parcial e deliberadamente NÃO
--   reabre Jogador nem as tabelas com senhaHash). Reversão fiel exige o dump de Q2/Q3.

begin;
set local lock_timeout = '5s';

-- 1) RLS ligada em todas as tabelas ordinárias de public (menos as de extensão).
do $m1$
declare
  t record;
begin
  for t in
    select c.oid::regclass as tabela
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('alter table %s enable row level security', t.tabela);
    raise notice 'RLS ligada em %', t.tabela;
  end loop;
end
$m1$;

-- 2) Policies abertas.
do $m1$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (
        policyname like 'public\_read\_%' escape '\'
        or policyname in (
          'luv_public_select_jogador',
          'Organizador consulta proprio cadastro',
          'Cadastro publico de organizador'
        )
      )
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    raise notice 'policy removida: %.% (%)', p.schemaname, p.tablename, p.policyname;
  end loop;
end
$m1$;

-- 3) Revoke total nas tabelas com dado pessoal, credencial ou pagamento.
do $m1$
declare
  nome text;
begin
  foreach nome in array array[
    'Jogador', 'Equipe', 'InscricaoCampeonato',
    'CandidaturaEquipe', 'CandidaturaArbitro', 'CandidaturaQuadra', 'CandidaturaOrganizador',
    'Pagamento', 'Admin', 'ContaPublico', 'Interessado', 'CodigoAcessoOrganizador',
    'ConviteEquipe', 'Arbitro'
  ] loop
    if to_regclass(format('public.%I', nome)) is not null then
      execute format('revoke all on table public.%I from public, anon, authenticated', nome);
    else
      raise notice 'tabela % nao existe neste banco (a verificar)', nome;
    end if;
  end loop;
end
$m1$;

-- 4) Nenhuma escrita anônima em nenhuma tabela, nem uso de sequences.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 5) Partida: anon só lê as colunas públicas. O token da súmula (credencial de escrita) sai.
do $m1$
declare
  colunas text;
begin
  if to_regclass('public."Partida"') is not null then
    select string_agg(format('%I', column_name), ', ' order by ordinal_position)
      into colunas
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'Partida'
      and column_name not in ('sumulaToken', 'sumulaTokenExpira');

    revoke select on table public."Partida" from anon, authenticated;
    execute format('grant select (%s) on table public."Partida" to anon, authenticated', colunas);
  end if;
end
$m1$;

-- 6) View pública mínima de jogadores.
--    Executa com os privilégios do dono (postgres) para poder ler "Jogador" depois do revoke.
--    Só expõe colunas não sensíveis, jogadores não banidos e campeonatos já em andamento ou encerrados.
create or replace view public.jogador_publico as
select
  j.id,
  j.nome,
  j.numero,
  j.posicao,
  j."fotoUrl",
  j."equipeId"
from public."Jogador" j
join public."Equipe" e on e.id = j."equipeId"
join public."Liga" l on l.id = e."ligaId"
where coalesce(j.banido, false) = false
  and l.status in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
  -- Rodada 2: campeonato de simulacao/privado nao entra na projecao publica (202609290002).
  and coalesce(l.simulacao, false) = false;

revoke all on table public.jogador_publico from public, anon, authenticated;
grant select on table public.jogador_publico to anon, authenticated;
grant select on table public.jogador_publico to service_role;

comment on view public.jogador_publico is
  'Projecao publica de Jogador: sem CPF, documento, nascimento, telefones, fotoRostoUrl, documentosUrls e qrCodeToken.';

-- 7) Asserções: aborta a transação se o objetivo não foi atingido.
do $m1$
declare
  nome text;
begin
  foreach nome in array array[
    'Jogador', 'Equipe', 'InscricaoCampeonato', 'CandidaturaEquipe', 'CandidaturaArbitro',
    'CandidaturaQuadra', 'CandidaturaOrganizador', 'Pagamento', 'Admin', 'ContaPublico',
    'Interessado', 'CodigoAcessoOrganizador', 'ConviteEquipe', 'Arbitro'
  ] loop
    if to_regclass(format('public.%I', nome)) is not null then
      if has_table_privilege('anon', format('public.%I', nome), 'SELECT')
         or has_table_privilege('authenticated', format('public.%I', nome), 'SELECT') then
        raise exception 'M1 incompleta: anon/authenticated ainda le public.%', nome;
      end if;
    end if;
  end loop;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and policyname like 'public\_read\_%' escape '\'
  ) then
    raise exception 'M1 incompleta: ainda existem policies public_read_*';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  ) then
    raise exception 'M1 incompleta: existe tabela de public sem RLS';
  end if;
end
$m1$;

commit;
