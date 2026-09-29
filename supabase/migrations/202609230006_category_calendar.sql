begin;
-- Direct assignment endpoints participate in the same category lock/revision protocol.
do $$ declare table_name text; begin
 foreach table_name in array array['EscalaArbitro','CandidaturaPartidaArbitro'] loop
  if not exists(select 1 from pg_trigger where tgrelid=format('public.%I',table_name)::regclass and tgfoid='public.touch_category_operation()'::regprocedure and not tgisinternal) then
   execute format('create trigger category_operational_revision before insert or update or delete on public.%I for each row execute function public.touch_category_operation()',table_name);
  end if;
 end loop;
end $$;
-- A complete calendar batch either succeeds or leaves all matches and assignments intact.
create or replace function public.atualizar_calendario_categoria(
 p_liga_id integer,p_categoria_id uuid,p_organizador_id text,p_operacao_versao integer,p_partidas jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare cat "CategoriaCampeonato"; current_match "Partida"; item jsonb; referee integer; home_team integer;
 updated integer:=0; requested_ids integer[]; next_status text;
begin
 perform 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id for update;
 if not found then raise exception 'Championship unavailable or unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_categoria_id::text,0));
 select * into strict cat from "CategoriaCampeonato" where id=p_categoria_id and "ligaId"=p_liga_id for update;
 if cat."revisaoOperacional" is distinct from p_operacao_versao then raise exception 'Calendar changed' using errcode='40001'; end if;
 if jsonb_typeof(p_partidas) is distinct from 'array' then raise exception 'Invalid calendar'; end if;
 if jsonb_array_length(p_partidas)<1 or jsonb_array_length(p_partidas)>1000 then raise exception 'Invalid calendar size'; end if;
 select array_agg((v->>'id')::integer) into requested_ids from jsonb_array_elements(p_partidas) v;
 if cardinality(requested_ids)<>(select count(distinct x) from unnest(requested_ids) x) then raise exception 'Duplicate or missing match identifier'; end if;
 perform 1 from "Partida" where id=any(requested_ids) and "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id order by id for update;
 if (select count(*) from "Partida" where id=any(requested_ids) and "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id)<>cardinality(requested_ids) then raise exception 'Match outside category'; end if;
 for item in select value from jsonb_array_elements(p_partidas) loop
  if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where k not in('id','dataHora','localNome','mandanteId','arbitroId','status')) then raise exception 'Unknown calendar field'; end if;
  select * into strict current_match from "Partida" where id=(item->>'id')::integer and "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id;
  if current_match.status not in('AGENDADA','PENDENTE_APROVACAO','CANCELADA') or current_match."sumulaSubmetidaEm" is not null or current_match."sumulaAprovadaEm" is not null or current_match."setsPorA" is not null or current_match."setsPorB" is not null
   or exists(select 1 from "SetPartida" where "partidaId"=current_match.id)
   or exists(select 1 from "SumulaPresenca" where "partidaId"=current_match.id)
   or exists(select 1 from "OcorrenciaPartida" where "partidaId"=current_match.id)
   or exists(select 1 from "DestaquesPartida" where "partidaId"=current_match.id) then raise exception 'Match operation has already started'; end if;
  next_status:=coalesce(item->>'status',current_match.status);
  if next_status not in('AGENDADA','PENDENTE_APROVACAO','CANCELADA') then raise exception 'Invalid calendar status'; end if;
  home_team:=(item->>'mandanteId')::integer;
  if home_team is not null and home_team not in(current_match."equipeAId",current_match."equipeBId") then raise exception 'Home team is not a participant'; end if;
  referee:=(item->>'arbitroId')::integer;
  if referee is not null then
   perform 1 from "Arbitro" a where a.id=referee and a.aprovado=true for share;
   if not found then raise exception 'Referee is not approved'; end if;
  end if;
  update "Partida" set status=next_status,
   "dataHora"=case when item ? 'dataHora' then (item->>'dataHora')::timestamptz else "dataHora" end,
   "localNome"=case when item ? 'localNome' then coalesce(nullif(trim(item->>'localNome'),''),'A definir') else "localNome" end,
   "equipeAId"=case when home_team=current_match."equipeBId" then current_match."equipeBId" else current_match."equipeAId" end,
   "equipeBId"=case when home_team=current_match."equipeBId" then current_match."equipeAId" else current_match."equipeBId" end,
   "atualizadoEm"=now()
   where id=current_match.id and "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id;
  if item ? 'arbitroId' then
   if referee is null then
    delete from "EscalaArbitro" where "partidaId"=current_match.id and cargo='PRIMEIRO_ARBITRO';
   else
    insert into "EscalaArbitro"("partidaId","arbitroId",cargo) values(current_match.id,referee,'PRIMEIRO_ARBITRO')
    on conflict("partidaId",cargo) do update set "arbitroId"=excluded."arbitroId";
   end if;
  end if;
  updated:=updated+1;
 end loop;
 update "CategoriaCampeonato" set "revisaoOperacional"="revisaoOperacional"+1,"atualizadoEm"=now() where id=p_categoria_id and "ligaId"=p_liga_id;
 return jsonb_build_object('atualizadas',updated);
end $$;
revoke all on function public.atualizar_calendario_categoria(integer,uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.atualizar_calendario_categoria(integer,uuid,text,integer,jsonb) to service_role;
commit;
