-- Category-scoped structure and knockout writes. Apply only after foundation/backfill.
begin;

create unique index "Partida_categoria_fase_slot_key" on public."Partida" ("ligaId","categoriaCampeonatoId",fase,rodada)
where fase in ('DEZESSEIS_AVOS','OITAVAS','QUARTAS','SEMIFINAL','FINAL','TERCEIRO_LUGAR');

create or replace function public.classificados_categoria(p_liga_id integer,p_categoria_id uuid)
returns table("equipeId" integer) language plpgsql security definer set search_path=public as $$
declare cfg "CategoriaConfiguracao"; begin
 select * into strict cfg from "CategoriaConfiguracao" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id;
 if cfg.formato='MATA_MATA' then
  return query select e.id from "Equipe" e where e."ligaId"=p_liga_id and e."categoriaCampeonatoId"=p_categoria_id and e."statusEquipe"='ATIVA' order by e.id;
 else
  return query with ranked as (
   select ce."equipeId" eid,ce.posicao,ge."grupoId",g.classificados,
     row_number() over(partition by ge."grupoId" order by ce.posicao,ce."equipeId") group_rank
   from "ClassificacaoEntrada" ce
   join "Equipe" e on e.id=ce."equipeId" and e."ligaId"=ce."ligaId" and e."categoriaCampeonatoId"=ce."categoriaCampeonatoId" and e."statusEquipe"='ATIVA'
   join "GrupoEquipeCampeonato" ge on ge."equipeId"=ce."equipeId" and ge."ligaId"=ce."ligaId" and ge."categoriaCampeonatoId"=ce."categoriaCampeonatoId"
   join "GrupoCampeonato" g on g.id=ge."grupoId" and g."ligaId"=ge."ligaId" and g."categoriaCampeonatoId"=ge."categoriaCampeonatoId"
   where ce."ligaId"=p_liga_id and ce."categoriaCampeonatoId"=p_categoria_id
  ), automatic as (select eid from ranked where group_rank<=classificados), extras as (
   select eid from ranked where eid not in(select a.eid from automatic a) order by posicao,eid limit cfg."melhoresClassificadosGerais"
  ), manual as (
   select m."equipeId" eid from "ClassificacaoEliminatoria" m join "Equipe" e on e.id=m."equipeId" and e."ligaId"=m."ligaId" and e."categoriaCampeonatoId"=m."categoriaCampeonatoId"
   where m."ligaId"=p_liga_id and m."categoriaCampeonatoId"=p_categoria_id and e."statusEquipe"='ATIVA'
  ) select eid from automatic union select eid from extras union select eid from manual;
 end if;
end $$;

create or replace function public.substituir_estrutura_categoria(
 p_liga_id integer,p_categoria_id uuid,p_organizador_id text,p_config_versao integer,p_operacao_versao integer,
 p_grupos jsonb,p_data_inicial timestamptz,p_local text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare cat "CategoriaCampeonato"; cfg "CategoriaConfiguracao"; grp jsonb; team jsonb; gid bigint; idx integer:=0;
 pair record; game integer:=0; round_no integer; link_pos integer; n integer; total integer; min_size integer; max_size integer; required integer;
 created jsonb:='[]'; begin
 -- Lock the parent first, the same order as category selection/configuration writers.
 perform 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id and "pagamentoConfirmadoEm" is not null for update;
 if not found then raise exception 'Championship unavailable or unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_categoria_id::text,0));
 select * into strict cat from "CategoriaCampeonato" where id=p_categoria_id and "ligaId"=p_liga_id for update;
 select * into strict cfg from "CategoriaConfiguracao" where "categoriaCampeonatoId"=p_categoria_id and "ligaId"=p_liga_id for update;
 if cfg.versao is distinct from p_config_versao or cat."revisaoOperacional" is distinct from p_operacao_versao then raise exception 'Category changed' using errcode='40001'; end if;
 if cfg.formato not in ('PONTOS_CORRIDOS','GRUPOS_MATA_MATA') or cfg.formato is null then raise exception 'Category has no group stage'; end if;
 if jsonb_typeof(p_grupos) is distinct from 'array' then raise exception 'Invalid groups'; end if;
 n:=jsonb_array_length(p_grupos);
 if n<1 or n>32 or n is distinct from cfg."quantidadeGrupos" then raise exception 'Invalid group count'; end if;
 if exists(select 1 from jsonb_array_elements(p_grupos) g where jsonb_typeof(g) <> 'object' or coalesce(length(trim(g->>'nome')),0)=0 or length(g->>'nome')>100 or jsonb_typeof(g->'equipeIds') is distinct from 'array') then raise exception 'Invalid group'; end if;
 if (select count(distinct lower(trim(g->>'nome'))) from jsonb_array_elements(p_grupos) g)<>n then raise exception 'Duplicate group name'; end if;
 select min(jsonb_array_length(g->'equipeIds')),max(jsonb_array_length(g->'equipeIds')),sum(jsonb_array_length(g->'equipeIds')) into min_size,max_size,total from jsonb_array_elements(p_grupos) g;
 if min_size<1 or max_size-min_size>1 or cfg."classificadosPorGrupo">min_size then raise exception 'Unbalanced groups or invalid qualifiers'; end if;
 if total<2 or total<>(select count(*) from "Equipe" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and "statusEquipe"='ATIVA') then raise exception 'All active category teams must be assigned'; end if;
 if (select count(distinct (t#>>'{}')::integer) from jsonb_array_elements(p_grupos) g cross join lateral jsonb_array_elements(g->'equipeIds') t)<>total then raise exception 'Duplicate team'; end if;
 if exists(select 1 from jsonb_array_elements(p_grupos) g cross join lateral jsonb_array_elements(g->'equipeIds') t where jsonb_typeof(t)<>'number' or not exists(select 1 from "Equipe" e where e.id=(t#>>'{}')::integer and e."ligaId"=p_liga_id and e."categoriaCampeonatoId"=p_categoria_id and e."statusEquipe"='ATIVA')) then raise exception 'Team outside category'; end if;
 required:=case cfg."faseEliminatoria" when 'FINAL' then 2 when 'SEMIFINAL' then 4 when 'QUARTAS' then 8 when 'OITAVAS' then 16 when 'DEZESSEIS_AVOS' then 32 else 0 end;
 if required>0 and (n*cfg."classificadosPorGrupo"+cfg."melhoresClassificadosGerais"<>required or required>total) then raise exception 'Qualifiers do not fit knockout'; end if;
 if exists(select 1 from "Partida" p where p."ligaId"=p_liga_id and p."categoriaCampeonatoId"=p_categoria_id and (
  p.status<>'AGENDADA' or p.fase<>'GRUPOS' or p."sumulaSubmetidaEm" is not null or p."sumulaAprovadaEm" is not null or p."setsPorA" is not null or p."setsPorB" is not null
  or exists(select 1 from "SetPartida" s where s."partidaId"=p.id)
  or exists(select 1 from "SumulaPresenca" s where s."partidaId"=p.id)
  or exists(select 1 from "OcorrenciaPartida" s where s."partidaId"=p.id)
  or exists(select 1 from "DestaquesPartida" s where s."partidaId"=p.id)
  or exists(select 1 from "EscalaArbitro" s where s."partidaId"=p.id)
  or exists(select 1 from "CandidaturaPartidaArbitro" s where s."partidaId"=p.id))) then raise exception 'Existing operation prevents replacing structure'; end if;
 -- The following deletion and regeneration are one transaction; any failure restores all rows.
 delete from "Partida" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and fase='GRUPOS';
 delete from "GrupoEquipeCampeonato" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id;
 delete from "GrupoCampeonato" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id;
 for grp in select value from jsonb_array_elements(p_grupos) loop
  idx:=idx+1;
  insert into "GrupoCampeonato"("ligaId","categoriaCampeonatoId",nome,ordem,classificados) values(p_liga_id,p_categoria_id,trim(grp->>'nome'),idx,cfg."classificadosPorGrupo") returning id into gid;
  created:=created||jsonb_build_array(jsonb_build_object('id',gid,'nome',trim(grp->>'nome'),'ordem',idx));
  link_pos:=0;
  for team in select value from jsonb_array_elements(grp->'equipeIds') loop
   link_pos:=link_pos+1;
   insert into "GrupoEquipeCampeonato"("ligaId","categoriaCampeonatoId","grupoId","equipeId",posicao) values(p_liga_id,p_categoria_id,gid,(team#>>'{}')::integer,link_pos);
  end loop;
  round_no:=0;
  for pair in select (a.value#>>'{}')::integer aid,(b.value#>>'{}')::integer bid from jsonb_array_elements(grp->'equipeIds') with ordinality a(value,ord) cross join jsonb_array_elements(grp->'equipeIds') with ordinality b(value,ord) where a.ord<b.ord order by a.ord,b.ord loop
   round_no:=round_no+1;
   insert into "Partida"("ligaId","categoriaCampeonatoId","equipeAId","equipeBId",rodada,status,"dataHora","localNome","sumulaToken","grupoId",fase,"atualizadoEm")
   values(p_liga_id,p_categoria_id,pair.aid,pair.bid,round_no,'AGENDADA',p_data_inicial+game*interval '1 day',coalesce(nullif(trim(p_local),''),'A definir'),gen_random_uuid()::text,gid,'GRUPOS',now());
   game:=game+1;
   if cfg."turnoReturno" then
    round_no:=round_no+1;
    insert into "Partida"("ligaId","categoriaCampeonatoId","equipeAId","equipeBId",rodada,status,"dataHora","localNome","sumulaToken","grupoId",fase,"atualizadoEm")
    values(p_liga_id,p_categoria_id,pair.bid,pair.aid,round_no,'AGENDADA',p_data_inicial+game*interval '1 day',coalesce(nullif(trim(p_local),''),'A definir'),gen_random_uuid()::text,gid,'GRUPOS',now());
    game:=game+1;
   end if;
  end loop;
 end loop;
 update "CategoriaCampeonato" set "revisaoOperacional"="revisaoOperacional"+1,"atualizadoEm"=now() where id=p_categoria_id and "ligaId"=p_liga_id;
 perform recalcular_classificacao_categoria(p_liga_id,p_categoria_id);
 return jsonb_build_object('grupos',created,'partidasGeradas',game);
end $$;

create or replace function public.criar_confronto_categoria(
 p_liga_id integer,p_categoria_id uuid,p_organizador_id text,p_config_versao integer,p_operacao_versao integer,
 p_fase text,p_rodada integer,p_equipe_a integer,p_equipe_b integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare cat "CategoriaCampeonato"; cfg "CategoriaConfiguracao"; phases text[]:=array['DEZESSEIS_AVOS','OITAVAS','QUARTAS','SEMIFINAL','FINAL'];
 start_idx integer; phase_idx integer; slots integer; eligible integer[]; expected integer; out_match record;
begin
 perform 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id and "pagamentoConfirmadoEm" is not null for update;
 if not found then raise exception 'Championship unavailable or unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_categoria_id::text,0));
 select * into strict cat from "CategoriaCampeonato" where id=p_categoria_id and "ligaId"=p_liga_id for update;
 select * into strict cfg from "CategoriaConfiguracao" where "categoriaCampeonatoId"=p_categoria_id and "ligaId"=p_liga_id for update;
 if cfg.versao is distinct from p_config_versao or cat."revisaoOperacional" is distinct from p_operacao_versao then raise exception 'Category changed' using errcode='40001'; end if;
 if p_equipe_a is null or p_equipe_b is null or p_equipe_a=p_equipe_b or (select count(*) from "Equipe" where id in(p_equipe_a,p_equipe_b) and "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and "statusEquipe"='ATIVA')<>2 then raise exception 'Invalid category teams'; end if;
 start_idx:=array_position(phases,cfg."faseEliminatoria"); phase_idx:=array_position(phases,p_fase);
 if start_idx is null or cfg.formato='PONTOS_CORRIDOS' or p_rodada is null or p_rodada<1 then raise exception 'Invalid knockout'; end if;
 if p_fase='TERCEIRO_LUGAR' then
  if not cfg."disputaTerceiroLugar" or start_idx>4 or p_rodada<>1 then raise exception 'No third-place match'; end if;
  select array_agg(case when "setsPorA">"setsPorB" then "equipeBId" else "equipeAId" end) into eligible from "Partida" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and fase='SEMIFINAL' and rodada in(1,2) and status in('ENCERRADA','WO') and "setsPorA"<>"setsPorB";
  expected:=2;
 elsif phase_idx is null or phase_idx<start_idx then raise exception 'Phase outside category knockout';
 else
  slots:=power(2,5-phase_idx)::integer;
  if p_rodada>slots then raise exception 'Invalid bracket slot'; end if;
  if phase_idx=start_idx then
   if exists(select 1 from "Partida" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and fase='GRUPOS' and status not in('ENCERRADA','WO')) then raise exception 'Group stage not finished'; end if;
   select array_agg("equipeId") into eligible from classificados_categoria(p_liga_id,p_categoria_id);
   expected:=slots*2;
  else
   select array_agg(case when "setsPorA">"setsPorB" then "equipeAId" else "equipeBId" end) into eligible from "Partida" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and fase=phases[phase_idx-1] and rodada in(p_rodada*2-1,p_rodada*2) and status in('ENCERRADA','WO') and "setsPorA"<>"setsPorB";
   expected:=2;
  end if;
 end if;
 if coalesce(cardinality(eligible),0)<>expected or not(p_equipe_a=any(eligible)) or not(p_equipe_b=any(eligible)) then raise exception 'Teams are not eligible for this slot'; end if;
 if exists(select 1 from "Partida" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and fase=p_fase and (rodada=p_rodada or "equipeAId" in(p_equipe_a,p_equipe_b) or "equipeBId" in(p_equipe_a,p_equipe_b))) then raise exception 'Slot or participant already used' using errcode='23505'; end if;
 insert into "Partida"("ligaId","categoriaCampeonatoId","equipeAId","equipeBId",rodada,status,"dataHora","localNome","sumulaToken","grupoId",fase,"atualizadoEm")
 values(p_liga_id,p_categoria_id,p_equipe_a,p_equipe_b,p_rodada,'AGENDADA',null,'A definir',gen_random_uuid()::text,null,p_fase,now())
 returning id,rodada,fase,"sumulaToken" into out_match;
 update "CategoriaCampeonato" set "revisaoOperacional"="revisaoOperacional"+1,"atualizadoEm"=now() where id=p_categoria_id and "ligaId"=p_liga_id;
 return to_jsonb(out_match);
end $$;

revoke all on function public.classificados_categoria(integer,uuid) from public,anon,authenticated;
revoke all on function public.substituir_estrutura_categoria(integer,uuid,text,integer,integer,jsonb,timestamptz,text) from public,anon,authenticated;
revoke all on function public.criar_confronto_categoria(integer,uuid,text,integer,integer,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.classificados_categoria(integer,uuid) to service_role;
grant execute on function public.substituir_estrutura_categoria(integer,uuid,text,integer,integer,jsonb,timestamptz,text) to service_role;
grant execute on function public.criar_confronto_categoria(integer,uuid,text,integer,integer,text,integer,integer,integer) to service_role;
commit;
