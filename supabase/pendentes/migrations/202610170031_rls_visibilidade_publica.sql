-- 202610170031_rls_visibilidade_publica.sql
--
-- OBJETIVO
--   Rodada 7. Competição PRIVADA ("Liga"."visibilidade" = 'PRIVADA', criada pela 0030) não pode
--   ser lida com a chave anon pelo PostgREST/Realtime. Hoje as policies públicas de SELECT só
--   olham o status da Liga e deixariam a privada visível. Esta migration REESCREVE (alter policy,
--   sem criar policy nova e sem alterar papéis) as policies públicas existentes para exigir
--   coalesce(visibilidade, 'PUBLICA') <> 'PRIVADA' (coalesce cobre linhas antigas/nulas):
--
--     tabela                  policy                              origem
--     "Liga"                  luv_public_select_liga              202609200021
--     "CategoriaCampeonato"   categoria_publica                   202609220001 (era using (true))
--     "Equipe"                luv_public_select_equipe            202609200021
--     "Partida"               luv_public_select_partida           202609200021 (colunas liberadas: ver 0003)
--     "ClassificacaoEntrada"  luv_public_select_classificacao     202609200021
--     "SetPartida"            luv_public_select_set_partida       202609200021
--     "Premiacao"             luv_public_select_premiacao         202609200021
--     "Midia"                 luv_public_select_midia             202609200021
--     "Mensagem"              luv_public_select_mensagem_aprovada 202609200021
--     "DestaquesPartida"      luv_public_select_destaques         202609200021
--
--   Cada tabela é avaliada pelo DDL real: se a policy NÃO existe no banco (por exemplo
--   SetPartida e ClassificacaoEntrada, cujas policies foram removidas de propósito por
--   202610100002), a migration NÃO a recria (apenas avisa); recriar reabriria a leitura.
--   "InscricaoCampeonato" não tem policy luv_public_*: a única policy de leitura pública era
--   public_read_inscricoes_campeonato (using (true)), removida pela 0003, que também revoga o
--   SELECT de anon nela e em Equipe. Sem policy e sem grant, nada a reescrever; a migration só
--   confere o estado.
--   Também refaz a VIEW public.jogador_publico (security definer implícito, criada pela 0003)
--   com o mesmo filtro, porque ela é o caminho público para Jogador e ignora a RLS de Liga.
--   Mesmas colunas e mesmo dono: os grants existentes são preservados e NENHUM grant é emitido.
--
--   O dono e o admin continuam acessando competição privada pelo service_role (ignora RLS), e a
--   competição privada continua acessível por slug/link pelas rotas do servidor.
--
-- PRÉ-REQUISITOS (a migration confere os dois e aborta sem efeito se faltarem)
--   a. 202610170030_liga_visibilidade.sql aplicada ("Liga"."visibilidade" existe).
--   b. 202610170003_fechar_leitura_publica_pii.sql aplicada: nenhuma policy public_read_* (using
--      (true)) pode restar nas tabelas acima, senão ela continuaria expondo a privada (policies
--      permissivas se somam com OR).
--   c. Código da Rodada 7 no ar: a competição privada só é lida pelo servidor (service_role).
--
-- QUEBRA DE ROTAS
--   Nenhuma esperada. Conferido por grep em src: o client anon (src/lib/supabase.ts) só é
--   importado por src/lib/use-banco-ao-vivo.ts (canal Realtime postgres_changes, que serve só de
--   aviso e a tela relê pelas APIs a cada 4 s) e por
--   src/components/inscricao-rapida/FormularioInscricaoRapida.tsx (somente supabase.storage).
--   scripts/anon-client-guard.test.ts trava qualquer novo importador em rota/lib de servidor.
--   Efeito colateral aceito: o Realtime deixa de avisar eventos de competição privada.
--   Quem lê "Liga"/"Partida"/etc. com a chave anon fora do repositório (BI, scripts) deixa de ver
--   competições privadas (comportamento desejado).
--
-- BACKUP NECESSÁRIO
--   Nenhum dado de linha é alterado. Guardar fora do repositório o resultado de
--     select schemaname, tablename, policyname, roles, cmd, qual
--     from pg_policies where schemaname = 'public' order by 2, 3;
--   e a definição atual da view (select pg_get_viewdef('public.jogador_publico'::regclass, true);).
--
-- JANELA SEGURA
--   Fora de rodada. Cada alter policy e o create or replace view pegam lock curto na tabela;
--   lock_timeout de 5 s aborta tudo sem efeito (transação única) se houver transação longa.
--
-- DESEMPENHO (policies com subconsulta)
--   As subconsultas são semi-joins por chave: "Liga".id (PK) para Equipe/Partida/Premiacao/Midia/
--   Mensagem/CategoriaCampeonato e Partida.id (PK) -> Liga.id para SetPartida/DestaquesPartida;
--   Equipe.id -> Liga.id para ClassificacaoEntrada. Só pagam o custo as leituras com anon/
--   authenticated (service_role ignora RLS). Pontos de atenção: Realtime avalia a RLS por evento e
--   por assinante; nas tabelas de dois níveis (SetPartida, DestaquesPartida, ClassificacaoEntrada)
--   a policy faz dois lookups por linha. Índices úteis (alguns já nas pendentes 0006 e 0009):
--   "Equipe"("ligaId"), "Partida"("ligaId", ...), "CategoriaCampeonato"("ligaId") já coberto por
--   unique("ligaId", codigo), "SetPartida"("partidaId"), "DestaquesPartida"("partidaId"). Não
--   criar índice em "Liga"."visibilidade" (duas classes, baixa seletividade).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170031_rls_visibilidade_publica.sql (devolve as expressões
--   originais; competições privadas voltam a ser legíveis por anon nas tabelas acima).

begin;
set local lock_timeout = '5s';

-- 0) Conferências de pré-requisito.
do $m31$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Liga' and column_name = 'visibilidade'
  ) then
    raise exception '0031 exige a 0030 (coluna "Liga"."visibilidade" ausente)';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in (
        'Liga', 'CategoriaCampeonato', 'Equipe', 'InscricaoCampeonato', 'Partida',
        'ClassificacaoEntrada', 'SetPartida', 'Premiacao', 'Midia', 'Mensagem', 'DestaquesPartida'
      )
      and policyname like 'public\_read\_%' escape '\'
  ) then
    raise exception '0031 exige a 0003: ainda existem policies public_read_* abertas nessas tabelas';
  end if;
end
$m31$;

-- 1) Reescreve as policies públicas existentes (alter policy preserva papéis e comando).
do $m31$
declare
  alvo record;
  achou integer := 0;
begin
  for alvo in
    select * from (values
      ('Liga', 'luv_public_select_liga',
       $e$ "status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
           and coalesce("visibilidade", 'PUBLICA') <> 'PRIVADA' $e$),
      ('CategoriaCampeonato', 'categoria_publica',
       $e$ exists (
             select 1 from public."Liga" l
             where l.id = "CategoriaCampeonato"."ligaId"
               and coalesce(l."visibilidade", 'PUBLICA') <> 'PRIVADA'
           ) $e$),
      ('Equipe', 'luv_public_select_equipe',
       $e$ exists (
             select 1 from public."Liga" l
             where l.id = "Equipe"."ligaId"
               and l."status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
               and coalesce(l."visibilidade", 'PUBLICA') <> 'PRIVADA'
           ) $e$),
      ('Partida', 'luv_public_select_partida',
       $e$ exists (
             select 1 from public."Liga" l
             where l.id = "Partida"."ligaId"
               and l."status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
               and coalesce(l."visibilidade", 'PUBLICA') <> 'PRIVADA'
           ) $e$),
      ('SetPartida', 'luv_public_select_set_partida',
       $e$ exists (
             select 1
             from public."Partida" p
             join public."Liga" l on l.id = p."ligaId"
             where p.id = "SetPartida"."partidaId"
               and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
               and coalesce(l."visibilidade", 'PUBLICA') <> 'PRIVADA'
           ) $e$),
      ('ClassificacaoEntrada', 'luv_public_select_classificacao',
       $e$ exists (
             select 1
             from public."Equipe" e
             join public."Liga" l on l.id = e."ligaId"
             where e.id = "ClassificacaoEntrada"."equipeId"
               and l."status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
               and coalesce(l."visibilidade", 'PUBLICA') <> 'PRIVADA'
           ) $e$),
      ('Premiacao', 'luv_public_select_premiacao',
       $e$ exists (
             select 1 from public."Liga" l
             where l.id = "Premiacao"."ligaId"
               and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
               and coalesce(l."visibilidade", 'PUBLICA') <> 'PRIVADA'
           ) $e$),
      ('Midia', 'luv_public_select_midia',
       $e$ exists (
             select 1 from public."Liga" l
             where l.id = "Midia"."ligaId"
               and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
               and coalesce(l."visibilidade", 'PUBLICA') <> 'PRIVADA'
           ) $e$),
      ('Mensagem', 'luv_public_select_mensagem_aprovada',
       $e$ aprovada = true
           and exists (
             select 1 from public."Liga" l
             where l.id = "Mensagem"."ligaId"
               and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
               and coalesce(l."visibilidade", 'PUBLICA') <> 'PRIVADA'
           ) $e$),
      ('DestaquesPartida', 'luv_public_select_destaques',
       $e$ exists (
             select 1
             from public."Partida" p
             join public."Liga" l on l.id = p."ligaId"
             where p.id = "DestaquesPartida"."partidaId"
               and p.status = 'ENCERRADA'
               and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
               and coalesce(l."visibilidade", 'PUBLICA') <> 'PRIVADA'
           ) $e$)
    ) as t(tabela, politica, expressao)
  loop
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = alvo.tabela and policyname = alvo.politica
    ) then
      execute format('alter policy %I on public.%I using (%s)', alvo.politica, alvo.tabela, alvo.expressao);
      achou := achou + 1;
      raise notice 'policy reescrita: %.% (%)', 'public', alvo.tabela, alvo.politica;
    else
      raise notice 'policy % de % nao existe (nada a reescrever; nao e recriada)', alvo.politica, alvo.tabela;
    end if;
  end loop;

  if achou = 0 then
    raise exception '0031: nenhuma policy publica encontrada; banco diferente do esperado (a verificar)';
  end if;
end
$m31$;

-- 2) View pública de jogadores: mesmo filtro. Mesmas colunas/dono; sem grant.
do $m31$
begin
  if to_regclass('public.jogador_publico') is not null then
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
      and coalesce(l.simulacao, false) = false
      and coalesce(l."visibilidade", 'PUBLICA') <> 'PRIVADA';
  else
    raise notice 'view jogador_publico nao existe (0003 nao aplicada; nada a refazer)';
  end if;
end
$m31$;

-- 3) Asserções: toda policy reescrita cita a visibilidade; anon não lê InscricaoCampeonato/Equipe.
do $m31$
declare
  p record;
begin
  for p in
    select tablename, policyname, qual from pg_policies
    where schemaname = 'public'
      and policyname in (
        'luv_public_select_liga', 'categoria_publica', 'luv_public_select_equipe',
        'luv_public_select_partida', 'luv_public_select_set_partida',
        'luv_public_select_classificacao', 'luv_public_select_premiacao', 'luv_public_select_midia',
        'luv_public_select_mensagem_aprovada', 'luv_public_select_destaques'
      )
  loop
    if p.qual is null or p.qual not like '%visibilidade%' then
      raise exception '0031 incompleta: policy % de % nao filtra visibilidade', p.policyname, p.tablename;
    end if;
  end loop;

  if to_regclass('public."InscricaoCampeonato"') is not null
     and has_table_privilege('anon', 'public."InscricaoCampeonato"', 'SELECT') then
    raise exception '0031 exige a 0003: anon ainda le "InscricaoCampeonato"';
  end if;
end
$m31$;

commit;
