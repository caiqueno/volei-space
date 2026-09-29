begin;
-- Moving a roster row would silently move its historical scouts and votes.
create or replace function public.guard_player_team() returns trigger language plpgsql set search_path=public as $$ begin
 if new."equipeId" is distinct from old."equipeId" then
  raise exception 'Player team is immutable; create a separate roster entry' using errcode='23514';
 end if;
 return new;
end $$;
create trigger category_player_team_guard before update of "equipeId" on "Jogador" for each row execute function public.guard_player_team();
create or replace function public.touch_category_operation() returns trigger language plpgsql set search_path=public as $$
declare payload jsonb; cid uuid; begin
 payload:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 cid:=(payload->>'categoriaCampeonatoId')::uuid;
 if cid is null and payload ? 'partidaId' then select "categoriaCampeonatoId" into cid from "Partida" where id=(payload->>'partidaId')::integer; end if;
 if cid is null and payload ? 'inscricaoRascunhoId' then select "categoriaCampeonatoId" into cid from "InscricaoEquipeRascunho" where id=(payload->>'inscricaoRascunhoId')::uuid; end if;
 if cid is null and payload ? 'equipeId' then select "categoriaCampeonatoId" into cid from "Equipe" where id=(payload->>'equipeId')::integer; end if;
 -- A cascading child delete can no longer see its parent; the parent's
 -- BEFORE DELETE already acquired the same lock and recorded the revision.
 if cid is null and tg_op='DELETE' and pg_trigger_depth()>1 then return old; end if;
 if cid is null then raise exception 'Operational write requires a category'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,0));
 update "CategoriaCampeonato" set "revisaoOperacional"="revisaoOperacional"+1 where id=cid;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['Equipe','InscricaoEquipeRascunho','InscricaoEquipeJogadorRascunho','InscricaoCampeonato','GrupoCampeonato','GrupoEquipeCampeonato','Partida','ClassificacaoEliminatoria','Jogador','SetPartida','SumulaPresenca','OcorrenciaPartida','DestaquesPartida'] loop
  execute format('create trigger category_operational_revision before insert or update or delete on %I for each row execute function public.touch_category_operation()',t);
 end loop;
end $$;
create or replace function public.touch_category_configuration() returns trigger language plpgsql set search_path=public as $$ begin
 if new."categoriaCampeonatoId"<>old."categoriaCampeonatoId" or new."ligaId"<>old."ligaId" then raise exception 'Configuration category is immutable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new."categoriaCampeonatoId"::text,0));
 new.versao:=old.versao+1; new."atualizadoEm":=now();
 update "CategoriaCampeonato" set versao=new.versao,"atualizadoEm"=now() where id=new."categoriaCampeonatoId";
 return new;
end $$;
create trigger category_configuration_revision before update on "CategoriaConfiguracao" for each row execute function public.touch_category_configuration();
alter table "InscricaoEquipeRascunho" drop constraint if exists "InscricaoEquipeRascunho_status_check";
update "InscricaoEquipeRascunho" set status=case when status='ENVIADA' then 'CONCLUIDO' when nullif(btrim("nomeEquipe"),'') is null then 'NAO_INICIADO' else 'EM_PREENCHIMENTO' end;
alter table "InscricaoEquipeRascunho" alter column status set default 'NAO_INICIADO';
alter table "InscricaoEquipeRascunho" add constraint "InscricaoEquipeRascunho_status_check" check(status in ('NAO_INICIADO','EM_PREENCHIMENTO','CONCLUIDO'));
-- Participant children inherit category from their match, with a database guard.
create or replace function public.guard_match_participant() returns trigger language plpgsql set search_path=public as $$
declare p "Partida"; team integer; begin
 select * into strict p from "Partida" where id=new."partidaId";
 if new."jogadorId" is null then return new; end if;
 select "equipeId" into strict team from "Jogador" where id=new."jogadorId";
 if team not in(p."equipeAId",p."equipeBId") then raise exception 'Player does not belong to a match participant'; end if;
 if tg_table_name='SumulaPresenca' and (to_jsonb(new)->>'equipeId')::integer<>team then raise exception 'Attendance team differs from player team'; end if;
 return new;
end $$;
create trigger category_participant_guard before insert or update on "SumulaPresenca" for each row execute function public.guard_match_participant();
create trigger category_participant_guard before insert or update on "OcorrenciaPartida" for each row execute function public.guard_match_participant();
create trigger category_participant_guard before insert or update on "DestaquesPartida" for each row execute function public.guard_match_participant();
create or replace function public.guard_category_vote() returns trigger language plpgsql set search_path=public as $$ begin
 if not exists(select 1 from "Jogador" j join "Equipe" e on e.id=j."equipeId" where j.id=new."jogadorId" and e."categoriaCampeonatoId"=new."categoriaCampeonatoId" and e."ligaId"=new."ligaId") then raise exception 'Player does not belong to ranking category'; end if;
 return new;
end $$;
create trigger category_vote_guard before insert or update on "VotoMVP" for each row execute function public.guard_category_vote();
-- Transitional textual columns are snapshots only; never a relationship key.
create or replace function public.guard_category_scope() returns trigger language plpgsql set search_path=public as $$
declare c "CategoriaCampeonato"; begin
 select * into strict c from "CategoriaCampeonato" where id=new."categoriaCampeonatoId" and "ligaId"=new."ligaId";
 if to_jsonb(new) ? 'serie' then
  if (tg_op='INSERT' and new.serie is not null) or (tg_op='UPDATE' and new.serie is distinct from old.serie) then raise exception 'Series are historical and cannot be written'; end if;
 end if;
 if to_jsonb(new) ? 'categoria' then new.categoria:=c.codigo; end if;
 if tg_op='UPDATE' and (new."categoriaCampeonatoId"<>old."categoriaCampeonatoId" or new."ligaId"<>old."ligaId") then raise exception 'Operational category is immutable'; end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['Equipe','InscricaoEquipeRascunho','InscricaoCampeonato','GrupoCampeonato','GrupoEquipeCampeonato','Partida','ClassificacaoEntrada','ClassificacaoEliminatoria','Premiacao','VotoMVP','CandidaturaEquipe'] loop
  execute format('create trigger category_scope_guard before insert or update on %I for each row execute function public.guard_category_scope()',t);
 end loop;
end $$;
-- Remove redundant simple participant foreign keys: PostgREST must have one relationship.
do $$ declare r record; begin
 for r in select conrelid::regclass tbl,conname from pg_constraint where contype='f' and array_length(conkey,1)=1
 and ((conrelid in ('"InscricaoEquipeRascunho"'::regclass,'"CandidaturaEquipe"'::regclass,'"Partida"'::regclass,'"InscricaoCampeonato"'::regclass,'"ClassificacaoEntrada"'::regclass,'"ClassificacaoEliminatoria"'::regclass,'"GrupoEquipeCampeonato"'::regclass) and confrelid='"Equipe"'::regclass)
 or (conrelid in ('"Partida"'::regclass,'"GrupoEquipeCampeonato"'::regclass) and confrelid='"GrupoCampeonato"'::regclass)
 or (conrelid='"InscricaoEquipeRascunho"'::regclass and confrelid='"InscricaoCampeonato"'::regclass)) loop
 execute format('alter table %s drop constraint %I',r.tbl,r.conname);
 end loop;
end $$;
do $$ declare fk record; begin
 for fk in select c.conname,a.attname from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
 where c.conrelid='"Partida"'::regclass and c.confrelid='"Equipe"'::regclass and c.contype='f' and a.attname in ('equipeAId','equipeBId') loop
  execute format('alter table "Partida" rename constraint %I to %I',fk.conname,'Partida_'||fk.attname||'_fkey');
 end loop;
end $$;
create or replace function public.selecionar_categorias_campeonato(p_liga_id integer,p_codigos text[],p_organizador_id text)
returns setof "CategoriaCampeonato" language plpgsql security definer set search_path=public as $$
declare c record; code text; n integer:=0; begin
 perform 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id for update;
 if not found then raise exception 'Championship not found or unauthorized'; end if;
 if p_codigos is null or cardinality(p_codigos)=0 or cardinality(p_codigos)<>(select count(distinct x) from unnest(p_codigos) x)
 or exists(select 1 from unnest(p_codigos) x where x is null or x not in ('FEMININO','FEMININO_MASTER','MASCULINO','MASCULINO_MASTER','MISTO')) then raise exception 'Select distinct catalog categories'; end if;
 for c in select * from "CategoriaCampeonato" where "ligaId"=p_liga_id and not(codigo=any(p_codigos)) for update loop
  -- Foreign keys provide a final transactional guard for every operational table.
  if exists(select 1 from "InscricaoEquipeRascunho" where "categoriaCampeonatoId"=c.id) or exists(select 1 from "Equipe" where "categoriaCampeonatoId"=c.id) then raise exception 'Category already has registration forms or teams'; end if;
  delete from "CategoriaSetupSecao" where "categoriaCampeonatoId"=c.id;
  delete from "CategoriaConfiguracao" where "categoriaCampeonatoId"=c.id;
  delete from "CategoriaCampeonato" where id=c.id;
 end loop;
 foreach code in array p_codigos loop
  insert into "CategoriaCampeonato"("ligaId",codigo,nome,slug,ordem) values(p_liga_id,code,
   case code when 'FEMININO' then 'Feminino' when 'FEMININO_MASTER' then 'Feminino Master' when 'MASCULINO' then 'Masculino' when 'MASCULINO_MASTER' then 'Masculino Master' else 'Misto' end,lower(replace(code,'_','-')),n)
  on conflict("ligaId",codigo) do update set ordem=excluded.ordem,"atualizadoEm"=now() where "CategoriaCampeonato".ordem is distinct from excluded.ordem;
  n:=n+1;
 end loop;
 insert into "CategoriaConfiguracao"("categoriaCampeonatoId","ligaId") select id,"ligaId" from "CategoriaCampeonato" where "ligaId"=p_liga_id on conflict do nothing;
 return query select * from "CategoriaCampeonato" where "ligaId"=p_liga_id order by ordem;
end $$;
revoke all on function public.selecionar_categorias_campeonato(integer,text[],text) from public,anon,authenticated;
grant execute on function public.selecionar_categorias_campeonato(integer,text[],text) to service_role;
create or replace function public.recalcular_classificacao_categoria(p_liga_id integer,p_categoria_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare cfg "CategoriaConfiguracao"; ordering text; begin
 perform pg_advisory_xact_lock(hashtextextended(p_categoria_id::text,0));
 perform 1 from "CategoriaCampeonato" where id=p_categoria_id and "ligaId"=p_liga_id for update;
 select * into strict cfg from "CategoriaConfiguracao" where "categoriaCampeonatoId"=p_categoria_id and "ligaId"=p_liga_id;
 select string_agg(case value when 'PONTOS' then 'pontos desc' when 'VITORIAS' then 'vitorias desc' when 'DERROTAS' then 'derrotas asc' when 'SALDO_SETS' then '(sets_pro-sets_contra) desc' when 'SALDO_PONTOS' then '(pontos_pro-pontos_contra) desc' when 'SETS_PRO' then 'sets_pro desc' when 'PONTOS_PRO' then 'pontos_pro desc' end,',' order by ord) into ordering
 from jsonb_array_elements_text(cfg."criteriosClassificacao"::jsonb) with ordinality x(value,ord);
 ordering:=coalesce(ordering||',','')||'equipe_id';
 execute 'with teams as (select id from "Equipe" where "ligaId"=$1 and "categoriaCampeonatoId"=$2 and "statusEquipe"=''ATIVA''),
 matches as (select p.*,coalesce(p."setsPorA",(select count(*) from "SetPartida" s where s."partidaId"=p.id and s."pontosA">s."pontosB")) sa,
 coalesce(p."setsPorB",(select count(*) from "SetPartida" s where s."partidaId"=p.id and s."pontosB">s."pontosA")) sb,
 coalesce(p."pontosPorA",(select sum(s."pontosA") from "SetPartida" s where s."partidaId"=p.id),0) pa,
 coalesce(p."pontosPorB",(select sum(s."pontosB") from "SetPartida" s where s."partidaId"=p.id),0) pb
 from "Partida" p where p."ligaId"=$1 and p."categoriaCampeonatoId"=$2 and coalesce(p.fase,''GERAL'') in (''GERAL'',''GRUPOS'')
 and (p.status in (''ENCERRADA'',''FINALIZADA'',''APROVADA'') or p."sumulaAprovadaEm" is not null or (p."sumulaSubmetidaEm" is not null and p."vencedorId" is not null))),
 events as (select "equipeAId" eid,sa sf,sb sc,pa pf,pb pc from matches where sa<>sb union all select "equipeBId",sb,sa,pb,pa from matches where sa<>sb),
 totals as (select t.id equipe_id,count(e.eid)::int jogos,count(*) filter(where sf>sc)::int vitorias,count(*) filter(where sf<sc)::int derrotas,
 coalesce(sum(sf),0)::int sets_pro,coalesce(sum(sc),0)::int sets_contra,coalesce(sum(pf),0)::int pontos_pro,coalesce(sum(pc),0)::int pontos_contra,
 coalesce(sum(case when sf>sc then case when sf-sc=1 then $3 else $5 end when sf<sc then case when sc-sf=1 then $4 else $6 end else 0 end),0)::int pontos
 from teams t left join events e on e.eid=t.id group by t.id), ranked as (select *,row_number() over(order by '||ordering||') posicao from totals)
 insert into "ClassificacaoEntrada"("ligaId","categoriaCampeonatoId","equipeId",categoria,posicao,pontos,jogos,vitorias,derrotas,"setsPro","setsContra","pontosPro","pontosContra",punicoes,"atualizadoEm")
 select $1,$2,equipe_id,'''',posicao,pontos,jogos,vitorias,derrotas,sets_pro,sets_contra,pontos_pro,pontos_contra,0,now() from ranked
 on conflict("ligaId","equipeId") do update set "categoriaCampeonatoId"=excluded."categoriaCampeonatoId",posicao=excluded.posicao,pontos=excluded.pontos,jogos=excluded.jogos,vitorias=excluded.vitorias,derrotas=excluded.derrotas,"setsPro"=excluded."setsPro","setsContra"=excluded."setsContra","pontosPro"=excluded."pontosPro","pontosContra"=excluded."pontosContra","atualizadoEm"=now()'
 using p_liga_id,p_categoria_id,cfg."pontosVencedorMargem1",cfg."pontosPerdedorMargem1",cfg."pontosVencedorMargem2",cfg."pontosPerdedorMargem2";
 delete from "ClassificacaoEntrada" ce where ce."ligaId"=p_liga_id and ce."categoriaCampeonatoId"=p_categoria_id and not exists(select 1 from "Equipe" e where e.id=ce."equipeId" and e."statusEquipe"='ATIVA');
end $$;
create or replace function public.recalcular_classificacao_liga(p_liga_id integer) returns void language plpgsql security definer set search_path=public as $$ declare c record; begin for c in select id from "CategoriaCampeonato" where "ligaId"=p_liga_id loop perform recalcular_classificacao_categoria(p_liga_id,c.id); end loop; end $$;
revoke all on function public.recalcular_classificacao_categoria(integer,uuid) from public,anon,authenticated;
revoke all on function public.recalcular_classificacao_liga(integer) from public,anon,authenticated;
grant execute on function public.recalcular_classificacao_categoria(integer,uuid) to service_role;
grant execute on function public.recalcular_classificacao_liga(integer) to service_role;
commit;
