begin;
create or replace function public.classificar_equipe_categoria(p_liga_id integer,p_categoria_id uuid,p_equipe_id integer,p_organizador_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cfg "CategoriaConfiguracao"; required integer; registered integer; result jsonb; begin
 if not exists(select 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id) then raise exception 'Acesso negado' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_categoria_id::text,0));
 select * into strict cfg from "CategoriaConfiguracao" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id;
 if exists(select 1 from "Partida" where "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and fase is not null and fase<>'GRUPOS') then raise exception 'Chaveamento ja iniciado' using errcode='55000'; end if;
 if not exists(select 1 from "Equipe" where id=p_equipe_id and "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id and "statusEquipe"='ATIVA') then raise exception 'Equipe fora da categoria' using errcode='23514'; end if;
 required:=case cfg."faseEliminatoria" when 'FINAL' then 2 when 'SEMIFINAL' then 4 when 'QUARTAS' then 8 when 'OITAVAS' then 16 when 'DEZESSEIS_AVOS' then 32 else 0 end;
 select count(*) into registered from classificados_categoria(p_liga_id,p_categoria_id);
 if required=0 or registered>=required or exists(select 1 from classificados_categoria(p_liga_id,p_categoria_id) c where c."equipeId"=p_equipe_id) then raise exception 'Vagas preenchidas ou equipe ja classificada' using errcode='55000'; end if;
 insert into "ClassificacaoEliminatoria"("ligaId","categoriaCampeonatoId","equipeId","organizadorId",origem) values(p_liga_id,p_categoria_id,p_equipe_id,p_organizador_id,'MANUAL') returning to_jsonb("ClassificacaoEliminatoria".*) into result;
 return result;
end $$;
revoke all on function public.classificar_equipe_categoria(integer,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.classificar_equipe_categoria(integer,uuid,integer,text) to service_role;
commit;
