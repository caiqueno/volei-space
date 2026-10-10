-- Liga RLS em cada tabela do schema public conhecida pelo Prisma e pelas
-- migrations. O ENABLE é idempotente. Tabela ausente neste ambiente é pulada
-- (to_regclass + ALTER TABLE IF EXISTS) para o arquivo não falhar.
--
-- O histórico anterior deixa nove tabelas sem RLS. Nos projetos Supabase o
-- QA ainda viu dezenas de tabelas sem RLS: vários ENABLE estão em arquivos
-- que o repair marcou como aplicados. Este arquivo repete o ENABLE em todas,
-- sem depender de 202610100002_fechar_leitura_publica_placar.sql e sem editá-la.
--
-- Historico anterior sem RLS:
-- CandidaturaArbitro
-- CandidaturaEquipe
-- CandidaturaPartidaArbitro
-- CandidaturaQuadra
-- ClassificacaoEliminatoria
-- CodigoAcessoOrganizador
-- ContaPublico
-- ConviteEquipe
-- Interessado
--
-- O navegador usa a chave publicável só no Realtime (useBancoAoVivo:
-- Partida, SetPartida, ClassificacaoEntrada) e em uploads de storage.
-- Leituras e escritas do produto passam por service_role, que ignora RLS.
-- Não há FORCE ROW LEVEL SECURITY e este arquivo não altera service_role.
--
-- Policy nova: só public_read_partidas, e só se ela ainda não existir, para
-- o SELECT de colunas de placar de Partida (202610060004, sem sumulaToken)
-- continuar valendo quando o RLS liga. SetPartida e ClassificacaoEntrada não
-- ganham policy: a migration 202610100002 é quem remove as policies USING
-- (true) delas. Aqui o anon e o authenticated perdem o privilégio de tabela
-- em tudo que não é Partida, então essa leitura não fica esperando a 002.
-- O GRANT de colunas de Partida não é revogado nem recriado.

do $rls$
declare
  tabela text;
  tabelas text[] := array[
    'AcessoArbitroEvento',
    'AcessoArbitroJogo',
    'Admin',
    'AdminAcaoHistorico',
    'Arbitro',
    'CandidaturaArbitro',
    'CandidaturaEquipe',
    'CandidaturaOrganizador',
    'CandidaturaPartidaArbitro',
    'CandidaturaQuadra',
    'CategoriaCampeonato',
    'CategoriaConfiguracao',
    'CategoriaReplicacaoAuditoria',
    'CategoriaSetupSecao',
    'ClassificacaoEliminatoria',
    'ClassificacaoEntrada',
    'CodigoAcessoOrganizador',
    'ContaPublico',
    'ConviteEquipe',
    'ConviteVagaEquipe',
    'DestaquesPartida',
    'Equipe',
    'EscalaArbitro',
    'GrupoCampeonato',
    'GrupoEquipeCampeonato',
    'InscricaoCampeonato',
    'InscricaoEquipeJogadorRascunho',
    'InscricaoEquipeRascunho',
    'Interessado',
    'Jogador',
    'Liga',
    'LigaLocal',
    'LigaSetupSecao',
    'LinkInscricaoCampeonato',
    'LinkInscricaoEvento',
    'Mensagem',
    'Midia',
    'OcorrenciaPartida',
    'Pagamento',
    'Partida',
    'Premiacao',
    'SetPartida',
    'SumulaPresenca',
    'SuspensaoAtleta',
    'VotoMVP'
  ];
  tem_anon boolean := exists (select 1 from pg_roles where rolname = 'anon');
  tem_authenticated boolean := exists (select 1 from pg_roles where rolname = 'authenticated');
begin
  foreach tabela in array tabelas loop
    if to_regclass(format('public.%I', tabela)) is null then
      continue;
    end if;
    execute format('alter table if exists public.%I enable row level security', tabela);
    execute format('revoke all on table public.%I from public', tabela);
    if tabela <> 'Partida' then
      if tem_anon then
        execute format('revoke all on table public.%I from anon', tabela);
      end if;
      if tem_authenticated then
        execute format('revoke all on table public.%I from authenticated', tabela);
      end if;
    end if;
  end loop;

  if to_regclass('public."Partida"') is not null
     and tem_anon
     and tem_authenticated
     and not exists (
       select 1 from pg_policies
       where schemaname = 'public'
         and tablename = 'Partida'
         and policyname = 'public_read_partidas'
     ) then
    create policy "public_read_partidas"
      on public."Partida"
      for select
      to anon, authenticated
      using (true);
  end if;
end
$rls$;
