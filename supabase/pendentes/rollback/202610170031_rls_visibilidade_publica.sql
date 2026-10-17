-- Reversão de 202610170031_rls_visibilidade_publica.sql
-- Efeito: devolve as expressões originais das policies públicas (sem filtro de visibilidade) e a
-- definição anterior da view jogador_publico. Competições PRIVADAS voltam a ser legíveis por anon
-- nas tabelas que ainda tiverem grant/policy (Liga, CategoriaCampeonato, Partida e filhas).
-- Antes: avisar os organizadores de competições PRIVADAS. Só altera policies que existem (idempotente);
-- não cria policy nova nem concede nada. Depois: supabase migration repair --status reverted 202610170031

begin;
set local lock_timeout = '5s';

do $r31$
declare
  alvo record;
begin
  for alvo in
    select * from (values
      ('Liga', 'luv_public_select_liga',
       $e$ "status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO') $e$),
      ('CategoriaCampeonato', 'categoria_publica', $e$ true $e$),
      ('Equipe', 'luv_public_select_equipe',
       $e$ exists (
             select 1 from public."Liga" l
             where l.id = "Equipe"."ligaId"
               and l."status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
           ) $e$),
      ('Partida', 'luv_public_select_partida',
       $e$ exists (
             select 1 from public."Liga" l
             where l.id = "Partida"."ligaId"
               and l."status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
           ) $e$),
      ('SetPartida', 'luv_public_select_set_partida',
       $e$ exists (
             select 1
             from public."Partida" p
             join public."Liga" l on l.id = p."ligaId"
             where p.id = "SetPartida"."partidaId"
               and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
           ) $e$),
      ('ClassificacaoEntrada', 'luv_public_select_classificacao',
       $e$ exists (
             select 1
             from public."Equipe" e
             join public."Liga" l on l.id = e."ligaId"
             where e.id = "ClassificacaoEntrada"."equipeId"
               and l."status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
           ) $e$),
      ('Premiacao', 'luv_public_select_premiacao',
       $e$ exists (
             select 1 from public."Liga" l
             where l.id = "Premiacao"."ligaId"
               and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
           ) $e$),
      ('Midia', 'luv_public_select_midia',
       $e$ exists (
             select 1 from public."Liga" l
             where l.id = "Midia"."ligaId"
               and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
           ) $e$),
      ('Mensagem', 'luv_public_select_mensagem_aprovada',
       $e$ aprovada = true
           and exists (
             select 1 from public."Liga" l
             where l.id = "Mensagem"."ligaId"
               and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
           ) $e$),
      ('DestaquesPartida', 'luv_public_select_destaques',
       $e$ exists (
             select 1
             from public."Partida" p
             join public."Liga" l on l.id = p."ligaId"
             where p.id = "DestaquesPartida"."partidaId"
               and p.status = 'ENCERRADA'
               and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
           ) $e$)
    ) as t(tabela, politica, expressao)
  loop
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = alvo.tabela and policyname = alvo.politica
    ) then
      execute format('alter policy %I on public.%I using (%s)', alvo.politica, alvo.tabela, alvo.expressao);
    end if;
  end loop;

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
      and coalesce(l.simulacao, false) = false;
  end if;
end
$r31$;

commit;
