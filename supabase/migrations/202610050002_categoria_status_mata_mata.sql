-- Mata-mata e copa curta não exigem a seção de classificação para ficarem parametrizados.
create or replace function public.salvar_configuracao_categoria(p_liga_id integer,p_categoria_id uuid,p_organizador_id text,p_versao integer,p_secao text,p_patch jsonb,p_concluir boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare allowed text[]; assignments text; cfg "CategoriaConfiguracao"; effective jsonb; previous_version integer; dependent_sections text[]:=array[]::text[]; begin
 if not exists(select 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id) then raise exception 'Acesso negado' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_categoria_id::text,0));
 select * into strict cfg from "CategoriaConfiguracao" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id for update;
 if cfg.versao is distinct from p_versao then raise exception 'Versao alterada' using errcode='40001'; end if;
 allowed:=case p_secao when 'estrutura' then array['quantidadeEquipes','quantidadeEquipesMinima','quantidadeEquipesMaxima','formato','quantidadeGrupos','turnoReturno','setsFormato','setsPorPartida','pontosPorSet','diferencaMinimaSet','tieBreakUltimoSet','pontosUltimoSet','terceiroSetObrigatorio','sumulaScoutsEnabled']
when 'classificacao' then array['criteriosClassificacao','classificadosPorGrupo','melhoresClassificadosGerais','pontosVencedorMargem1','pontosPerdedorMargem1','pontosVencedorMargem2','pontosPerdedorMargem2']
when 'eliminatorias' then array['faseEliminatoria','metodoChaveamento','eliminatoriaIdaVolta','disputaTerceiroLugar','goldenSet']
when 'calendario' then array['dataInicio','dataFim']
when 'inscricoes' then array['inscricoesAbertas','inscricoesAberturaEm','inscricoesEncerramentoEm','inscricaoPermiteEdicaoAposEnvio','inscricaoPrazoEdicaoDias','elencoQuantidadeMinima','elencoQuantidadeMaxima','elencoCadastroDuranteInscricao','prazoAlteracaoElencoDias','qrCodeEnabled','formularioInscricaoConfig'] else null end;
 if allowed is null or jsonb_typeof(p_patch) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_patch) k where not(k=any(allowed))) then raise exception 'Campos invalidos' using errcode='23514'; end if;
 previous_version:=cfg.versao;
 -- Reconfirming an unchanged section must not change configuration or invalidate peers.
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into p_patch from jsonb_each(p_patch) where value is distinct from to_jsonb(cfg)->key;
 if p_secao='estrutura' and p_patch ?| array['quantidadeEquipes','quantidadeEquipesMinima','quantidadeEquipesMaxima','formato','quantidadeGrupos','turnoReturno'] then dependent_sections:=array['classificacao','eliminatorias','calendario','inscricoes'];
 elsif p_secao='estrutura' and p_patch ?| array['setsFormato','setsPorPartida','pontosPorSet','tieBreakUltimoSet','pontosUltimoSet','terceiroSetObrigatorio'] then dependent_sections:=array['classificacao','eliminatorias'];
 elsif p_secao='classificacao' and p_patch ?| array['classificadosPorGrupo','melhoresClassificadosGerais'] then dependent_sections:=array['eliminatorias'];
 elsif p_secao='eliminatorias' and p_patch<>'{}'::jsonb then dependent_sections:=array['classificacao','calendario'];
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
notify pgrst, 'reload schema';
