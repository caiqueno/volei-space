begin;
-- Prisma uuid()/updatedAt were client-generated in some historical baselines.
-- RPC writes need database defaults even when CREATE TABLE IF NOT EXISTS skipped.
alter table "InscricaoEquipeRascunho" alter column id set default gen_random_uuid(), alter column token set default gen_random_uuid(), alter column "atualizadaEm" set default now();
alter table "InscricaoEquipeJogadorRascunho" alter column id set default gen_random_uuid(), alter column "atualizadoEm" set default now();
alter table "InscricaoEquipeJogadorRascunho" add column "chaveCadastro" uuid;
alter table "InscricaoEquipeJogadorRascunho" add unique("inscricaoRascunhoId","chaveCadastro");
alter table "Jogador" add column "chaveCadastro" uuid;
alter table "Jogador" add unique("equipeId","chaveCadastro");
create or replace function public.validar_vinculo_formulario_categoria() returns trigger language plpgsql set search_path=public as $$ begin
 if tg_table_name='InscricaoEquipeRascunho' then
  if exists(select 1 from "InscricaoEquipeRascunho" d left join "InscricaoCampeonato" i on i.id=d."inscricaoCampeonatoId" where d.id=new.id and d.status='CONCLUIDO' and (d."equipeId" is null or i.id is null or i."equipeId" is distinct from d."equipeId")) then raise exception 'Vínculo final do formulário inconsistente.'; end if;
 else
  if exists(select 1 from "InscricaoEquipeJogadorRascunho" r join "InscricaoEquipeRascunho" d on d.id=r."inscricaoRascunhoId" join "Jogador" j on j.id=r."jogadorId" where r.id=new.id and d."equipeId" is distinct from j."equipeId") then raise exception 'Jogador pertence a outro formulário.'; end if;
 end if;
 return null;
end $$;
create constraint trigger formulario_final_scope after insert or update on "InscricaoEquipeRascunho" deferrable initially deferred for each row execute function public.validar_vinculo_formulario_categoria();
create constraint trigger formulario_jogador_scope after insert or update on "InscricaoEquipeJogadorRascunho" deferrable initially deferred for each row execute function public.validar_vinculo_formulario_categoria();
create or replace function public.validar_jogador_formulario_categoria(p_data jsonb,p_config jsonb,p_qr boolean)
returns void language plpgsql set search_path=public as $$ declare pair record; requirement text; begin
 if nullif(btrim(p_data->>'nome'),'') is null then raise exception 'Nome do jogador obrigatório.'; end if;
 for pair in select * from (values ('numeroCamisa','numero','optional'),('posicao','posicao','optional'),('foto','fotoUrl','required'),('cpf','cpf','optional'),('dataNascimento','dataNascimento','required'),('documento','documentoTipo','required'),('documento','documentoNumero','required')) x(field_name,column_name,fallback) loop
  requirement:=coalesce(p_config->'atleta'->>pair.field_name,pair.fallback);
  if (requirement='required' or (p_qr and pair.field_name='foto')) and nullif(btrim(p_data->>pair.column_name),'') is null then raise exception 'Campo obrigatório do jogador: %',pair.field_name; end if;
 end loop;
end $$;
create or replace function public.criar_formulario_categoria(p_liga_id integer,p_categoria_id uuid,p_organizador_id text,p_formulario_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$ declare d "InscricaoEquipeRascunho"; begin
 if not exists(select 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id) then raise exception 'Campeonato não encontrado.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_categoria_id::text,0));
 select * into d from "InscricaoEquipeRascunho" where id=p_formulario_id and "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id;
 if found then return to_jsonb(d)-'serie'; end if;
 if not exists(select 1 from "CategoriaCampeonato" where id=p_categoria_id and "ligaId"=p_liga_id) then raise exception 'Categoria não encontrada.'; end if;
 if not exists(select 1 from "CategoriaCampeonato" where id=p_categoria_id and "statusConfiguracao"='CONCLUIDA') then raise exception 'Conclua a parametrização da categoria antes de disponibilizar formulários.' using errcode='23514'; end if;
 insert into "InscricaoEquipeRascunho"(id,"ligaId","categoriaCampeonatoId",status) values(p_formulario_id,p_liga_id,p_categoria_id,'NAO_INICIADO') on conflict(id) do nothing;
 select * into strict d from "InscricaoEquipeRascunho" where id=p_formulario_id and "ligaId"=p_liga_id and "categoriaCampeonatoId"=p_categoria_id;
 return to_jsonb(d)-'serie';
end $$;
revoke all on function public.criar_formulario_categoria(integer,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.criar_formulario_categoria(integer,uuid,text,uuid) to service_role;

create or replace function public.editar_formulario_categoria(p_token uuid,p_acao text,p_patch jsonb default '{}',p_jogador_id text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d "InscricaoEquipeRascunho"; cfg "CategoriaConfiguracao"; target text; key text; cols text; vals text; result jsonb; payload jsonb; total integer; id_value text; field_name text; requirement text;
begin
 select * into strict d from "InscricaoEquipeRascunho" where token=p_token;
 perform pg_advisory_xact_lock(hashtextextended(d."categoriaCampeonatoId"::text,0));
 select * into strict d from "InscricaoEquipeRascunho" where token=p_token for update;
 select * into strict cfg from "CategoriaConfiguracao" where "categoriaCampeonatoId"=d."categoriaCampeonatoId" and "ligaId"=d."ligaId";
 if p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'Dados inválidos.'; end if;
 if not exists(select 1 from "Liga" where id=d."ligaId" and status in ('EM_BREVE','ATIVA')) then raise exception 'Campeonato encerrado.'; end if;
 if d.status='CONCLUIDO' then
  if not cfg."inscricaoPermiteEdicaoAposEnvio" or (cfg."inscricaoPrazoEdicaoDias" is not null and now()>d."enviadaEm"+make_interval(days=>cfg."inscricaoPrazoEdicaoDias")) then raise exception 'Edição encerrada.'; end if;
  if p_acao<>'equipe' and cfg."prazoAlteracaoElencoDias" is not null and now()>d."enviadaEm"+make_interval(days=>cfg."prazoAlteracaoElencoDias") then raise exception 'Prazo de elenco encerrado.'; end if;
 else
  if not cfg."inscricoesAbertas" or (cfg."inscricoesAberturaEm" is not null and now()<cfg."inscricoesAberturaEm") or (cfg."inscricoesEncerramentoEm" is not null and now()>cfg."inscricoesEncerramentoEm") then raise exception 'Cadastro fechado.'; end if;
  if p_acao<>'equipe' and not cfg."elencoCadastroDuranteInscricao" then raise exception 'Cadastro de atletas desabilitado.'; end if;
 end if;
 if p_acao='equipe' then
  if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('nomeEquipe','logoUrl','lider','tecnico')) then raise exception 'Campo não permitido; categoria é imutável.'; end if;
  if p_patch ? 'nomeEquipe' and length(btrim(coalesce(p_patch->>'nomeEquipe','')))<2 then raise exception 'Informe o nome da equipe.'; end if;
  if cfg."formularioInscricaoConfig"->'equipe'->>'logo'='disabled' then p_patch:=p_patch-'logoUrl'; end if;
  if cfg."formularioInscricaoConfig"->'lider'->>'nomeCompleto'='disabled' then p_patch:=p_patch-'lider'; end if;
  if d.status='CONCLUIDO' then
   select to_jsonb(e) into payload from "Equipe" e where id=d."equipeId";
   payload:=payload||p_patch;
   if coalesce(cfg."formularioInscricaoConfig"->'lider'->>'nomeCompleto','required')='required' and nullif(btrim(payload->>'lider'),'') is null then raise exception 'Nome do responsável obrigatório.'; end if;
   if cfg."formularioInscricaoConfig"->'equipe'->>'logo'='required' and nullif(btrim(payload->>'logoUrl'),'') is null then raise exception 'Logo obrigatório.'; end if;
   update "Equipe" set nome=case when p_patch?'nomeEquipe' then p_patch->>'nomeEquipe' else nome end,
    "logoUrl"=case when p_patch?'logoUrl' then p_patch->>'logoUrl' else "logoUrl" end,
    lider=case when p_patch?'lider' then p_patch->>'lider' else lider end,
    tecnico=case when p_patch?'tecnico' then p_patch->>'tecnico' else tecnico end
   where id=d."equipeId" and "categoriaCampeonatoId"=d."categoriaCampeonatoId";
  else
   update "InscricaoEquipeRascunho" set "nomeEquipe"=case when p_patch?'nomeEquipe' then p_patch->>'nomeEquipe' else "nomeEquipe" end,
    "logoUrl"=case when p_patch?'logoUrl' then p_patch->>'logoUrl' else "logoUrl" end,
    lider=case when p_patch?'lider' then p_patch->>'lider' else lider end,
    tecnico=case when p_patch?'tecnico' then p_patch->>'tecnico' else tecnico end,status='EM_PREENCHIMENTO'
   where id=d.id;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_acao not in ('criarJogador','editarJogador','excluirJogador') then raise exception 'Ação inválida.'; end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('nome','numero','posicao','fotoUrl','cpf','dataNascimento','documentoTipo','documentoNumero','idempotencyKey')) then raise exception 'Campo de jogador não permitido.'; end if;
 target:=case when d.status='CONCLUIDO' then 'Jogador' else 'InscricaoEquipeJogadorRascunho' end;
 if p_acao='criarJogador' then
  if p_patch->>'idempotencyKey' is null then raise exception 'Identificador da operação obrigatório.'; end if;
  if d.status='CONCLUIDO' then select to_jsonb(j) into result from "Jogador" j where j."equipeId"=d."equipeId" and j."chaveCadastro"=(p_patch->>'idempotencyKey')::uuid;
  else select to_jsonb(j) into result from "InscricaoEquipeJogadorRascunho" j where j."inscricaoRascunhoId"=d.id and j."chaveCadastro"=(p_patch->>'idempotencyKey')::uuid; end if;
  if result is not null then return result; end if;
 end if;
 if d.status='CONCLUIDO' then select count(*) into total from "Jogador" where "equipeId"=d."equipeId" and not banido;
 else select count(*) into total from "InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId"=d.id; end if;
 if p_acao='criarJogador' and cfg."elencoQuantidadeMaxima" is not null and total>=cfg."elencoQuantidadeMaxima" then raise exception 'Limite do elenco atingido.'; end if;
 if p_acao='excluirJogador' and d.status='CONCLUIDO' and total<=greatest(coalesce(cfg."elencoQuantidadeMinima",1),1) then raise exception 'O elenco precisa manter a quantidade mínima.'; end if;
 if p_acao<>'criarJogador' then
  if d.status='CONCLUIDO' then select to_jsonb(j) into result from "Jogador" j where j.id::text=p_jogador_id and j."equipeId"=d."equipeId";
  else select to_jsonb(j) into result from "InscricaoEquipeJogadorRascunho" j where j.id::text=p_jogador_id and j."inscricaoRascunhoId"=d.id; end if;
  if result is null then raise exception 'Jogador não encontrado neste formulário.'; end if;
 end if;
 if p_acao='excluirJogador' then
  if d.status='CONCLUIDO' then update "Jogador" set banido=true where id::text=p_jogador_id and "equipeId"=d."equipeId";
  else delete from "InscricaoEquipeJogadorRascunho" where id::text=p_jogador_id and "inscricaoRascunhoId"=d.id; end if;
  return jsonb_build_object('id',p_jogador_id);
 end if;
 payload:=p_patch-'idempotencyKey';
 for key in select jsonb_object_keys(payload) loop
  field_name:=case key when 'numero' then 'numeroCamisa' when 'fotoUrl' then 'foto' when 'documentoTipo' then 'documento' when 'documentoNumero' then 'documento' when 'nome' then 'nomeCompleto' else key end;
  if cfg."formularioInscricaoConfig"->'atleta'->>field_name='disabled' then payload:=payload-key; end if;
 end loop;
 if p_acao='criarJogador' and length(btrim(coalesce(payload->>'nome','')))=0 then raise exception 'Nome do jogador obrigatório.'; end if;
 if p_acao='editarJogador' and payload?'nome' and length(btrim(coalesce(payload->>'nome','')))=0 then raise exception 'Nome do jogador obrigatório.'; end if;
 if d.status='CONCLUIDO' then perform public.validar_jogador_formulario_categoria(coalesce(result,'{}'::jsonb)||payload,cfg."formularioInscricaoConfig",cfg."qrCodeEnabled"); end if;
 if p_acao='criarJogador' then
  payload:=payload||jsonb_build_object('chaveCadastro',p_patch->>'idempotencyKey');
  payload:=payload || case when d.status='CONCLUIDO' then jsonb_build_object('equipeId',d."equipeId",'autoRegistrado',true) else jsonb_build_object('inscricaoRascunhoId',d.id) end;
  select string_agg(format('%I',k),','),string_agg(format('(jsonb_populate_record(null::%I,$1)).%I',target,k),',') into cols,vals from jsonb_object_keys(payload) k;
  execute format('insert into %I (%s) select %s returning to_jsonb(%I.*)',target,cols,vals,target) into result using payload;
 else
  select string_agg(format('%I=(jsonb_populate_record(null::%I,$1)).%I',k,target,k),',') into vals from jsonb_object_keys(payload) k;
  if vals is not null then execute format('update %I set %s where id::text=$2 returning to_jsonb(%I.*)',target,vals,target) into result using payload,p_jogador_id; end if;
 end if;
 if d.status<>'CONCLUIDO' then update "InscricaoEquipeRascunho" set status='EM_PREENCHIMENTO' where id=d.id; end if;
 return result;
end $$;
revoke all on function public.editar_formulario_categoria(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.editar_formulario_categoria(uuid,text,jsonb,text) to service_role;
alter table "Equipe" add column if not exists lider text, add column if not exists tecnico text;
-- Legacy approval states remain readable; all new registration records complete directly.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='"InscricaoCampeonato"'::regclass and contype='c' and pg_get_constraintdef(oid) like '%status%' loop
 execute format('alter table "InscricaoCampeonato" drop constraint %I',c.conname);
 end loop;
end $$;
create or replace function public.finalizar_inscricao_equipe_rascunho(
  p_token uuid,
  p_slug text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public."InscricaoEquipeRascunho"%rowtype;
  v_liga public."CategoriaConfiguracao"%rowtype;
  v_league_status text;
  v_equipe_id integer;
  v_inscricao_id text;
  v_status text;
  v_config jsonb;
  v_jogador record;
  v_jogador_id integer;
  v_total integer;
begin
  select * into v_draft
  from public."InscricaoEquipeRascunho"
  where token = p_token
;

  if not found then raise exception using errcode = 'P0002', message = 'Rascunho nao encontrado.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_draft."categoriaCampeonatoId"::text,0));
  select * into v_draft from "InscricaoEquipeRascunho" where token=p_token for update;
  if v_draft.status = 'CONCLUIDO' then
    return jsonb_build_object(
      'equipeId', v_draft."equipeId",
      'inscricaoCampeonatoId', v_draft."inscricaoCampeonatoId",
      'status', 'CONCLUIDO',
      'idempotent', true
    );
  end if;

  select * into v_liga from "CategoriaConfiguracao" where "categoriaCampeonatoId"=v_draft."categoriaCampeonatoId" and "ligaId"=v_draft."ligaId";
  select status into v_league_status from "Liga" where id=v_draft."ligaId";
  if not found then raise exception using errcode = 'P0002', message = 'Campeonato nao encontrado.'; end if;
  if v_league_status not in ('EM_BREVE', 'ATIVA') or not coalesce(v_liga."inscricoesAbertas", true) then
    raise exception using errcode = 'P0001', message = 'As inscricoes deste campeonato estao fechadas.';
  end if;
  if v_liga."inscricoesAberturaEm" is not null and now() < v_liga."inscricoesAberturaEm" then
    raise exception using errcode = 'P0001', message = 'As inscricoes ainda nao foram abertas.';
  end if;
  if v_liga."inscricoesEncerramentoEm" is not null and now() > v_liga."inscricoesEncerramentoEm" then
    raise exception using errcode = 'P0001', message = 'O prazo de inscricao foi encerrado.';
  end if;

  select count(*) into v_total from public."InscricaoEquipeJogadorRascunho"
  where "inscricaoRascunhoId" = v_draft.id;
  if v_total = 0 then raise exception using errcode = '23514', message = 'Cadastre ao menos um jogador.'; end if;
  if v_liga."elencoQuantidadeMinima" is not null and v_total < v_liga."elencoQuantidadeMinima" then
    raise exception using errcode = '23514', message = 'O elenco nao atingiu a quantidade minima.';
  end if;
  if v_liga."elencoQuantidadeMaxima" is not null and v_total > v_liga."elencoQuantidadeMaxima" then
    raise exception using errcode = '23514', message = 'O elenco excede a quantidade maxima.';
  end if;

  v_status := 'CONCLUIDO';
  if v_liga."quantidadeEquipes" is not null and
     (select count(*) from public."InscricaoCampeonato" where "categoriaCampeonatoId" = v_draft."categoriaCampeonatoId") >= v_liga."quantidadeEquipes" then
    raise exception using errcode = '23514', message = 'O limite de equipes da categoria foi atingido.';
  end if;

  v_config := coalesce(v_liga."formularioInscricaoConfig", '{}'::jsonb);
  if nullif(btrim(v_draft."nomeEquipe"), '') is null or v_draft.categoria is null then
    raise exception using errcode = '23514', message = 'Os dados obrigatorios da equipe estao incompletos.';
  end if;
  if coalesce(v_config->'equipe'->>'logo', 'optional') = 'required' and v_draft."logoUrl" is null then
    raise exception using errcode = '23514', message = 'Logo da equipe e obrigatorio.';
  end if;
  if coalesce(v_config->'lider'->>'nomeCompleto', 'required') = 'required' and nullif(btrim(v_draft.lider), '') is null then
    raise exception using errcode = '23514', message = 'Nome do lider e obrigatorio.';
  end if;
  if coalesce(v_config->'atleta'->>'numeroCamisa', 'optional') = 'required' and exists (
    select 1 from public."InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId" = v_draft.id and numero is null
  ) then raise exception using errcode = '23514', message = 'Numero da camisa e obrigatorio.'; end if;
  if coalesce(v_config->'atleta'->>'posicao', 'optional') = 'required' and exists (
    select 1 from public."InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId" = v_draft.id and nullif(btrim(posicao), '') is null
  ) then raise exception using errcode = '23514', message = 'Posicao do jogador e obrigatoria.'; end if;
  if coalesce(v_config->'atleta'->>'foto', 'required') = 'required' and exists (
    select 1 from public."InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId" = v_draft.id and "fotoUrl" is null
  ) then raise exception using errcode = '23514', message = 'Foto do jogador e obrigatoria.'; end if;
  if coalesce(v_config->'atleta'->>'cpf', 'optional') = 'required' and exists (
    select 1 from public."InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId" = v_draft.id and nullif(btrim(cpf), '') is null
  ) then raise exception using errcode = '23514', message = 'CPF do jogador e obrigatorio.'; end if;
  if coalesce(v_config->'atleta'->>'dataNascimento', 'required') = 'required' and exists (
    select 1 from public."InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId" = v_draft.id and "dataNascimento" is null
  ) then raise exception using errcode = '23514', message = 'Data de nascimento e obrigatoria.'; end if;
  if coalesce(v_config->'atleta'->>'documento', 'required') = 'required' and exists (
    select 1 from public."InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId" = v_draft.id
      and (nullif(btrim("documentoTipo"), '') is null or nullif(btrim("documentoNumero"), '') is null)
  ) then raise exception using errcode = '23514', message = 'Documento do jogador e obrigatorio.'; end if;

  insert into public."Equipe" (
    nome, "ligaId", "categoriaCampeonatoId", categoria, slug, "statusEquipe", "inscricaoAtiva", "logoUrl", lider, tecnico
  ) values (
    v_draft."nomeEquipe", v_draft."ligaId", v_draft."categoriaCampeonatoId", v_draft.categoria, p_slug,
    'ATIVA', true,
    case when coalesce(v_config->'equipe'->>'logo', 'optional') <> 'disabled' then v_draft."logoUrl" end,
    case when coalesce(v_config->'lider'->>'nomeCompleto', 'optional') <> 'disabled' then v_draft.lider end,
    v_draft.tecnico
  ) returning id into v_equipe_id;

  for v_jogador in
    select * from public."InscricaoEquipeJogadorRascunho"
    where "inscricaoRascunhoId" = v_draft.id order by "criadoEm", id
  loop
    perform public.validar_jogador_formulario_categoria(to_jsonb(v_jogador),v_config,v_liga."qrCodeEnabled");
    insert into public."Jogador" (
      nome, "equipeId", "chaveCadastro", numero, posicao, "fotoUrl", cpf, "dataNascimento",
      "documentoTipo", "documentoNumero", "autoRegistrado"
    ) values (
      v_jogador.nome, v_equipe_id, v_jogador."chaveCadastro",
      case when coalesce(v_config->'atleta'->>'numeroCamisa', 'optional') <> 'disabled' then v_jogador.numero end,
      case when coalesce(v_config->'atleta'->>'posicao', 'optional') <> 'disabled' then v_jogador.posicao end,
      case when coalesce(v_config->'atleta'->>'foto', 'required') <> 'disabled' then v_jogador."fotoUrl" end,
      case when coalesce(v_config->'atleta'->>'cpf', 'optional') <> 'disabled' then v_jogador.cpf end,
      case when coalesce(v_config->'atleta'->>'dataNascimento', 'required') <> 'disabled' then v_jogador."dataNascimento" end,
      case when coalesce(v_config->'atleta'->>'documento', 'required') <> 'disabled' then v_jogador."documentoTipo" end,
      case when coalesce(v_config->'atleta'->>'documento', 'required') <> 'disabled' then v_jogador."documentoNumero" end,
      true
    ) returning id into v_jogador_id;
    update public."InscricaoEquipeJogadorRascunho" set "jogadorId" = v_jogador_id where id = v_jogador.id;
  end loop;

  v_inscricao_id := gen_random_uuid()::text;
  insert into public."InscricaoCampeonato" (id, "ligaId", "categoriaCampeonatoId", "equipeId", status, observacao, "criadaEm", "atualizadaEm")
  values (
    v_inscricao_id, v_draft."ligaId", v_draft."categoriaCampeonatoId", v_equipe_id, v_status,
    'Cadastro concluído pelo formulário da categoria', now(), now()
  );

  update public."InscricaoEquipeRascunho"
  set status = 'CONCLUIDO', "equipeId" = v_equipe_id,
      "inscricaoCampeonatoId" = v_inscricao_id, "enviadaEm" = now()
  where id = v_draft.id;

  perform public.recalcular_classificacao_categoria(v_draft."ligaId",v_draft."categoriaCampeonatoId");
  return jsonb_build_object(
    'equipeId', v_equipe_id,
    'inscricaoCampeonatoId', v_inscricao_id,
    'status', v_status,
    'idempotent', false
  );
end;
$$;

revoke all on function public.finalizar_inscricao_equipe_rascunho(uuid, text) from public, anon, authenticated;
grant execute on function public.finalizar_inscricao_equipe_rascunho(uuid, text) to service_role;

commit;
