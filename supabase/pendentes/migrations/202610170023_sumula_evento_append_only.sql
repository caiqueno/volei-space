-- 202610170023_sumula_evento_append_only.sql   (M5 do plano; docs/analise/07 seção 4, 14 seção 4)
--
-- OBJETIVO
--   Esqueleto seguro do log de eventos da súmula (J02):
--   * tabela "SumulaEvento" append-only: ordem por "seq" (unique por partida), idempotência por
--     "clientEventId" (unique por partida), desfazer como evento compensatório (tipo DESFAZ aponta
--     "desfazId"; cada evento só pode ser desfeito uma vez);
--   * triggers que bloqueiam UPDATE, DELETE e TRUNCATE (exceção única: purga de campeonato de
--     simulação, por função própria);
--   * RLS ligada, sem nenhum privilégio para anon/authenticated; service_role só SELECT e INSERT
--     (UPDATE, DELETE e TRUNCATE revogados também dele);
--   * RPC atômica registrar_evento_sumula (security definer, search_path fixo, trava a linha da
--     "Partida" com FOR UPDATE, idempotente, versão otimista opcional por seq esperado).
--
--   NÃO FAZ (fica para as próximas migrations, anotado em docs/analise/16): recalcular_placar_partida
--   (projeção do placar a partir do log), materialização em SetPartida/Partida, hash encadeado,
--   sumulaToken aleatório com expiração. A tabela é aditiva: o fluxo atual de súmula
--   (delete + insert em SetPartida, SumulaPresenca, OcorrenciaPartida) não é tocado e nenhuma
--   coluna de "Partida" muda. Tipo SNAPSHOT existe para registrar o estado de jogos antigos e só é
--   aceito pela RPC como primeiro evento da partida.
--
-- PRÉ-REQUISITOS
--   "Partida", "Equipe", "Jogador" e "Liga"."simulacao" existentes (supabase-simulacao.sql).
--   M1 aplicada é desejável (esta migration já nasce fechada, independe dela).
--
-- QUEBRA DE ROTAS
--   Nenhuma: nada usa a tabela até o backend adotar a RPC. Efeito colateral deliberado: com eventos
--   gravados, apagar "Partida", "Equipe" ou "Jogador" referenciados falha (FK RESTRICT) e o DELETE de
--   campeonato (api/ligas/[slug]) falha para partidas já no modo novo. Limpeza de simulação deve
--   chamar public.purgar_eventos_simulacao(ligaId) antes (alterar src/lib/simulacao*.ts).
--
-- BACKUP NECESSÁRIO
--   Nenhum (tabela nova). Depois que houver eventos reais, o backup da tabela passa a ser parte do
--   backup diário: é a fonte de verdade das partidas no modo novo.
--
-- JANELA SEGURA
--   Qualquer horário: DDL em objetos novos; FKs para "Partida"/"Equipe"/"Jogador" pegam lock curto
--   de SHARE ROW EXCLUSIVE ao criar (lock_timeout de 5 s). Preferir fora de rodada.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170023_sumula_evento_append_only.sql (drop table: perde os eventos
--   gravados; só reverter antes de existir evento real ou com backup da tabela).

begin;
set local lock_timeout = '5s';

create table if not exists public."SumulaEvento" (
  id               bigint generated always as identity primary key,
  "partidaId"      integer not null references public."Partida"(id) on delete restrict,
  seq              integer not null check (seq > 0),
  "clientEventId"  uuid not null,
  tipo             text not null check (tipo in (
                     'INICIO_SET', 'PONTO', 'SAQUE', 'SUBSTITUICAO', 'TEMPO', 'SANCAO',
                     'LIBERO', 'DESAFIO', 'FIM_SET', 'WO', 'FIM_PARTIDA', 'DESFAZ', 'SNAPSHOT')),
  "setNumero"      smallint check ("setNumero" between 1 and 5),
  "equipeId"       integer references public."Equipe"(id) on delete restrict,
  "jogadorId"      integer references public."Jogador"(id) on delete restrict,
  payload          jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  "desfazId"       bigint references public."SumulaEvento"(id) on delete restrict,
  "autorTipo"      text not null check ("autorTipo" in ('APONTADOR', 'ARBITRO', 'ORGANIZADOR', 'SISTEMA')),
  "autorRef"       text,
  "ocorridoEm"     timestamptz not null default now(),
  "criadoEm"       timestamptz not null default now(),
  constraint "SumulaEvento_partida_seq_key" unique ("partidaId", seq),
  constraint "SumulaEvento_partida_clientEventId_key" unique ("partidaId", "clientEventId"),
  constraint "SumulaEvento_desfaz_chk" check ((tipo = 'DESFAZ') = ("desfazId" is not null)),
  constraint "SumulaEvento_ponto_chk" check (tipo <> 'PONTO' or ("equipeId" is not null and "setNumero" is not null))
);

-- Cada evento só pode ser desfeito uma vez.
create unique index if not exists "SumulaEvento_desfazId_key"
  on public."SumulaEvento" ("desfazId") where "desfazId" is not null;

-- Leitura por set (a leitura por partida já é coberta pelo unique (partidaId, seq)).
create index if not exists "SumulaEvento_partida_set_seq_idx"
  on public."SumulaEvento" ("partidaId", "setNumero", seq);

-- Imutabilidade. Superusuário ainda pode desabilitar triggers; é o limite do mecanismo.
create or replace function public.sumula_evento_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('app.purga_simulacao', true), '') = 'on' then
    return old;
  end if;
  raise exception 'SumulaEvento e append-only (% bloqueado)', tg_op using errcode = '42501';
end;
$$;

drop trigger if exists "SumulaEvento_imutavel_linha" on public."SumulaEvento";
create trigger "SumulaEvento_imutavel_linha"
  before update or delete on public."SumulaEvento"
  for each row execute function public.sumula_evento_imutavel();

drop trigger if exists "SumulaEvento_imutavel_truncate" on public."SumulaEvento";
create trigger "SumulaEvento_imutavel_truncate"
  before truncate on public."SumulaEvento"
  for each statement execute function public.sumula_evento_imutavel();

-- RLS e privilégios: nada para anon/authenticated; service_role lê e insere, não altera nem apaga.
alter table public."SumulaEvento" enable row level security;
revoke all on table public."SumulaEvento" from public, anon, authenticated;
grant select, insert on table public."SumulaEvento" to service_role;
revoke update, delete, truncate on table public."SumulaEvento" from service_role;

do $m5$
declare
  seq_nome text := pg_get_serial_sequence('public."SumulaEvento"', 'id');
begin
  if seq_nome is not null then
    execute format('revoke all on sequence %s from public, anon, authenticated', seq_nome);
    execute format('grant usage, select on sequence %s to service_role', seq_nome);
  end if;
end
$m5$;

-- RPC atômica de escrita.
create or replace function public.registrar_evento_sumula(
  p_partida_id      integer,
  p_client_event_id uuid,
  p_tipo            text,
  p_payload         jsonb default '{}'::jsonb,
  p_autor_tipo      text default 'APONTADOR',
  p_autor_ref       text default null,
  p_set_numero      smallint default null,
  p_equipe_id       integer default null,
  p_jogador_id      integer default null,
  p_desfaz_id       bigint default null,
  p_ocorrido_em     timestamptz default null,
  p_seq_esperado    integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aprovada  timestamptz;
  v_atual     integer;
  v_existente record;
  v_alvo      record;
  v_id        bigint;
  v_seq       integer;
  v_payload   jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if p_partida_id is null or p_client_event_id is null or p_tipo is null then
    raise exception 'partida, clientEventId e tipo sao obrigatorios' using errcode = '22023';
  end if;
  if jsonb_typeof(v_payload) <> 'object' or pg_column_size(v_payload) > 8192 then
    raise exception 'payload invalido ou grande demais' using errcode = '22023';
  end if;

  -- Serializa todos os escritores da mesma partida.
  select "sumulaAprovadaEm" into v_aprovada
  from public."Partida" where id = p_partida_id for update;
  if not found then
    raise exception 'Partida inexistente' using errcode = 'P0002';
  end if;

  -- Idempotência: reenvio do mesmo evento devolve o já gravado, sem erro.
  select id, seq into v_existente
  from public."SumulaEvento"
  where "partidaId" = p_partida_id and "clientEventId" = p_client_event_id;
  if found then
    return jsonb_build_object('id', v_existente.id, 'seq', v_existente.seq, 'duplicado', true);
  end if;

  if v_aprovada is not null then
    raise exception 'Sumula oficializada: nao aceita novos eventos' using errcode = '23514';
  end if;

  select coalesce(max(seq), 0) into v_atual
  from public."SumulaEvento" where "partidaId" = p_partida_id;

  if p_seq_esperado is not null and p_seq_esperado <> v_atual then
    raise exception 'Conflito de versao da sumula' using errcode = '40001', detail = v_atual::text;
  end if;

  if p_tipo = 'SNAPSHOT' and v_atual <> 0 then
    raise exception 'SNAPSHOT so e aceito como primeiro evento da partida' using errcode = '23514';
  end if;

  if p_tipo = 'DESFAZ' then
    select id, tipo into v_alvo
    from public."SumulaEvento"
    where id = p_desfaz_id and "partidaId" = p_partida_id;
    if not found then
      raise exception 'Evento a desfazer nao pertence a esta partida' using errcode = '23503';
    end if;
    if v_alvo.tipo in ('DESFAZ', 'SNAPSHOT') then
      raise exception 'Evento nao pode ser desfeito' using errcode = '23514';
    end if;
  end if;

  if p_equipe_id is not null and not exists (
    select 1 from public."Partida"
    where id = p_partida_id and p_equipe_id in ("equipeAId", "equipeBId")
  ) then
    raise exception 'Equipe nao participa desta partida' using errcode = '23514';
  end if;

  v_seq := v_atual + 1;

  insert into public."SumulaEvento" (
    "partidaId", seq, "clientEventId", tipo, "setNumero", "equipeId", "jogadorId",
    payload, "desfazId", "autorTipo", "autorRef", "ocorridoEm"
  ) values (
    p_partida_id, v_seq, p_client_event_id, p_tipo, p_set_numero, p_equipe_id, p_jogador_id,
    v_payload, p_desfaz_id, p_autor_tipo, p_autor_ref, coalesce(p_ocorrido_em, now())
  ) returning id into v_id;

  return jsonb_build_object('id', v_id, 'seq', v_seq, 'duplicado', false);
end;
$$;

revoke all on function public.registrar_evento_sumula(
  integer, uuid, text, jsonb, text, text, smallint, integer, integer, bigint, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.registrar_evento_sumula(
  integer, uuid, text, jsonb, text, text, smallint, integer, integer, bigint, timestamptz, integer
) to service_role;

-- Única forma de apagar eventos: campeonato de simulação (Liga.simulacao = true).
create or replace function public.purgar_eventos_simulacao(p_liga_id integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removidos integer;
begin
  if not exists (select 1 from public."Liga" where id = p_liga_id and simulacao = true) then
    raise exception 'Liga nao e de simulacao' using errcode = '42501';
  end if;
  perform set_config('app.purga_simulacao', 'on', true);
  -- Desfaz auto-referencia: apagar primeiro os DESFAZ (apontam para outros eventos).
  delete from public."SumulaEvento"
  where "partidaId" in (select id from public."Partida" where "ligaId" = p_liga_id)
    and tipo = 'DESFAZ';
  delete from public."SumulaEvento"
  where "partidaId" in (select id from public."Partida" where "ligaId" = p_liga_id);
  get diagnostics removidos = row_count;
  return removidos;
end;
$$;

revoke all on function public.purgar_eventos_simulacao(integer) from public, anon, authenticated;
grant execute on function public.purgar_eventos_simulacao(integer) to service_role;

commit;
