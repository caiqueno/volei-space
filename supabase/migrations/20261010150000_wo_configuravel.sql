-- W.O. com placar e punição opcionais. Null no placar mantém o comportamento
-- atual: vitória, zero sets e a faixa de margem de 2 ou mais. Punição 0 não tira ponto.
-- Não apaga linha. Não concede a anon nem a authenticated. Não foi aplicada.

alter table public."Liga" add column if not exists "woSetsVencedor" integer;
alter table public."Liga" add column if not exists "woSetsPerdedor" integer;
alter table public."Liga" add column if not exists "woPontosSetVencedor" integer;
alter table public."Liga" add column if not exists "woPontosSetPerdedor" integer;
alter table public."Liga" add column if not exists "woPunicaoPontos" integer default 0;

alter table public."CategoriaConfiguracao" add column if not exists "woSetsVencedor" integer;
alter table public."CategoriaConfiguracao" add column if not exists "woSetsPerdedor" integer;
alter table public."CategoriaConfiguracao" add column if not exists "woPontosSetVencedor" integer;
alter table public."CategoriaConfiguracao" add column if not exists "woPontosSetPerdedor" integer;
alter table public."CategoriaConfiguracao" add column if not exists "woPunicaoPontos" integer default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'Liga_wo_check' and conrelid = 'public."Liga"'::regclass
  ) then
    alter table public."Liga" add constraint "Liga_wo_check" check (
      ("woSetsVencedor" is null or "woSetsVencedor" between 1 and 5)
      and ("woSetsPerdedor" is null or "woSetsPerdedor" between 0 and 5)
      and ("woPontosSetVencedor" is null or "woPontosSetVencedor" between 0 and 99)
      and ("woPontosSetPerdedor" is null or "woPontosSetPerdedor" between 0 and 99)
      and ("woPunicaoPontos" is null or "woPunicaoPontos" between 0 and 20)
    );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'CategoriaConfiguracao_wo_check' and conrelid = 'public."CategoriaConfiguracao"'::regclass
  ) then
    alter table public."CategoriaConfiguracao" add constraint "CategoriaConfiguracao_wo_check" check (
      ("woSetsVencedor" is null or "woSetsVencedor" between 1 and 5)
      and ("woSetsPerdedor" is null or "woSetsPerdedor" between 0 and 5)
      and ("woPontosSetVencedor" is null or "woPontosSetVencedor" between 0 and 99)
      and ("woPontosSetPerdedor" is null or "woPontosSetPerdedor" between 0 and 99)
      and ("woPunicaoPontos" is null or "woPunicaoPontos" between 0 and 20)
    );
  end if;
end $$;

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
      when 'SET_AVERAGE' then '(case when sets_contra = 0 then case when sets_pro > 0 then 1000000000 else 0 end else sets_pro::numeric / sets_contra end) desc'
      when 'POINT_AVERAGE' then '(case when pontos_contra = 0 then case when pontos_pro > 0 then 1000000000 else 0 end else pontos_pro::numeric / pontos_contra end) desc'
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
        and p.status is distinct from ''WO''
    ),
    wo_rows as (
      select
        p."equipeAId",
        p."equipeBId",
        p."vencedorId",
        case when $12::int is null then 0 else $12::int end sets_v,
        case when $12::int is null then 0 else coalesce($13::int, 0) end sets_p,
        case when $12::int is null then 0 else $12::int * coalesce($14::int, 0) end pontos_v,
        case when $12::int is null then 0 else $12::int * coalesce($15::int, 0) end pontos_p,
        coalesce($16::int, 0) punicao
      from "Partida" p
      where p."ligaId" = $1
        and p."categoriaCampeonatoId" = $2
        and coalesce(p.fase, ''GERAL'') in (''GERAL'', ''GRUPOS'')
        and p.status = ''WO''
        and p."vencedorId" is not null
    ),
    events as (
      select "equipeAId" eid, sa sf, sb sc, pa pf, pb pc, (sa > sb) venceu, 0 punicao from matches where sa <> sb
      union all
      select "equipeBId", sb, sa, pb, pa, (sb > sa), 0 from matches where sa <> sb
      union all
      select case when "vencedorId" = "equipeAId" then "equipeAId" else "equipeBId" end,
        sets_v, sets_p, pontos_v, pontos_p, true, 0
      from wo_rows
      union all
      select case when "vencedorId" = "equipeAId" then "equipeBId" else "equipeAId" end,
        sets_p, sets_v, pontos_p, pontos_v, false, punicao
      from wo_rows
    ),
    finished as (
      select e.eid equipe_id,
        count(*)::int jogos,
        count(*) filter (where venceu)::int vitorias,
        count(*) filter (where not venceu)::int derrotas,
        coalesce(sum(sf), 0)::int sets_pro,
        coalesce(sum(sc), 0)::int sets_contra,
        coalesce(sum(pf), 0)::int pontos_pro,
        coalesce(sum(pc), 0)::int pontos_contra,
        coalesce(sum(case
          when venceu and sf = sc then $5
          when not venceu and sf = sc then $6
          when sf > sc then case when sf - sc = 1 then $3 else $5 end
          when sf < sc then case when sc - sf = 1 then $4 else $6 end
          else 0
        end), 0)::int - coalesce(sum(punicao), 0)::int pontos,
        coalesce(sum(punicao), 0)::int punicoes
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
    sancoes as (
      select j."equipeId" eid,
        coalesce(sum(case o.tipo
          when ''PENALIDADE'' then 1
          when ''EXPULSAO'' then 1
          when ''DESQUALIFICACAO'' then 2
          when ''CARTAO_VERMELHO'' then 1
          else 0
        end), 0)::int peso
      from "OcorrenciaPartida" o
      join "Partida" p on p.id = o."partidaId"
      join "Jogador" j on j.id = o."jogadorId"
      where p."ligaId" = $1
        and p."categoriaCampeonatoId" = $2
        and coalesce(p.fase, ''GERAL'') in (''GERAL'', ''GRUPOS'')
      group by j."equipeId"
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
        coalesce(f.pontos, 0) pontos,
        coalesce(f.punicoes, 0) + coalesce(s.peso, 0) punicoes
      from teams t
      left join finished f on f.equipe_id = t.id
      left join live l on l.eid = t.id
      left join sancoes s on s.eid = t.id
    ),
    ranked as (
      select *, row_number() over (order by ' || ordering || ') posicao
      from totals
    )
    insert into "ClassificacaoEntrada" (
      "ligaId", "categoriaCampeonatoId", "equipeId", categoria, posicao, pontos, jogos, vitorias, derrotas,
      "setsPro", "setsContra", "pontosPro", "pontosContra", punicoes, "atualizadoEm"
    )
    select $1, $2, equipe_id, '''', posicao, pontos, jogos, vitorias, derrotas, sets_pro, sets_contra, pontos_pro, pontos_contra, punicoes, now()
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
      punicoes = excluded.punicoes,
      "atualizadoEm" = now()'
  using p_liga_id, p_categoria_id,
    cfg."pontosVencedorMargem1", cfg."pontosPerdedorMargem1", cfg."pontosVencedorMargem2", cfg."pontosPerdedorMargem2",
    pontos_set, sets_partida, pontos_ultimo, tie_break, diferenca,
    cfg."woSetsVencedor", cfg."woSetsPerdedor", cfg."woPontosSetVencedor", cfg."woPontosSetPerdedor", cfg."woPunicaoPontos";

  delete from "ClassificacaoEntrada" ce
  where ce."ligaId" = p_liga_id
    and ce."categoriaCampeonatoId" = p_categoria_id
    and not exists (
      select 1 from "Equipe" e where e.id = ce."equipeId" and e."statusEquipe" = 'ATIVA'
    );
end
$function$;

revoke all on function public.recalcular_classificacao_categoria(integer, uuid) from public, anon, authenticated;
grant execute on function public.recalcular_classificacao_categoria(integer, uuid) to service_role;

create or replace function public.salvar_configuracao_categoria(p_liga_id integer,p_categoria_id uuid,p_organizador_id text,p_versao integer,p_secao text,p_patch jsonb,p_concluir boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare allowed text[]; assignments text; cfg "CategoriaConfiguracao"; effective jsonb; previous_version integer; dependent_sections text[]:=array[]::text[]; begin
 if not exists(select 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id) then raise exception 'Acesso negado' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_categoria_id::text,0));
 select * into strict cfg from "CategoriaConfiguracao" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id for update;
 if cfg.versao is distinct from p_versao then raise exception 'Versao alterada' using errcode='40001'; end if;
 allowed:=case p_secao when 'estrutura' then array['quantidadeEquipes','quantidadeEquipesMinima','quantidadeEquipesMaxima','formato','quantidadeGrupos','turnoReturno','setsFormato','setsPorPartida','pontosPorSet','diferencaMinimaSet','tieBreakUltimoSet','pontosUltimoSet','terceiroSetObrigatorio','sumulaScoutsEnabled']
when 'classificacao' then array['criteriosClassificacao','classificadosPorGrupo','melhoresClassificadosGerais','pontosVencedorMargem1','pontosPerdedorMargem1','pontosVencedorMargem2','pontosPerdedorMargem2','woSetsVencedor','woSetsPerdedor','woPontosSetVencedor','woPontosSetPerdedor','woPunicaoPontos']
when 'eliminatorias' then array['faseEliminatoria','metodoChaveamento','eliminatoriaIdaVolta','disputaTerceiroLugar','goldenSet','setsPorPartidaFinal','setsPorPartidaSemifinal','setsPorPartidaTerceiroLugar']
when 'calendario' then array['dataInicio','dataFim']
when 'inscricoes' then array['inscricoesAbertas','inscricoesAberturaEm','inscricoesEncerramentoEm','inscricaoPermiteEdicaoAposEnvio','inscricaoPrazoEdicaoDias','elencoQuantidadeMinima','elencoQuantidadeMaxima','elencoCadastroDuranteInscricao','prazoAlteracaoElencoDias','qrCodeEnabled','formularioInscricaoConfig'] else null end;
 if allowed is null or jsonb_typeof(p_patch) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_patch) k where not(k=any(allowed))) then raise exception 'Campos invalidos' using errcode='23514'; end if;
 previous_version:=cfg.versao;
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
