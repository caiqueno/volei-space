begin;
create unique index "CategoriaReplicacao_operacao_destino_key" on "CategoriaReplicacaoAuditoria"("operacaoId","destinoCategoriaId");
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
 when 'eliminatorias' then array['faseEliminatoria','metodoChaveamento','eliminatoriaIdaVolta','disputaTerceiroLugar','goldenSet']
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
 if (p_plano->>'mode'='empty-only' and (cat."statusConfiguracao"<>'NAO_INICIADA' or cfg.versao>1 or exists(select 1 from "CategoriaSetupSecao" where "categoriaCampeonatoId"=cid and status<>'not-started'))) or exists(select 1 from "InscricaoEquipeRascunho" where "categoriaCampeonatoId"=cid) or exists(select 1 from "Equipe" where "categoriaCampeonatoId"=cid) or exists(select 1 from "GrupoEquipeCampeonato" where "categoriaCampeonatoId"=cid) or exists(select 1 from "Partida" where "categoriaCampeonatoId"=cid) then raise exception 'Destino possui operacoes' using errcode='55000'; end if;
 effective:=to_jsonb(cfg)||patch;
 select string_agg(format('%I=r.%I',k,k),',') into assignments from jsonb_object_keys(patch) k;
 execute format('update "CategoriaConfiguracao" c set %s from jsonb_populate_record(null::"CategoriaConfiguracao",$1) r where c."categoriaCampeonatoId"=$2 returning c.*',assignments) into cfg using effective,cid;
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
commit;
