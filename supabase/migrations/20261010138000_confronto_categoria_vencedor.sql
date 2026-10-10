-- A função instalada em 202609230004 ignora vencedorId: WO 0x0 não avança.
-- Esta versão usa o vencedor gravado e, sem ele, o placar de sets.
-- Não foi aplicada em produção nem em desenvolvimento.
-- O prefixo 20261010138000 fica depois de 20261010137000 (súmula transacional) e antes de 20261010140000, para a migration de RLS continuar por último.

begin;

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
  select array_agg(case
    when "vencedorId"="equipeAId" then "equipeBId"
    when "vencedorId"="equipeBId" then "equipeAId"
    when "setsPorA">"setsPorB" then "equipeBId"
    else "equipeAId"
  end) into eligible from "Partida"
   where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and fase='SEMIFINAL' and rodada in(1,2)
    and status in('ENCERRADA','WO')
    and ("vencedorId" in ("equipeAId","equipeBId") or "setsPorA"<>"setsPorB");
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
   select array_agg(case
     when "vencedorId"="equipeAId" then "equipeAId"
     when "vencedorId"="equipeBId" then "equipeBId"
     when "setsPorA">"setsPorB" then "equipeAId"
     else "equipeBId"
   end) into eligible from "Partida"
    where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and fase=phases[phase_idx-1] and rodada in(p_rodada*2-1,p_rodada*2)
     and status in('ENCERRADA','WO')
     and ("vencedorId" in ("equipeAId","equipeBId") or "setsPorA"<>"setsPorB");
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

revoke all on function public.criar_confronto_categoria(integer,uuid,text,integer,integer,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.criar_confronto_categoria(integer,uuid,text,integer,integer,text,integer,integer,integer) to service_role;

commit;
