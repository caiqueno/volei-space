-- recalculateLeagueClassification fazia ler tudo -> calcular em JS -> gravar tudo em
-- passos separados, sem trava nenhuma. Chamadas concorrentes (súmula sendo submetida
-- enquanto alguém abre /classificacao, ou duas súmulas seguidas) podiam se sobrepor, e
-- a execução mais lenta terminava depois e sobrescrevia o resultado da mais rápida com
-- dados incompletos. Move todo o cálculo para uma função atômica travada por liga.

create or replace function public.recalcular_classificacao_liga(p_liga_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(p_liga_id);

  with equipes as (
    select e.id as equipe_id,
           coalesce(e.categoria, 'GERAL') as categoria,
           coalesce(e.serie, 'UNICA') as serie
    from "InscricaoCampeonato" ic
    join "Equipe" e on e.id = ic."equipeId"
    where ic."ligaId" = p_liga_id and ic.status = 'APROVADA'
  ),
  partidas as (
    select
      p.id,
      p."equipeAId",
      p."equipeBId",
      coalesce(p."setsPorA", (
        select count(*) from "SetPartida" sp where sp."partidaId" = p.id and sp."pontosA" > sp."pontosB"
      ))::int as sets_a,
      coalesce(p."setsPorB", (
        select count(*) from "SetPartida" sp where sp."partidaId" = p.id and sp."pontosB" > sp."pontosA"
      ))::int as sets_b,
      coalesce(p."pontosPorA", (
        select coalesce(sum(sp."pontosA"), 0) from "SetPartida" sp where sp."partidaId" = p.id
      ))::int as pontos_a,
      coalesce(p."pontosPorB", (
        select coalesce(sum(sp."pontosB"), 0) from "SetPartida" sp where sp."partidaId" = p.id
      ))::int as pontos_b
    from "Partida" p
    where p."ligaId" = p_liga_id
      and (
        upper(trim(coalesce(p.status, ''))) in ('ENCERRADA', 'FINALIZADA', 'FINISHED', 'APROVADA')
        or p."sumulaAprovadaEm" is not null
        or (p."sumulaSubmetidaEm" is not null and p."vencedorId" is not null)
      )
  ),
  partidas_validas as (
    select * from partidas
    where sets_a <> sets_b
      and "equipeAId" in (select equipe_id from equipes)
      and "equipeBId" in (select equipe_id from equipes)
  ),
  eventos as (
    select
      "equipeAId" as equipe_id,
      1 as jogos,
      (sets_a > sets_b)::int as vitorias,
      (sets_a < sets_b)::int as derrotas,
      sets_a as sets_pro,
      sets_b as sets_contra,
      pontos_a as pontos_pro,
      pontos_b as pontos_contra,
      case
        when sets_a > sets_b then (case when sets_b = 0 then 4 else 3 end)
        else (case when sets_a = 0 then 0 else 1 end)
      end as pontos
    from partidas_validas
    union all
    select
      "equipeBId" as equipe_id,
      1,
      (sets_b > sets_a)::int,
      (sets_b < sets_a)::int,
      sets_b,
      sets_a,
      pontos_b,
      pontos_a,
      case
        when sets_b > sets_a then (case when sets_a = 0 then 4 else 3 end)
        else (case when sets_b = 0 then 0 else 1 end)
      end
    from partidas_validas
  ),
  agregado as (
    select
      e.equipe_id,
      e.categoria,
      e.serie,
      coalesce(sum(ev.jogos), 0)::int as jogos,
      coalesce(sum(ev.vitorias), 0)::int as vitorias,
      coalesce(sum(ev.derrotas), 0)::int as derrotas,
      coalesce(sum(ev.sets_pro), 0)::int as sets_pro,
      coalesce(sum(ev.sets_contra), 0)::int as sets_contra,
      coalesce(sum(ev.pontos_pro), 0)::int as pontos_pro,
      coalesce(sum(ev.pontos_contra), 0)::int as pontos_contra,
      coalesce(sum(ev.pontos), 0)::int as pontos
    from equipes e
    left join eventos ev on ev.equipe_id = e.equipe_id
    group by e.equipe_id, e.categoria, e.serie
  ),
  ranqueado as (
    select
      *,
      row_number() over (
        order by pontos desc, vitorias desc, (sets_pro - sets_contra) desc, (pontos_pro - pontos_contra) desc
      ) as posicao
    from agregado
  )
  insert into "ClassificacaoEntrada" (
    "equipeId", "ligaId", categoria, serie, posicao, pontos, jogos, vitorias, derrotas,
    "setsPro", "setsContra", "pontosPro", "pontosContra", punicoes, "atualizadoEm"
  )
  select
    equipe_id, p_liga_id, categoria, serie, posicao, pontos, jogos, vitorias, derrotas,
    sets_pro, sets_contra, pontos_pro, pontos_contra, 0, now()
  from ranqueado
  on conflict ("ligaId", "equipeId") do update set
    categoria = excluded.categoria,
    serie = excluded.serie,
    posicao = excluded.posicao,
    pontos = excluded.pontos,
    jogos = excluded.jogos,
    vitorias = excluded.vitorias,
    derrotas = excluded.derrotas,
    "setsPro" = excluded."setsPro",
    "setsContra" = excluded."setsContra",
    "pontosPro" = excluded."pontosPro",
    "pontosContra" = excluded."pontosContra",
    "atualizadoEm" = excluded."atualizadoEm";
end;
$$;
