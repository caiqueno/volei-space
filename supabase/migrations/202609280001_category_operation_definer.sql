create or replace function public.touch_category_operation() returns trigger language plpgsql security definer set search_path=public as $$
declare payload jsonb; cid uuid; begin
 payload:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 cid:=(payload->>'categoriaCampeonatoId')::uuid;
 if cid is null and payload ? 'partidaId' then select "categoriaCampeonatoId" into cid from "Partida" where id=(payload->>'partidaId')::integer; end if;
 if cid is null and payload ? 'inscricaoRascunhoId' then select "categoriaCampeonatoId" into cid from "InscricaoEquipeRascunho" where id=(payload->>'inscricaoRascunhoId')::uuid; end if;
 if cid is null and payload ? 'equipeId' then select "categoriaCampeonatoId" into cid from "Equipe" where id=(payload->>'equipeId')::integer; end if;
 if cid is null and tg_op='DELETE' and pg_trigger_depth()>1 then return old; end if;
 if cid is null then raise exception 'Operational write requires a category'; end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,0));
 update "CategoriaCampeonato" set "revisaoOperacional"="revisaoOperacional"+1 where id=cid;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;

create or replace function public.touch_category_configuration() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new."categoriaCampeonatoId"<>old."categoriaCampeonatoId" or new."ligaId"<>old."ligaId" then raise exception 'Configuration category is immutable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new."categoriaCampeonatoId"::text,0));
 new.versao:=old.versao+1; new."atualizadoEm":=now();
 update "CategoriaCampeonato" set versao=new.versao,"atualizadoEm"=now() where id=new."categoriaCampeonatoId";
 return new;
end $$;
