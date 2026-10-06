-- Sets já encerrados de uma partida em andamento entram no saldo da classificação.
-- Jogos, vitórias, derrotas e pontos do campeonato continuam só quando a partida encerra.
-- O Realtime do placar não publica o token da súmula.

create or replace function public.recalcular_classificacao_categoria(p_liga_id integer, p_categoria_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  cfg "CategoriaConfiguracao";
  ordering text;
  pontos_set integer;
  sets_partida integer;
  pontos_ultimo integer;
  tie_break boolean;
  diferenca integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_categoria_id::text, 0));
  perform 1 from "CategoriaCampeonato" where id = p_categoria_id and "ligaId" = p_liga_id for update;
  select * into strict cfg from "CategoriaConfiguracao" where "categoriaCampeonatoId" = p_categoria_id and "ligaId" = p_liga_id;
  select string_agg(
    case value
      when 'PONTOS' then 'pontos desc'
      when 'VITORIAS' then 'vitorias desc'
      when 'DERROTAS' then 'derrotas asc'
      when 'SALDO_SETS' then '(sets_pro-sets_contra) desc'
      when 'SALDO_PONTOS' then '(pontos_pro-pontos_contra) desc'
      when 'SETS_PRO' then 'sets_pro desc'
      when 'PONTOS_PRO' then 'pontos_pro desc'
    end,
    ',' order by ord
  ) into ordering
  from jsonb_array_elements_text(cfg."criteriosClassificacao"::jsonb) with ordinality x(value, ord);
  ordering := coalesce(ordering || ',', '') || 'equipe_id';
  pontos_set := coalesce(cfg."pontosPorSet", 21);
  sets_partida := coalesce(cfg."setsPorPartida", 3);
  tie_break := coalesce(cfg."tieBreakUltimoSet", false);
  pontos_ultimo := case when tie_break then coalesce(cfg."pontosUltimoSet", 15) else pontos_set end;
  diferenca := coalesce(cfg."diferencaMinimaSet", 2);

  execute 'with teams as (
      select id from "Equipe"
      where "ligaId" = $1 and "categoriaCampeonatoId" = $2 and "statusEquipe" = ''ATIVA''
    ),
    matches as (
      select p.*,
        coalesce(p."setsPorA", (select count(*) from "SetPartida" s where s."partidaId" = p.id and s."pontosA" > s."pontosB")) sa,
        coalesce(p."setsPorB", (select count(*) from "SetPartida" s where s."partidaId" = p.id and s."pontosB" > s."pontosA")) sb,
        coalesce(p."pontosPorA", (select sum(s."pontosA") from "SetPartida" s where s."partidaId" = p.id), 0) pa,
        coalesce(p."pontosPorB", (select sum(s."pontosB") from "SetPartida" s where s."partidaId" = p.id), 0) pb
      from "Partida" p
      where p."ligaId" = $1
        and p."categoriaCampeonatoId" = $2
        and coalesce(p.fase, ''GERAL'') in (''GERAL'', ''GRUPOS'')
        and (
          p.status in (''ENCERRADA'', ''FINALIZADA'', ''APROVADA'')
          or p."sumulaAprovadaEm" is not null
          or (p."sumulaSubmetidaEm" is not null and p."vencedorId" is not null)
        )
    ),
    events as (
      select "equipeAId" eid, sa sf, sb sc, pa pf, pb pc from matches where sa <> sb
      union all
      select "equipeBId", sb, sa, pb, pa from matches where sa <> sb
    ),
    finished as (
      select e.eid equipe_id,
        count(*)::int jogos,
        count(*) filter (where sf > sc)::int vitorias,
        count(*) filter (where sf < sc)::int derrotas,
        coalesce(sum(sf), 0)::int sets_pro,
        coalesce(sum(sc), 0)::int sets_contra,
        coalesce(sum(pf), 0)::int pontos_pro,
        coalesce(sum(pc), 0)::int pontos_contra,
        coalesce(sum(case
          when sf > sc then case when sf - sc = 1 then $3 else $5 end
          when sf < sc then case when sc - sf = 1 then $4 else $6 end
          else 0
        end), 0)::int pontos
      from events e
      group by e.eid
    ),
    live_sets as (
      select p."equipeAId", p."equipeBId", s."pontosA", s."pontosB"
      from "Partida" p
      join "SetPartida" s on s."partidaId" = p.id
      where p."ligaId" = $1
        and p."categoriaCampeonatoId" = $2
        and coalesce(p.fase, ''GERAL'') in (''GERAL'', ''GRUPOS'')
        and p.status = ''EM_ANDAMENTO''
        and greatest(s."pontosA", s."pontosB") >= case when s.numero = $8 and $10 then $9 else $7 end
        and abs(s."pontosA" - s."pontosB") >= $11
    ),
    live as (
      select lado.eid,
        coalesce(sum(lado.sf), 0)::int sets_pro,
        coalesce(sum(lado.sc), 0)::int sets_contra,
        coalesce(sum(lado.pf), 0)::int pontos_pro,
        coalesce(sum(lado.pc), 0)::int pontos_contra
      from (
        select "equipeAId" eid, 1 sf, 0 sc, "pontosA" pf, "pontosB" pc from live_sets where "pontosA" > "pontosB"
        union all
        select "equipeBId", 1, 0, "pontosB", "pontosA" from live_sets where "pontosB" > "pontosA"
      ) lado
      group by lado.eid
    ),
    totals as (
      select t.id equipe_id,
        coalesce(f.jogos, 0) jogos,
        coalesce(f.vitorias, 0) vitorias,
        coalesce(f.derrotas, 0) derrotas,
        coalesce(f.sets_pro, 0) + coalesce(l.sets_pro, 0) sets_pro,
        coalesce(f.sets_contra, 0) + coalesce(l.sets_contra, 0) sets_contra,
        coalesce(f.pontos_pro, 0) + coalesce(l.pontos_pro, 0) pontos_pro,
        coalesce(f.pontos_contra, 0) + coalesce(l.pontos_contra, 0) pontos_contra,
        coalesce(f.pontos, 0) pontos
      from teams t
      left join finished f on f.equipe_id = t.id
      left join live l on l.eid = t.id
    ),
    ranked as (
      select *, row_number() over (order by ' || ordering || ') posicao
      from totals
    )
    insert into "ClassificacaoEntrada" (
      "ligaId", "categoriaCampeonatoId", "equipeId", categoria, posicao, pontos, jogos, vitorias, derrotas,
      "setsPro", "setsContra", "pontosPro", "pontosContra", punicoes, "atualizadoEm"
    )
    select $1, $2, equipe_id, '''', posicao, pontos, jogos, vitorias, derrotas, sets_pro, sets_contra, pontos_pro, pontos_contra, 0, now()
    from ranked
    on conflict ("ligaId", "equipeId") do update set
      "categoriaCampeonatoId" = excluded."categoriaCampeonatoId",
      posicao = excluded.posicao,
      pontos = excluded.pontos,
      jogos = excluded.jogos,
      vitorias = excluded.vitorias,
      derrotas = excluded.derrotas,
      "setsPro" = excluded."setsPro",
      "setsContra" = excluded."setsContra",
      "pontosPro" = excluded."pontosPro",
      "pontosContra" = excluded."pontosContra",
      "atualizadoEm" = now()'
  using p_liga_id, p_categoria_id,
    cfg."pontosVencedorMargem1", cfg."pontosPerdedorMargem1", cfg."pontosVencedorMargem2", cfg."pontosPerdedorMargem2",
    pontos_set, sets_partida, pontos_ultimo, tie_break, diferenca;

  delete from "ClassificacaoEntrada" ce
  where ce."ligaId" = p_liga_id
    and ce."categoriaCampeonatoId" = p_categoria_id
    and not exists (
      select 1 from "Equipe" e where e.id = ce."equipeId" and e."statusEquipe" = 'ATIVA'
    );
end
$function$;

create unique index if not exists partida_realtime_identidade on public."Partida" (id, "ligaId");
alter table public."Partida" replica identity using index partida_realtime_identidade;
alter table public."SetPartida" replica identity full;
alter table public."ClassificacaoEntrada" replica identity full;

do $publicacao$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'SetPartida'
  ) then
    alter publication supabase_realtime add table public."SetPartida";
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ClassificacaoEntrada'
  ) then
    alter publication supabase_realtime add table public."ClassificacaoEntrada";
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'Partida'
  ) then
    alter publication supabase_realtime add table public."Partida" (
      id,
      "ligaId",
      "equipeAId",
      "equipeBId",
      categoria,
      rodada,
      status,
      "dataHora",
      "localNome",
      "setsPorA",
      "setsPorB",
      "pontosPorA",
      "pontosPorB",
      "vencedorId"
    );
  end if;
end
$publicacao$;
