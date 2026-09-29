-- Explicit backfill. Unknown labels, mixed groups and duplicate series abort.
-- Correct the source data with a reviewed mapping before retrying; no generic category.
create table if not exists category_sources_backfill(liga_id integer, codigo text);
delete from category_sources_backfill;
insert into category_sources_backfill
 select "ligaId",categoria from "Equipe" union select "ligaId",categoria from "Partida"
 union select "ligaId",categoria from "InscricaoEquipeRascunho"
 union select "ligaId",categoria from "CandidaturaEquipe"
 union select "ligaId",categoria from "Premiacao";
do $$ declare l record; item jsonb; active_definition text; begin
 for l in select id,"categoriasConfig" from "Liga" where nullif(btrim("categoriasConfig"),'') is not null loop
  if jsonb_typeof(l."categoriasConfig"::jsonb)<>'array' then raise exception 'categoriasConfig must be an array; liga %',l.id; end if;
  for item in select * from jsonb_array_elements(l."categoriasConfig"::jsonb) loop
   if jsonb_typeof(item)<>'string' then raise exception 'Explicit category mapping required for liga %',l.id; end if;
   insert into category_sources_backfill values(l.id,split_part(item#>>'{}',':',1));
  end loop;
 end loop;
 if exists(select 1 from category_sources_backfill where codigo is null or codigo not in ('FEMININO','FEMININO_MASTER','MASCULINO','MASCULINO_MASTER','MISTO')) then
  raise exception 'Unmapped legacy category: prepare explicit source mapping before applying';
 end if;
 if exists(select 1 from "Equipe" group by "ligaId",categoria,nome having count(*)>1) then
  raise exception 'Team name collision after series removal: explicit resolution required';
 end if;
 -- Several historical files replaced this function with incompatible scoring.
 -- A filename/checklist is not evidence of the currently installed behavior.
 if exists(select 1 from "Liga" ll join category_sources_backfill s on s.liga_id=ll.id where ll."pontuacaoResultado" is null) then
  if to_regprocedure('public.recalcular_classificacao_liga(integer)') is null or to_regprocedure('public.calcular_pontos_resultado(integer,integer,boolean,jsonb)') is null then
   raise exception 'Legacy scoring function is not identifiable. Provide explicit pontuacaoResultado before migration';
  end if;
  active_definition:=pg_get_functiondef(to_regprocedure('public.recalcular_classificacao_liga(integer)'));
  if position('calcular_pontos_resultado' in active_definition)=0 then
   raise exception 'Installed legacy classification uses an unidentified scoring formula. Provide explicit pontuacaoResultado before migration';
  end if;
  if public.calcular_pontos_resultado(2,1,true,null) is distinct from 2 or public.calcular_pontos_resultado(2,1,false,null) is distinct from 1
   or public.calcular_pontos_resultado(2,0,true,null) is distinct from 3 or public.calcular_pontos_resultado(2,0,false,null) is distinct from 0 then
   raise exception 'Installed legacy fallback differs from the reviewed margin mapping. Provide explicit pontuacaoResultado before migration';
  end if;
  if exists(select 1 from "Liga" ll join category_sources_backfill s on s.liga_id=ll.id where ll."pontuacaoResultado" is null and coalesce((to_jsonb(ll)->>'setsPorPartida')::integer,3)<>3) then
   raise exception 'Non-three-set fallback requires explicit scoring mapping before migration';
  end if;
 end if;
end $$;
insert into "CategoriaCampeonato"("ligaId",codigo,nome,slug,ordem,"statusConfiguracao")
select liga_id,codigo,case codigo when 'FEMININO' then 'Feminino' when 'FEMININO_MASTER' then 'Feminino Master' when 'MASCULINO' then 'Masculino' when 'MASCULINO_MASTER' then 'Masculino Master' else 'Misto' end,
 lower(replace(codigo,'_','-')),row_number() over(partition by liga_id order by codigo)-1,'COPIADA_REVISAR'
from (select distinct * from category_sources_backfill) s;
drop table category_sources_backfill;
-- Copy only configuration fields by matching the explicit destination schema.
-- Unknown source columns are ignored; absent columns retain destination defaults.
do $$ declare c record; k record; payload jsonb; cols text; vals text; begin
 for c in select cc.id,cc."ligaId",to_jsonb(l) data from "CategoriaCampeonato" cc join "Liga" l on l.id=cc."ligaId" loop
  insert into "CategoriaConfiguracao"("categoriaCampeonatoId","ligaId") values(c.id,c."ligaId");
  payload := c.data - array['id','ligaId','versao','criadoEm','atualizadoEm','diferencaMinimaSet','pontuacaoResultado'];
  for k in select column_name from information_schema.columns where table_schema='public' and table_name='CategoriaConfiguracao' and column_name not in ('categoriaCampeonatoId','ligaId','versao','criadoEm','atualizadoEm','diferencaMinimaSet','pontuacaoResultado') loop
   if payload ? k.column_name and payload->k.column_name <> 'null'::jsonb then
    if k.column_name='formato' and payload->>k.column_name='COPA_CURTA' then payload:=jsonb_set(payload,array[k.column_name],'"MATA_MATA"'); end if;
    if k.column_name='formato' and payload->>k.column_name='GRUPOS' then payload:=jsonb_set(payload,array[k.column_name],'"GRUPOS_MATA_MATA"'); end if;
    execute format('update "CategoriaConfiguracao" set %I = (jsonb_populate_record(null::"CategoriaConfiguracao",$1)).%I where "categoriaCampeonatoId"=$2',k.column_name,k.column_name) using jsonb_build_object(k.column_name,payload->k.column_name),c.id;
   end if;
  end loop;
 end loop;
end $$;
-- Exact-score rules must agree inside each new margin bucket. Never discard
-- divergent legacy scoring or silently replace it with the new defaults.
do $$ declare c record; rules jsonb; bucket integer; win integer; lose integer; begin
 for c in select cc.id,l."pontuacaoResultado",(to_jsonb(l)->>'setsPorPartida')::integer as "setsPorPartida" from "CategoriaCampeonato" cc join "Liga" l on l.id=cc."ligaId" loop
  rules:=c."pontuacaoResultado";
  if rules is null then
   if coalesce(c."setsPorPartida",3)>3 then
    raise exception 'Legacy five-set fallback differs from margin scoring: explicit scoring mapping required';
   end if;
   continue;
  end if;
  if jsonb_typeof(rules)<>'array' or jsonb_array_length(rules)=0 then raise exception 'Invalid legacy scoring configuration'; end if;
  for bucket in 1..2 loop
   if (select count(distinct jsonb_build_array(r->'pontosVencedor',r->'pontosPerdedor')) from jsonb_array_elements(rules) r where least((r->>'setsVencedor')::int-(r->>'setsPerdedor')::int,2)=bucket)<>1 then
    raise exception 'Missing or conflicting legacy margin %; explicit scoring mapping required',bucket;
   end if;
   select (r->>'pontosVencedor')::int,(r->>'pontosPerdedor')::int into win,lose from jsonb_array_elements(rules) r where least((r->>'setsVencedor')::int-(r->>'setsPerdedor')::int,2)=bucket limit 1;
   if win is null or lose is null then raise exception 'Missing legacy score points'; end if;
   if bucket=1 then update "CategoriaConfiguracao" set "pontosVencedorMargem1"=win,"pontosPerdedorMargem1"=lose where "categoriaCampeonatoId"=c.id;
   else update "CategoriaConfiguracao" set "pontosVencedorMargem2"=win,"pontosPerdedorMargem2"=lose where "categoriaCampeonatoId"=c.id; end if;
  end loop;
  update "CategoriaConfiguracao" set "pontuacaoResultado"=rules where "categoriaCampeonatoId"=c.id;
 end loop;
end $$;
do $$ declare t text; begin
 foreach t in array array['Equipe','Partida','InscricaoEquipeRascunho','CandidaturaEquipe','Premiacao'] loop
  execute format('update %I t set "categoriaCampeonatoId"=c.id from "CategoriaCampeonato" c where c."ligaId"=t."ligaId" and c.codigo=t.categoria',t);
 end loop;
 foreach t in array array['InscricaoCampeonato','ClassificacaoEntrada','ClassificacaoEliminatoria','GrupoEquipeCampeonato'] loop
  execute format('update %I t set "categoriaCampeonatoId"=e."categoriaCampeonatoId", "ligaId"=coalesce(t."ligaId",e."ligaId") from "Equipe" e where e.id=t."equipeId" and (t."ligaId" is null or t."ligaId"=e."ligaId")',t);
 end loop;
end $$;
update "VotoMVP" v set "categoriaCampeonatoId"=e."categoriaCampeonatoId","ligaId"=e."ligaId" from "Jogador" j join "Equipe" e on e.id=j."equipeId" where j.id=v."jogadorId";
-- Drafts inherited a blanket category. The team is the source of the category.
update "InscricaoEquipeRascunho" r set "ligaId"=e."ligaId", categoria=e.categoria, "categoriaCampeonatoId"=e."categoriaCampeonatoId"
from "Equipe" e where e.id=r."equipeId" and (r."ligaId" is distinct from e."ligaId" or r."categoriaCampeonatoId" is distinct from e."categoriaCampeonatoId");
do $$ begin
 if exists(select 1 from "GrupoEquipeCampeonato" group by "grupoId" having count(distinct "categoriaCampeonatoId")>1) then raise exception 'Mixed legacy groups require explicit resolution'; end if;
end $$;
update "GrupoCampeonato" g set "categoriaCampeonatoId"=x.cid from (select distinct "grupoId","categoriaCampeonatoId" cid from "GrupoEquipeCampeonato") x where x."grupoId"=g.id;
-- An empty group is mappable only when the championship has exactly one category.
update "GrupoCampeonato" g set "categoriaCampeonatoId"=c.id from "CategoriaCampeonato" c where c."ligaId"=g."ligaId" and g."categoriaCampeonatoId" is null and (select count(*) from "CategoriaCampeonato" z where z."ligaId"=g."ligaId")=1;
do $$ declare t text; begin
 foreach t in array array['Equipe','InscricaoEquipeRascunho','InscricaoCampeonato','GrupoCampeonato','GrupoEquipeCampeonato','Partida','ClassificacaoEntrada','ClassificacaoEliminatoria','Premiacao','VotoMVP','CandidaturaEquipe'] loop
  execute format('alter table %I alter column "categoriaCampeonatoId" set not null, alter column "ligaId" set not null',t);
 end loop;
end $$;
alter table "Equipe" add constraint equipe_scope_unique unique(id,"categoriaCampeonatoId","ligaId");
alter table "Equipe" add constraint equipe_category_name_unique unique("categoriaCampeonatoId",nome);
alter table "InscricaoEquipeRascunho" add constraint formulario_equipe_scope_fk foreign key("equipeId","categoriaCampeonatoId","ligaId") references "Equipe"(id,"categoriaCampeonatoId","ligaId");
alter table "CandidaturaEquipe" add constraint candidatura_equipe_scope_fk foreign key("equipeId","categoriaCampeonatoId","ligaId") references "Equipe"(id,"categoriaCampeonatoId","ligaId");
alter table "InscricaoCampeonato" add unique(id,"categoriaCampeonatoId","ligaId");
alter table "InscricaoEquipeRascunho" add unique("equipeId","categoriaCampeonatoId","ligaId"), add unique("inscricaoCampeonatoId","categoriaCampeonatoId","ligaId");
alter table "CandidaturaEquipe" add unique("equipeId","categoriaCampeonatoId","ligaId");
alter table "InscricaoEquipeRascunho" add constraint formulario_inscricao_scope_fk foreign key("inscricaoCampeonatoId","categoriaCampeonatoId","ligaId") references "InscricaoCampeonato"(id,"categoriaCampeonatoId","ligaId");
alter table "GrupoCampeonato" add constraint grupo_scope_unique unique(id,"categoriaCampeonatoId","ligaId");
alter table "GrupoCampeonato" drop constraint if exists "GrupoCampeonato_liga_nome_key";
alter table "GrupoCampeonato" add unique("categoriaCampeonatoId",nome);
do $$ declare t text; begin
 foreach t in array array['InscricaoCampeonato','ClassificacaoEntrada','ClassificacaoEliminatoria','GrupoEquipeCampeonato'] loop
  execute format('alter table %I add constraint %I foreign key ("equipeId","categoriaCampeonatoId","ligaId") references "Equipe"(id,"categoriaCampeonatoId","ligaId")',t,t||'_equipe_scope_fk');
 end loop;
end $$;
alter table "GrupoEquipeCampeonato" add foreign key("grupoId","categoriaCampeonatoId","ligaId") references "GrupoCampeonato"(id,"categoriaCampeonatoId","ligaId");
alter table "Partida" add foreign key("equipeAId","categoriaCampeonatoId","ligaId") references "Equipe"(id,"categoriaCampeonatoId","ligaId"),
 add foreign key("equipeBId","categoriaCampeonatoId","ligaId") references "Equipe"(id,"categoriaCampeonatoId","ligaId"),
 add foreign key("grupoId","categoriaCampeonatoId","ligaId") references "GrupoCampeonato"(id,"categoriaCampeonatoId","ligaId"),
 add check("equipeAId"<>"equipeBId"), add check("vencedorId" is null or "vencedorId" in ("equipeAId","equipeBId"));
-- Fix the old player-draft timestamp trigger in a new migration.
create or replace function public.touch_inscricao_equipe_jogador_rascunho() returns trigger language plpgsql set search_path=public as $$ begin new."atualizadoEm":=now(); return new; end $$;
drop trigger if exists "InscricaoEquipeJogadorRascunho_touch" on "InscricaoEquipeJogadorRascunho";
create trigger "InscricaoEquipeJogadorRascunho_touch" before update on "InscricaoEquipeJogadorRascunho" for each row execute function public.touch_inscricao_equipe_jogador_rascunho();
