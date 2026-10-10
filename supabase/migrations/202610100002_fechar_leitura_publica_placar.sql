-- Fecha a leitura da chave publicável em SetPartida e ClassificacaoEntrada.
--
-- 202610060004 devolveu SELECT da tabela inteira a anon e authenticated para
-- o Realtime. As policies public_read_* usam USING (true). Se o RLS estiver
-- desligado no projeto, esse GRANT lê e, no histórico antigo, também gravava.
-- O placar e a classificação públicos já saem pelas rotas do Next com
-- service_role. O navegador só usava o postgres_changes como aviso para
-- buscar de novo. Depois desta migration o aviso para de chegar; a tela
-- continua atualizando pela API.
--
-- Não concede nada a anon nem a authenticated. service_role segue com o
-- privilégio que já tinha e ignora RLS.
--
-- Default privileges: o revoke de 202610060004 vale para o papel que rodou
-- a migration. Tabela nova criada por supabase_admin ainda pode nascer
-- concedida a anon e authenticated. O bloco abaixo repete o revoke para
-- postgres e, se o papel da migration puder, para supabase_admin.

alter table public."SetPartida" enable row level security;
alter table public."ClassificacaoEntrada" enable row level security;

drop policy if exists "public_read_sets" on public."SetPartida";
drop policy if exists "luv_public_select_set_partida" on public."SetPartida";
drop policy if exists "public_read_classificacao" on public."ClassificacaoEntrada";
drop policy if exists "luv_public_select_classificacao" on public."ClassificacaoEntrada";

revoke all on table public."SetPartida" from public;
revoke all on table public."ClassificacaoEntrada" from public;
revoke all on table public."SetPartida" from anon, authenticated;
revoke all on table public."ClassificacaoEntrada" from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
alter default privileges for role postgres
  revoke execute on functions from public;

do $defaults$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    begin
      execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated';
      execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated';
      execute 'alter default privileges for role supabase_admin in schema public revoke all on functions from anon, authenticated';
      execute 'alter default privileges for role supabase_admin revoke execute on functions from public';
    exception
      when insufficient_privilege then
        raise notice 'default privileges de supabase_admin não alterados: o papel desta migration não pode alterá-los';
    end;
  end if;
end
$defaults$;

-- A função do link de categoria passou a gravar APROVADA sempre
-- (202610060002), por cima de Liga.inscricaoAprovacaoAutomatica.
-- O caso abaixo volta a respeitar a flag. Vaga esgotada só bloqueia
-- quando a inscrição nasceria aprovada.

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
  v_liga public."Liga"%rowtype;
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
  for update;

  if not found then raise exception using errcode = 'P0002', message = 'Rascunho nao encontrado.'; end if;
  if v_draft.status in ('ENVIADA', 'CONCLUIDO') then
    return jsonb_build_object(
      'equipeId', v_draft."equipeId",
      'inscricaoCampeonatoId', v_draft."inscricaoCampeonatoId",
      'status', v_draft.status,
      'idempotent', true
    );
  end if;

  select * into v_liga from public."Liga" where id = v_draft."ligaId" for update;
  if not found then raise exception using errcode = 'P0002', message = 'Campeonato nao encontrado.'; end if;
  if v_liga.status not in ('EM_BREVE', 'ATIVA') or not coalesce(v_liga."inscricoesAbertas", true) then
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

  v_status := case when coalesce(v_liga."inscricaoAprovacaoAutomatica", false) then 'APROVADA' else 'SOLICITADA' end;
  if v_status = 'APROVADA' and v_liga."quantidadeEquipes" is not null and
     (select count(*) from public."InscricaoCampeonato" where "ligaId" = v_liga.id and status = 'APROVADA') >= v_liga."quantidadeEquipes" then
    raise exception using errcode = '23514', message = 'O limite de equipes aprovadas foi atingido.';
  end if;

  v_config := coalesce(v_liga."formularioInscricaoConfig", '{}'::jsonb);
  if nullif(btrim(v_draft."nomeEquipe"), '') is null or v_draft.categoria is null or v_draft."categoriaCampeonatoId" is null then
    raise exception using errcode = '23514', message = 'Os dados obrigatorios da equipe estao incompletos.';
  end if;
  if coalesce(v_config->'equipe'->>'logo', 'optional') = 'required' and v_draft."logoUrl" is null then
    raise exception using errcode = '23514', message = 'Logo da equipe e obrigatorio.';
  end if;
  if coalesce(v_config->'lider'->>'nomeCompleto', 'optional') = 'required' and nullif(btrim(v_draft.lider), '') is null then
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
    nome, "ligaId", "categoriaCampeonatoId", categoria, serie, slug, "statusEquipe", "inscricaoAtiva", "logoUrl", lider, tecnico
  ) values (
    v_draft."nomeEquipe", v_draft."ligaId", v_draft."categoriaCampeonatoId", v_draft.categoria, null, p_slug,
    'ATIVA', true,
    case when coalesce(v_config->'equipe'->>'logo', 'optional') <> 'disabled' then v_draft."logoUrl" end,
    case when coalesce(v_config->'lider'->>'nomeCompleto', 'optional') <> 'disabled' then v_draft.lider end,
    v_draft.tecnico
  ) returning id into v_equipe_id;

  for v_jogador in
    select * from public."InscricaoEquipeJogadorRascunho"
    where "inscricaoRascunhoId" = v_draft.id order by "criadoEm", id
  loop
    insert into public."Jogador" (
      nome, "equipeId", numero, posicao, "fotoUrl", cpf, "dataNascimento",
      "documentoTipo", "documentoNumero", "autoRegistrado"
    ) values (
      v_jogador.nome, v_equipe_id,
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
  insert into public."InscricaoCampeonato" (id, "ligaId", "categoriaCampeonatoId", "equipeId", status, observacao)
  values (
    v_inscricao_id, v_draft."ligaId", v_draft."categoriaCampeonatoId", v_equipe_id, v_status,
    'Cadastro concluído pelo link da categoria'
  );

  update public."InscricaoEquipeRascunho"
  set status = 'CONCLUIDO', "equipeId" = v_equipe_id,
      "inscricaoCampeonatoId" = v_inscricao_id, "enviadaEm" = now()
  where id = v_draft.id;

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
