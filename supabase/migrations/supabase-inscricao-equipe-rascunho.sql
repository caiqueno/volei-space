-- Cadastro rapido persistente de equipes.
-- Migration aditiva/idempotente. Execute no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public."InscricaoEquipeRascunho" (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  "ligaId" integer not null references public."Liga"(id) on delete cascade,
  "nomeEquipe" text not null,
  "logoUrl" text,
  lider text,
  tecnico text,
  categoria text,
  serie text,
  status text not null default 'RASCUNHO',
  "equipeId" integer references public."Equipe"(id) on delete set null,
  "inscricaoCampeonatoId" text references public."InscricaoCampeonato"(id) on delete set null,
  "criadaEm" timestamptz not null default now(),
  "atualizadaEm" timestamptz not null default now(),
  "enviadaEm" timestamptz,
  constraint "InscricaoEquipeRascunho_status_check" check (status in ('RASCUNHO', 'ENVIADA'))
);

create table if not exists public."InscricaoEquipeJogadorRascunho" (
  id uuid primary key default gen_random_uuid(),
  "inscricaoRascunhoId" uuid not null references public."InscricaoEquipeRascunho"(id) on delete cascade,
  "jogadorId" integer references public."Jogador"(id) on delete set null,
  nome text not null,
  numero integer,
  posicao text,
  "fotoUrl" text,
  cpf text,
  "dataNascimento" date,
  "documentoTipo" text,
  "documentoNumero" text,
  "criadoEm" timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now()
);

create index if not exists "InscricaoEquipeRascunho_liga_status_idx"
  on public."InscricaoEquipeRascunho" ("ligaId", status);
create index if not exists "InscricaoEquipeRascunho_equipe_idx"
  on public."InscricaoEquipeRascunho" ("equipeId");
create unique index if not exists "InscricaoEquipeRascunho_equipe_unique"
  on public."InscricaoEquipeRascunho" ("equipeId") where "equipeId" is not null;
create unique index if not exists "InscricaoEquipeRascunho_inscricao_unique"
  on public."InscricaoEquipeRascunho" ("inscricaoCampeonatoId") where "inscricaoCampeonatoId" is not null;
create index if not exists "InscricaoEquipeJogadorRascunho_rascunho_idx"
  on public."InscricaoEquipeJogadorRascunho" ("inscricaoRascunhoId", "criadoEm");
create unique index if not exists "InscricaoEquipeJogadorRascunho_jogador_unique"
  on public."InscricaoEquipeJogadorRascunho" ("jogadorId") where "jogadorId" is not null;

create or replace function public.touch_inscricao_equipe_rascunho()
returns trigger language plpgsql set search_path = public as $$
begin
  new."atualizadaEm" = now();
  return new;
end;
$$;

drop trigger if exists "InscricaoEquipeRascunho_touch" on public."InscricaoEquipeRascunho";
create trigger "InscricaoEquipeRascunho_touch"
before update on public."InscricaoEquipeRascunho"
for each row execute function public.touch_inscricao_equipe_rascunho();

create or replace function public.touch_inscricao_equipe_jogador_rascunho()
returns trigger language plpgsql set search_path = public as $$
begin
  new."atualizadoEm" = now();
  return new;
end;
$$;

drop trigger if exists "InscricaoEquipeJogadorRascunho_touch" on public."InscricaoEquipeJogadorRascunho";
create trigger "InscricaoEquipeJogadorRascunho_touch"
before update on public."InscricaoEquipeJogadorRascunho"
for each row execute function public.touch_inscricao_equipe_jogador_rascunho();

alter table public."InscricaoEquipeRascunho" enable row level security;
alter table public."InscricaoEquipeJogadorRascunho" enable row level security;
revoke all on public."InscricaoEquipeRascunho" from anon, authenticated;
revoke all on public."InscricaoEquipeJogadorRascunho" from anon, authenticated;

-- A service role chama esta funcao. O lock do rascunho torna retries e dois
-- cliques concorrentes idempotentes; qualquer excecao reverte as quatro
-- escritas (Equipe, Jogador, InscricaoCampeonato e rascunho).
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
  if v_draft.status = 'ENVIADA' then
    return jsonb_build_object(
      'equipeId', v_draft."equipeId",
      'inscricaoCampeonatoId', v_draft."inscricaoCampeonatoId",
      'status', 'ENVIADA',
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
  if v_liga."quantidadeEquipes" is not null and
     (select count(*) from public."InscricaoCampeonato" where "ligaId" = v_liga.id and status = 'APROVADA') >= v_liga."quantidadeEquipes" then
    raise exception using errcode = '23514', message = 'O limite de equipes aprovadas foi atingido.';
  end if;

  v_config := coalesce(v_liga."formularioInscricaoConfig", '{}'::jsonb);
  if nullif(btrim(v_draft."nomeEquipe"), '') is null or v_draft.categoria is null or v_draft.serie is null then
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
  if coalesce(v_config->'atleta'->>'foto', 'optional') = 'required' and exists (
    select 1 from public."InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId" = v_draft.id and "fotoUrl" is null
  ) then raise exception using errcode = '23514', message = 'Foto do jogador e obrigatoria.'; end if;
  if coalesce(v_config->'atleta'->>'cpf', 'optional') = 'required' and exists (
    select 1 from public."InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId" = v_draft.id and nullif(btrim(cpf), '') is null
  ) then raise exception using errcode = '23514', message = 'CPF do jogador e obrigatorio.'; end if;
  if coalesce(v_config->'atleta'->>'dataNascimento', 'optional') = 'required' and exists (
    select 1 from public."InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId" = v_draft.id and "dataNascimento" is null
  ) then raise exception using errcode = '23514', message = 'Data de nascimento e obrigatoria.'; end if;
  if coalesce(v_config->'atleta'->>'documento', 'optional') = 'required' and exists (
    select 1 from public."InscricaoEquipeJogadorRascunho" where "inscricaoRascunhoId" = v_draft.id
      and (nullif(btrim("documentoTipo"), '') is null or nullif(btrim("documentoNumero"), '') is null)
  ) then raise exception using errcode = '23514', message = 'Documento do jogador e obrigatorio.'; end if;

  insert into public."Equipe" (
    nome, "ligaId", categoria, serie, slug, "statusEquipe", "inscricaoAtiva", "logoUrl", lider, tecnico
  ) values (
    v_draft."nomeEquipe", v_draft."ligaId", v_draft.categoria, v_draft.serie, p_slug,
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
      case when coalesce(v_config->'atleta'->>'foto', 'optional') <> 'disabled' then v_jogador."fotoUrl" end,
      case when coalesce(v_config->'atleta'->>'cpf', 'optional') <> 'disabled' then v_jogador.cpf end,
      case when coalesce(v_config->'atleta'->>'dataNascimento', 'optional') <> 'disabled' then v_jogador."dataNascimento" end,
      case when coalesce(v_config->'atleta'->>'documento', 'optional') <> 'disabled' then v_jogador."documentoTipo" end,
      case when coalesce(v_config->'atleta'->>'documento', 'optional') <> 'disabled' then v_jogador."documentoNumero" end,
      true
    ) returning id into v_jogador_id;
    update public."InscricaoEquipeJogadorRascunho" set "jogadorId" = v_jogador_id where id = v_jogador.id;
  end loop;

  v_inscricao_id := gen_random_uuid()::text;
  insert into public."InscricaoCampeonato" (id, "ligaId", "equipeId", status, observacao)
  values (
    v_inscricao_id, v_draft."ligaId", v_equipe_id, v_status,
    case when v_status = 'APROVADA'
      then 'Cadastro rapido via link (aprovacao automatica)'
      else 'Cadastro rapido via link (aguardando aprovacao)'
    end
  );

  update public."InscricaoEquipeRascunho"
  set status = 'ENVIADA', "equipeId" = v_equipe_id,
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
