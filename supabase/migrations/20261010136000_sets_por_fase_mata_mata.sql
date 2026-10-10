-- Quantidade de sets da final, da semifinal e do 3º lugar.
-- Null herda setsPorPartida. Idempotente: não apaga linha e pode rodar de novo.
-- Não concede a anon nem a authenticated.

alter table public."Liga" add column if not exists "setsPorPartidaFinal" integer;
alter table public."Liga" add column if not exists "setsPorPartidaSemifinal" integer;
alter table public."Liga" add column if not exists "setsPorPartidaTerceiroLugar" integer;

alter table public."CategoriaConfiguracao" add column if not exists "setsPorPartidaFinal" integer;
alter table public."CategoriaConfiguracao" add column if not exists "setsPorPartidaSemifinal" integer;
alter table public."CategoriaConfiguracao" add column if not exists "setsPorPartidaTerceiroLugar" integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Liga_sets_por_fase_check'
      and conrelid = 'public."Liga"'::regclass
  ) then
    alter table public."Liga" add constraint "Liga_sets_por_fase_check" check (
      ("setsPorPartidaFinal" is null or "setsPorPartidaFinal" between 1 and 5)
      and ("setsPorPartidaSemifinal" is null or "setsPorPartidaSemifinal" between 1 and 5)
      and ("setsPorPartidaTerceiroLugar" is null or "setsPorPartidaTerceiroLugar" between 1 and 5)
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'CategoriaConfiguracao_sets_por_fase_check'
      and conrelid = 'public."CategoriaConfiguracao"'::regclass
  ) then
    alter table public."CategoriaConfiguracao" add constraint "CategoriaConfiguracao_sets_por_fase_check" check (
      ("setsPorPartidaFinal" is null or "setsPorPartidaFinal" between 1 and 5)
      and ("setsPorPartidaSemifinal" is null or "setsPorPartidaSemifinal" between 1 and 5)
      and ("setsPorPartidaTerceiroLugar" is null or "setsPorPartidaTerceiroLugar" between 1 and 5)
    );
  end if;
end $$;

create or replace function public.salvar_configuracao_categoria(p_liga_id integer,p_categoria_id uuid,p_organizador_id text,p_versao integer,p_secao text,p_patch jsonb,p_concluir boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare allowed text[]; assignments text; cfg "CategoriaConfiguracao"; effective jsonb; previous_version integer; dependent_sections text[]:=array[]::text[]; begin
 if not exists(select 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id) then raise exception 'Acesso negado' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_categoria_id::text,0));
 select * into strict cfg from "CategoriaConfiguracao" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id for update;
 if cfg.versao is distinct from p_versao then raise exception 'Versao alterada' using errcode='40001'; end if;
 allowed:=case p_secao when 'estrutura' then array['quantidadeEquipes','quantidadeEquipesMinima','quantidadeEquipesMaxima','formato','quantidadeGrupos','turnoReturno','setsFormato','setsPorPartida','pontosPorSet','diferencaMinimaSet','tieBreakUltimoSet','pontosUltimoSet','terceiroSetObrigatorio','sumulaScoutsEnabled']
when 'classificacao' then array['criteriosClassificacao','classificadosPorGrupo','melhoresClassificadosGerais','pontosVencedorMargem1','pontosPerdedorMargem1','pontosVencedorMargem2','pontosPerdedorMargem2']
when 'eliminatorias' then array['faseEliminatoria','metodoChaveamento','eliminatoriaIdaVolta','disputaTerceiroLugar','goldenSet','setsPorPartidaFinal','setsPorPartidaSemifinal','setsPorPartidaTerceiroLugar']
when 'calendario' then array['dataInicio','dataFim']
when 'inscricoes' then array['inscricoesAbertas','inscricoesAberturaEm','inscricoesEncerramentoEm','inscricaoPermiteEdicaoAposEnvio','inscricaoPrazoEdicaoDias','elencoQuantidadeMinima','elencoQuantidadeMaxima','elencoCadastroDuranteInscricao','prazoAlteracaoElencoDias','qrCodeEnabled','formularioInscricaoConfig'] else null end;
 if allowed is null or jsonb_typeof(p_patch) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_patch) k where not(k=any(allowed))) then raise exception 'Campos invalidos' using errcode='23514'; end if;
 previous_version:=cfg.versao;
 -- Reconfirming an unchanged section must not change configuration or invalidate peers.
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into p_patch from jsonb_each(p_patch) where value is distinct from to_jsonb(cfg)->key;
 if p_secao='estrutura' and p_patch ?| array['quantidadeEquipes','quantidadeEquipesMinima','quantidadeEquipesMaxima','formato','quantidadeGrupos','turnoReturno'] then dependent_sections:=array['classificacao','eliminatorias','calendario','inscricoes'];
 elsif p_secao='estrutura' and p_patch ?| array['setsFormato','setsPorPartida','pontosPorSet','tieBreakUltimoSet','pontosUltimoSet','terceiroSetObrigatorio'] then dependent_sections:=array['classificacao','eliminatorias'];
 elsif p_secao='classificacao' and p_patch ?| array['classificadosPorGrupo','melhoresClassificadosGerais'] then dependent_sections:=array['eliminatorias'];
 elsif p_secao='eliminatorias' and (p_patch - 'setsPorPartidaFinal' - 'setsPorPartidaSemifinal' - 'setsPorPartidaTerceiroLugar') <> '{}'::jsonb then dependent_sections:=array['classificacao','calendario'];
 end if;
 if p_patch<>'{}'::jsonb and p_secao in ('estrutura','classificacao','eliminatorias') and (exists(select 1 from "InscricaoEquipeRascunho" where "categoriaCampeonatoId"=p_categoria_id) or exists(select 1 from "Equipe" where "categoriaCampeonatoId"=p_categoria_id) or exists(select 1 from "GrupoEquipeCampeonato" where "categoriaCampeonatoId"=p_categoria_id) or exists(select 1 from "Partida" where "categoriaCampeonatoId"=p_categoria_id)) then raise exception 'Operacao iniciada' using errcode='55000'; end if;
 effective:=to_jsonb(cfg)||p_patch;
 if (effective->>'qrCodeEnabled')::boolean and (effective#>>'{formularioInscricaoConfig,atleta,nomeCompleto}' is distinct from 'required' or effective#>>'{formularioInscricaoConfig,atleta,foto}' is distinct from 'required') then raise exception 'QR exige nome e foto' using errcode='23514'; end if;
 if p_concluir and ((p_secao='estrutura' and (effective->>'formato' is null or effective->>'quantidadeEquipes' is null)) or (p_secao='calendario' and (effective->>'dataInicio' is null or effective->>'dataFim' is null))) then raise exception 'Secao incompleta' using errcode='23514'; end if;
 if p_concluir and (effective->>'faseEliminatoria')<>'NENHUMA' and
  ((effective->>'formato')='PONTOS_CORRIDOS' or
   (case when effective->>'formato'='MATA_MATA' then (effective->>'quantidadeEquipes')::integer else coalesce((effective->>'quantidadeGrupos')::integer,0)*coalesce((effective->>'classificadosPorGrupo')::integer,0)+coalesce((effective->>'melhoresClassificadosGerais')::integer,0) end)
    is distinct from (case effective->>'faseEliminatoria' when 'FINAL' then 2 when 'SEMIFINAL' then 4 when 'QUARTAS' then 8 when 'OITAVAS' then 16 when 'DEZESSEIS_AVOS' then 32 end))
 then raise exception 'Classificados incompativeis com chave eliminatoria' using errcode='23514'; end if;
 if p_concluir and (effective->>'quantidadeGrupos')::integer>(effective->>'quantidadeEquipes')::integer then raise exception 'Grupos excedem equipes' using errcode='23514'; end if;
 select string_agg(format('%I=r.%I',k,k),',') into assignments from jsonb_object_keys(p_patch) k;
 if assignments is not null then
 execute format('update "CategoriaConfiguracao" c set %s from jsonb_populate_record(null::"CategoriaConfiguracao",$1) r where c."categoriaCampeonatoId"=$2 and c."ligaId"=$3 returning c.*',assignments) into cfg using effective,p_categoria_id,p_liga_id;
 end if;
 -- A completion only carries forward when its reviewed version was current
 -- and none of its dependencies changed. Previously stale confirmations remain stale.
 update "CategoriaSetupSecao" set status='attention-required',"revisaoConfirmada"=null,"concluidoEm"=null,"atualizadoEm"=now()
 where "categoriaCampeonatoId"=p_categoria_id and status='completed'
 and ("revisaoConfirmada" is distinct from previous_version or secao=any(dependent_sections));
 update "CategoriaSetupSecao" set "revisaoConfirmada"=cfg.versao
 where "categoriaCampeonatoId"=p_categoria_id and status='completed' and "revisaoConfirmada"=previous_version;
 insert into "CategoriaSetupSecao"("ligaId","categoriaCampeonatoId",secao,status,"revisaoConfirmada","concluidoEm") values(p_liga_id,p_categoria_id,p_secao,case when p_concluir then 'completed' else 'in-progress' end,case when p_concluir then cfg.versao else null end,case when p_concluir then now() else null end)
 on conflict("categoriaCampeonatoId",secao) do update set status=excluded.status,"revisaoConfirmada"=excluded."revisaoConfirmada","concluidoEm"=excluded."concluidoEm","atualizadoEm"=now();
 update "CategoriaCampeonato" set "statusConfiguracao"=case when (select count(*) from "CategoriaSetupSecao" where "categoriaCampeonatoId"=p_categoria_id and secao = any(case when coalesce(cfg.formato,'') in ('MATA_MATA','COPA_CURTA') then array['estrutura','eliminatorias','calendario','inscricoes'] else array['estrutura','classificacao','eliminatorias','calendario','inscricoes'] end) and status='completed' and "revisaoConfirmada"=cfg.versao)=(case when coalesce(cfg.formato,'') in ('MATA_MATA','COPA_CURTA') then 4 else 5 end) then 'CONCLUIDA' when exists(select 1 from "CategoriaSetupSecao" where "categoriaCampeonatoId"=p_categoria_id and status='attention-required') then 'ATENCAO_NECESSARIA' else 'EM_ANDAMENTO' end where id=p_categoria_id;
 return to_jsonb(cfg);
end $$;
revoke all on function public.salvar_configuracao_categoria(integer,uuid,text,integer,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.salvar_configuracao_categoria(integer,uuid,text,integer,text,jsonb,boolean) to service_role;

create or replace function public.replicar_configuracao_categorias(p_liga_id integer,p_organizador_id text,p_operacao_id uuid,p_plano jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; src uuid; target jsonb; snapshot_section record; field record; cfg "CategoriaConfiguracao"; cat "CategoriaCampeonato"; patch jsonb; effective jsonb; assignments text; section_name text; copied_status text; allowed text[]; begin
 if not exists(select 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id) or p_plano->>'organizadorId' is distinct from p_organizador_id or (p_plano->>'ligaId')::integer<>p_liga_id then raise exception 'Acesso negado' using errcode='42501'; end if;
 if jsonb_typeof(p_plano) is distinct from 'object' or jsonb_typeof(p_plano->'targets') is distinct from 'array' or jsonb_typeof(p_plano->'snapshot') is distinct from 'object' or (p_plano->>'mode') is null or p_plano->>'mode' not in ('empty-only','replace-sections') then raise exception 'Plano invalido' using errcode='23514'; end if;
 src:=(p_plano->>'sourceId')::uuid;
 if src is null or p_operacao_id is null then raise exception 'Identidade invalida' using errcode='23514'; end if;
 if jsonb_array_length(p_plano->'targets')<1 then raise exception 'Selecione destinos' using errcode='23514'; end if;
 for cid in select id from (select src id union select (value->>'id')::uuid from jsonb_array_elements(p_plano->'targets')) all_ids order by id loop perform pg_advisory_xact_lock(hashtextextended(cid::text,0)); end loop;
 if exists(select 1 from "CategoriaReplicacaoAuditoria" where "operacaoId"=p_operacao_id) then
 if exists(select 1 from "CategoriaReplicacaoAuditoria" where "operacaoId"=p_operacao_id and ("ligaId"<>p_liga_id or "origemCategoriaId"<>src or "usuarioId"<>p_organizador_id or secoes is distinct from p_plano->'sections')) then raise exception 'Operacao divergente' using errcode='23514'; end if;
 return jsonb_build_object('replayed',true); end if;
 select * into strict cat from "CategoriaCampeonato" where id=src and "ligaId"=p_liga_id;
 select * into strict cfg from "CategoriaConfiguracao" where "categoriaCampeonatoId"=src and "ligaId"=p_liga_id;
 if cfg.versao is distinct from (p_plano->>'sourceConfigVersion')::integer or cat."revisaoOperacional" is distinct from (p_plano->>'sourceOperationVersion')::integer then raise exception 'Origem alterada' using errcode='40001'; end if;
 patch:='{}';
 for snapshot_section in select * from jsonb_each(p_plano->'snapshot') loop
 allowed:=case snapshot_section.key
 when 'estrutura' then array['quantidadeEquipes','quantidadeEquipesMinima','quantidadeEquipesMaxima','formato','quantidadeGrupos','nomesGrupos','turnoReturno']
 when 'regras' then array['setsFormato','setsPorPartida','pontosPorSet','tieBreakUltimoSet','pontosUltimoSet','terceiroSetObrigatorio']
 when 'classificacao' then array['criteriosClassificacao','classificadosPorGrupo','melhoresClassificadosGerais','pontosVencedorMargem1','pontosPerdedorMargem1','pontosVencedorMargem2','pontosPerdedorMargem2']
 when 'eliminatorias' then array['faseEliminatoria','metodoChaveamento','eliminatoriaIdaVolta','disputaTerceiroLugar','goldenSet','setsPorPartidaFinal','setsPorPartidaSemifinal','setsPorPartidaTerceiroLugar']
 when 'calendario' then array['dataInicio','dataFim']
 when 'inscricoes' then array['inscricoesAberturaEm','inscricoesEncerramentoEm','inscricaoPermiteEdicaoAposEnvio','inscricaoPrazoEdicaoDias','elencoQuantidadeMinima','elencoQuantidadeMaxima','elencoCadastroDuranteInscricao','prazoAlteracaoElencoDias','formularioInscricaoConfig']
 when 'recursos' then array['qrCodeEnabled','sumulaScoutsEnabled'] else null end;
 if allowed is null then raise exception 'Secao invalida' using errcode='23514'; end if;
 for field in select * from jsonb_each(snapshot_section.value) loop
 if not(field.key=any(allowed)) or field.value is distinct from to_jsonb(cfg)->field.key then raise exception 'Snapshot invalido' using errcode='40001'; end if;
 patch:=patch||jsonb_build_object(field.key,field.value);
 end loop;
 end loop;
 if patch='{}' then raise exception 'Snapshot vazio' using errcode='23514'; end if;
 for target in select value from jsonb_array_elements(p_plano->'targets') loop
 cid:=(target->>'id')::uuid;
 if cid=src then raise exception 'Origem igual destino' using errcode='23514'; end if;
 select * into strict cat from "CategoriaCampeonato" where id=cid and "ligaId"=p_liga_id;
 select * into strict cfg from "CategoriaConfiguracao" where "categoriaCampeonatoId"=cid and "ligaId"=p_liga_id for update;
 if cfg.versao is distinct from (target->>'configVersion')::integer or cat."revisaoOperacional" is distinct from (target->>'operationVersion')::integer then raise exception 'Destino alterado' using errcode='40001'; end if;
 if (p_plano->>'mode')='empty-only' and (
   cat."statusConfiguracao"<>'NAO_INICIADA'
   or cfg.versao>1
   or exists(select 1 from "CategoriaSetupSecao" where "categoriaCampeonatoId"=cid and status<>'not-started')
   or exists(select 1 from "InscricaoEquipeRascunho" where "categoriaCampeonatoId"=cid)
   or exists(select 1 from "Equipe" where "categoriaCampeonatoId"=cid)
   or exists(select 1 from "GrupoEquipeCampeonato" where "categoriaCampeonatoId"=cid)
   or exists(select 1 from "Partida" where "categoriaCampeonatoId"=cid)
 ) then raise exception 'Destino possui operacoes' using errcode='55000'; end if;
 effective:=to_jsonb(cfg)||patch;
 select string_agg(format('%I=r.%I',k,k),',') into assignments from jsonb_object_keys(patch) k;
 execute format('update "CategoriaConfiguracao" c set %s, versao = c.versao + 1 from jsonb_populate_record(null::"CategoriaConfiguracao",$1) r where c."categoriaCampeonatoId"=$2 returning c.*',assignments) into cfg using effective,cid;
 copied_status:=case when target->>'status'='attention-required' then 'attention-required' else 'copied-review' end;
 for section_name in select distinct case key when 'regras' then 'estrutura' when 'recursos' then 'inscricoes' else key end from jsonb_each(p_plano->'snapshot') loop
 insert into "CategoriaSetupSecao"("ligaId","categoriaCampeonatoId",secao,status) values(p_liga_id,cid,section_name,copied_status)
 on conflict("categoriaCampeonatoId",secao) do update set status=excluded.status,"revisaoConfirmada"=null,"concluidoEm"=null,"atualizadoEm"=now();
 end loop;
 update "CategoriaCampeonato" set "statusConfiguracao"=case when copied_status='attention-required' then 'ATENCAO_NECESSARIA' else 'COPIADA_REVISAR' end where id=cid;
 insert into "CategoriaReplicacaoAuditoria"("operacaoId","ligaId","origemCategoriaId","destinoCategoriaId",secoes,"usuarioId","versaoAnterior","versaoResultante") values(p_operacao_id,p_liga_id,src,cid,p_plano->'sections',p_organizador_id,(target->>'configVersion')::integer,cfg.versao);
 end loop;
 return jsonb_build_object('copied',jsonb_array_length(p_plano->'targets'));
end $$;

revoke all on function public.replicar_configuracao_categorias(integer,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.replicar_configuracao_categorias(integer,text,uuid,jsonb) to service_role;

notify pgrst, 'reload schema';
