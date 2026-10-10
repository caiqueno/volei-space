-- Grava a súmula (sets, presenças, ocorrências, destaques e placar) numa
-- transação só. A classificação calculada em src/lib/classificacao.ts entra
-- na mesma trava da liga. Não substitui recalcular_classificacao_liga:
-- aquela função ainda pontua 4/3/1/0 e mistura o mata-mata.
--
-- A trava da liga é pg_advisory_xact_lock(integer), a mesma forma da função
-- antiga. A súmula pega essa trava antes da trava da partida, para não
-- cruzar com a classificação. Nada foi aplicado em produção.

create or replace function public.gravar_sumula_partida(
  p_partida_id integer,
  p_sets jsonb,
  p_presencas jsonb,
  p_ocorrencias jsonb,
  p_destaques jsonb,
  p_partida jsonb,
  p_registro text
) returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_liga_id integer;
  v_partida jsonb;
  item jsonb;
begin
  select "ligaId" into v_liga_id from "Partida" where id = p_partida_id;
  if v_liga_id is null then
    raise exception 'Partida nao encontrada';
  end if;

  perform pg_advisory_xact_lock(v_liga_id);
  perform pg_advisory_xact_lock(v_liga_id, p_partida_id);
  perform 1 from "Partida" where id = p_partida_id for update;

  v_partida := coalesce(p_partida, '{}'::jsonb);

  delete from "SetPartida" where "partidaId" = p_partida_id;
  for item in select * from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) loop
    insert into "SetPartida" ("partidaId", numero, "pontosA", "pontosB")
    values (
      p_partida_id,
      (item->>'numero')::integer,
      (item->>'pontosA')::integer,
      (item->>'pontosB')::integer
    );
  end loop;

  delete from "SumulaPresenca" where "partidaId" = p_partida_id;
  for item in select * from jsonb_array_elements(coalesce(p_presencas, '[]'::jsonb)) loop
    insert into "SumulaPresenca" ("partidaId", "jogadorId", "equipeId", presente, numero)
    values (
      p_partida_id,
      (item->>'jogadorId')::integer,
      (item->>'equipeId')::integer,
      case
        when not (item ? 'presente') or item->'presente' = 'null'::jsonb then null
        else (item->>'presente')::boolean
      end,
      case
        when not (item ? 'numero') or item->'numero' = 'null'::jsonb then null
        else (item->>'numero')::integer
      end
    );
  end loop;

  delete from "OcorrenciaPartida"
  where "partidaId" = p_partida_id
    and coalesce(descricao, '') not like 'Registro de %';

  for item in select * from jsonb_array_elements(coalesce(p_ocorrencias, '[]'::jsonb)) loop
    insert into "OcorrenciaPartida" ("partidaId", tipo, descricao, "set", "jogadorId")
    values (
      p_partida_id,
      item->>'tipo',
      item->>'descricao',
      case when not (item ? 'set') or item->'set' = 'null'::jsonb then null else (item->>'set')::integer end,
      case when not (item ? 'jogadorId') or item->'jogadorId' = 'null'::jsonb then null else (item->>'jogadorId')::integer end
    );
  end loop;

  if p_registro is not null and length(btrim(p_registro)) > 0 then
    insert into "OcorrenciaPartida" ("partidaId", tipo, descricao)
    values (p_partida_id, 'OBSERVACAO', p_registro);
  end if;

  delete from "DestaquesPartida" where "partidaId" = p_partida_id;
  for item in select * from jsonb_array_elements(coalesce(p_destaques, '[]'::jsonb)) loop
    insert into "DestaquesPartida" ("partidaId", "jogadorId", tipo)
    values (p_partida_id, (item->>'jogadorId')::integer, item->>'tipo');
  end loop;

  update "Partida" set
    status = case when v_partida ? 'status' then v_partida->>'status' else status end,
    "setsPorA" = case when v_partida ? 'setsPorA' then (v_partida->>'setsPorA')::integer else "setsPorA" end,
    "setsPorB" = case when v_partida ? 'setsPorB' then (v_partida->>'setsPorB')::integer else "setsPorB" end,
    "pontosPorA" = case when v_partida ? 'pontosPorA' then (v_partida->>'pontosPorA')::integer else "pontosPorA" end,
    "pontosPorB" = case when v_partida ? 'pontosPorB' then (v_partida->>'pontosPorB')::integer else "pontosPorB" end,
    "vencedorId" = case
      when v_partida ? 'vencedorId' and v_partida->'vencedorId' = 'null'::jsonb then null
      when v_partida ? 'vencedorId' then (v_partida->>'vencedorId')::integer
      else "vencedorId"
    end,
    "sumulaSubmetidaEm" = case
      when v_partida ? 'sumulaSubmetidaEm' and v_partida->'sumulaSubmetidaEm' = 'null'::jsonb then null
      when v_partida ? 'sumulaSubmetidaEm' then (v_partida->>'sumulaSubmetidaEm')::timestamptz
      else "sumulaSubmetidaEm"
    end,
    "sumulaAprovadaEm" = case
      when v_partida ? 'sumulaAprovadaEm' and v_partida->'sumulaAprovadaEm' = 'null'::jsonb then null
      when v_partida ? 'sumulaAprovadaEm' then (v_partida->>'sumulaAprovadaEm')::timestamptz
      else "sumulaAprovadaEm"
    end
  where id = p_partida_id;
end
$function$;

create or replace function public.gravar_classificacao_calculada(
  p_liga_id integer,
  p_linhas jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  linha jsonb;
  ids integer[] := array[]::integer[];
begin
  if p_liga_id is null or p_liga_id <= 0 then
    raise exception 'Liga invalida';
  end if;

  perform pg_advisory_xact_lock(p_liga_id);

  for linha in select * from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) loop
    ids := ids || (linha->>'equipeId')::integer;
    insert into "ClassificacaoEntrada" (
      "equipeId", "ligaId", "categoriaCampeonatoId", categoria, serie,
      posicao, pontos, jogos, vitorias, derrotas,
      "setsPro", "setsContra", "pontosPro", "pontosContra", punicoes, "atualizadoEm"
    ) values (
      (linha->>'equipeId')::integer,
      p_liga_id,
      nullif(linha->>'categoriaCampeonatoId', '')::uuid,
      coalesce(linha->>'categoria', ''),
      null,
      coalesce((linha->>'posicao')::integer, 0),
      coalesce((linha->>'pontos')::integer, 0),
      coalesce((linha->>'jogos')::integer, 0),
      coalesce((linha->>'vitorias')::integer, 0),
      coalesce((linha->>'derrotas')::integer, 0),
      coalesce((linha->>'setsPro')::integer, 0),
      coalesce((linha->>'setsContra')::integer, 0),
      coalesce((linha->>'pontosPro')::integer, 0),
      coalesce((linha->>'pontosContra')::integer, 0),
      coalesce((linha->>'punicoes')::integer, 0),
      now()
    )
    on conflict ("ligaId", "equipeId") do update set
      "categoriaCampeonatoId" = excluded."categoriaCampeonatoId",
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
      punicoes = excluded.punicoes,
      "atualizadoEm" = now();
  end loop;

  delete from "ClassificacaoEntrada"
  where "ligaId" = p_liga_id
    and not ("equipeId" = any (ids));
end
$function$;

do $grant$
begin
  execute 'revoke all on function public.gravar_sumula_partida(integer, jsonb, jsonb, jsonb, jsonb, jsonb, text) from public';
  execute 'revoke all on function public.gravar_classificacao_calculada(integer, jsonb) from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.gravar_sumula_partida(integer, jsonb, jsonb, jsonb, jsonb, jsonb, text) from anon';
    execute 'revoke all on function public.gravar_classificacao_calculada(integer, jsonb) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.gravar_sumula_partida(integer, jsonb, jsonb, jsonb, jsonb, jsonb, text) from authenticated';
    execute 'revoke all on function public.gravar_classificacao_calculada(integer, jsonb) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.gravar_sumula_partida(integer, jsonb, jsonb, jsonb, jsonb, jsonb, text) to service_role';
    execute 'grant execute on function public.gravar_classificacao_calculada(integer, jsonb) to service_role';
  end if;
end
$grant$;
