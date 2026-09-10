-- Central de Parametrização do Campeonato — aditivo, nenhuma coluna/tabela
-- existente é removida ou tem comportamento alterado por default.
-- Validado contra o banco real (avsemgzouyfmfxlxushs) antes de escrever:
-- 10 ligas hoje, 0 violações de dataInicio > dataFim.

-- 1. Liga — novas colunas -----------------------------------------------

alter table "Liga" add column if not exists "nomeCurto" text;

alter table "Liga"
  add column if not exists "quantidadeEquipesMinima" integer,
  add column if not exists "quantidadeEquipesMaxima" integer,
  add column if not exists "turnoReturno" boolean not null default false,
  add column if not exists "setsFormato" text not null default 'MELHOR_DE',
  add column if not exists "diferencaMinimaSet" integer not null default 2;

alter table "Liga" drop constraint if exists "Liga_setsFormato_check";
alter table "Liga" add constraint "Liga_setsFormato_check"
  check ("setsFormato" in ('MELHOR_DE', 'QUANTIDADE_FIXA'));

alter table "Liga" drop constraint if exists "Liga_quantidadeEquipes_minmax_check";
alter table "Liga" add constraint "Liga_quantidadeEquipes_minmax_check"
  check ("quantidadeEquipesMinima" is null or "quantidadeEquipesMaxima" is null
    or "quantidadeEquipesMinima" <= "quantidadeEquipesMaxima");

alter table "Liga" add column if not exists "pontuacaoResultado" jsonb;

alter table "Liga" drop constraint if exists "Liga_faseEliminatoria_check";
alter table "Liga" add constraint "Liga_faseEliminatoria_check"
  check ("faseEliminatoria" in ('NENHUMA', 'FINAL', 'SEMIFINAL', 'QUARTAS', 'OITAVAS', 'DEZESSEIS_AVOS'));

alter table "Liga"
  add column if not exists "metodoChaveamento" text not null default 'MANUAL',
  add column if not exists "eliminatoriaIdaVolta" boolean not null default false,
  add column if not exists "disputaTerceiroLugar" boolean not null default true,
  add column if not exists "goldenSet" boolean not null default false,
  add column if not exists "melhoresClassificadosGerais" integer not null default 0;

alter table "Liga" drop constraint if exists "Liga_metodoChaveamento_check";
alter table "Liga" add constraint "Liga_metodoChaveamento_check"
  check ("metodoChaveamento" in ('RANKING_GERAL', 'CRUZAMENTO_GRUPOS', 'SORTEIO', 'MANUAL'));
-- NOTA DE ESCOPO: só MANUAL tem execução real hoje (POST .../mata-mata,
-- confronto a confronto). Os outros 3 métodos ficam configuráveis, sem
-- gerador de chaveamento automático — pendência documentada no relatório
-- final desta refatoração.

-- goldenSet: só a configuração é persistida aqui. Aplicar a regra do golden
-- set na pontuação AO VIVO da súmula digital está fora de escopo desta etapa.

alter table "Liga"
  add column if not exists "inscricoesAberturaEm" timestamptz,
  add column if not exists "inscricoesEncerramentoEm" timestamptz,
  add column if not exists "inscricaoAprovacaoAutomatica" boolean not null default false,
  add column if not exists "inscricaoPermiteEdicaoAposEnvio" boolean not null default true,
  add column if not exists "inscricaoPrazoEdicaoDias" integer,
  add column if not exists "elencoQuantidadeMinima" integer,
  add column if not exists "elencoQuantidadeMaxima" integer,
  add column if not exists "elencoCadastroDuranteInscricao" boolean not null default true,
  add column if not exists "elencoCadastroAposAprovacao" boolean not null default true,
  add column if not exists "qrCodeEnabled" boolean not null default true,
  add column if not exists "formularioInscricaoConfig" jsonb;

alter table "Liga" drop constraint if exists "Liga_elenco_quantidade_check";
alter table "Liga" add constraint "Liga_elenco_quantidade_check"
  check ("elencoQuantidadeMinima" is null or "elencoQuantidadeMaxima" is null
    or "elencoQuantidadeMinima" <= "elencoQuantidadeMaxima");

alter table "Liga" drop constraint if exists "Liga_inscricoes_datas_check";
alter table "Liga" add constraint "Liga_inscricoes_datas_check"
  check ("inscricoesAberturaEm" is null or "inscricoesEncerramentoEm" is null
    or "inscricoesAberturaEm" <= "inscricoesEncerramentoEm");

-- Calendário: reaproveita dataInicio/dataFim já existentes (fonte única,
-- editada a partir do card Calendário). Validado contra os 10 registros
-- reais antes de aplicar: 0 violações hoje.
alter table "Liga" drop constraint if exists "Liga_datas_check";
alter table "Liga" add constraint "Liga_datas_check"
  check ("dataInicio" is null or "dataFim" is null or "dataInicio" <= "dataFim");

-- =========================================================================
-- 2. Jogador — remove os 2 índices únicos redundantes/mais restritivos que
--    tornam Jogador_equipe_numero_ativo_unique (o índice "pretendido") sem
--    efeito prático. Os 3 têm exatamente a mesma definição de colunas
--    (equipeId, numero); só a cláusula WHERE difere. Estritamente mais
--    permissivo: todo dado que satisfaz os índices #1/#2 já satisfaz o #3
--    (subconjunto: numero IS NOT NULL AND banido = false).
-- =========================================================================

drop index if exists "Jogador_equipeId_numero_key";
drop index if exists "Jogador_equipe_numero_unique";
-- mantém "Jogador_equipe_numero_ativo_unique" como está (não recriar).

-- =========================================================================
-- 3. LigaLocal — lista de locais do campeonato (não substitui
--    Partida.localNome/localEndereco, que continuam texto livre por jogo).
-- =========================================================================

create table if not exists public."LigaLocal" (
  id bigserial primary key,
  "ligaId" integer not null references public."Liga"(id) on delete cascade,
  nome text not null,
  endereco text,
  quadra text,
  ordem integer not null default 1,
  "criadoEm" timestamptz not null default now()
);

create index if not exists "LigaLocal_liga_idx"
  on public."LigaLocal" ("ligaId", ordem);

alter table public."LigaLocal" enable row level security;

drop policy if exists "LigaLocal_public_select" on public."LigaLocal";
create policy "LigaLocal_public_select"
  on public."LigaLocal"
  for select
  using (true);

revoke insert, update, delete on public."LigaLocal" from anon, authenticated;
revoke usage, select on sequence public."LigaLocal_id_seq" from anon, authenticated;
grant select on public."LigaLocal" to anon, authenticated;

-- =========================================================================
-- 4. LigaSetupSecao — metadados puros de progresso (nunca duplica valor de
--    negócio; guarda só a intenção do organizador por seção).
-- =========================================================================

create table if not exists public."LigaSetupSecao" (
  "ligaId" integer not null references public."Liga"(id) on delete cascade,
  secao text not null,
  status text not null default 'not-started',
  "atualizadoEm" timestamptz not null default now(),
  "concluidoEm" timestamptz,
  primary key ("ligaId", secao),
  constraint "LigaSetupSecao_secao_check"
    check (secao in ('informacoes', 'estrutura', 'classificacao', 'eliminatorias', 'calendario', 'inscricoes')),
  constraint "LigaSetupSecao_status_check"
    check (status in ('not-started', 'in-progress', 'completed'))
);

create index if not exists "LigaSetupSecao_liga_idx"
  on public."LigaSetupSecao" ("ligaId");

alter table public."LigaSetupSecao" enable row level security;

drop policy if exists "LigaSetupSecao_public_select" on public."LigaSetupSecao";
create policy "LigaSetupSecao_public_select"
  on public."LigaSetupSecao"
  for select
  using (true);

revoke insert, update, delete on public."LigaSetupSecao" from anon, authenticated;
grant select on public."LigaSetupSecao" to anon, authenticated;

-- Backfill: os campeonatos já existentes operam sob o modelo antigo
-- (formulário único) e não têm progresso parcial conhecido/reconstruível —
-- marcar tudo como completed é a única postura que não inventa estado.
-- Idempotente (on conflict do nothing).
insert into public."LigaSetupSecao" ("ligaId", secao, status, "concluidoEm")
select l.id, s.secao, 'completed', now()
from "Liga" l
cross join (
  values ('informacoes'), ('estrutura'), ('classificacao'),
         ('eliminatorias'), ('calendario'), ('inscricoes')
) as s(secao)
on conflict ("ligaId", secao) do nothing;

-- =========================================================================
-- 5. recalcular_classificacao_liga — pontuação configurável via
--    pontuacaoResultado (jsonb) com fallback exato pro comportamento atual
--    (3 pts vitória seca / 2 pts vitória c/ sets cedidos / 1 pt derrota não
--    zerada / 0 pts derrota zerada), e ORDER BY dinâmico via
--    criteriosClassificacao com fallback pra ordem hardcoded atual.
--
--    Base confirmada via pg_get_functiondef contra o banco real: é
--    exatamente o corpo de supabase-fix-classificacao-exclui-mata-mata.sql
--    (pontuação 3/2/1/0 + filtro de fase GRUPOS/GERAL). Só a fórmula de
--    pontos e o ORDER BY mudam; escopo por ligaId, trava por advisory lock,
--    filtro de fase e filtro de partidas válidas ficam idênticos.
-- =========================================================================

create or replace function public.calcular_pontos_resultado(
  p_sets_vencedor integer,
  p_sets_perdedor integer,
  p_venceu boolean,
  p_pontuacao jsonb
) returns integer
language plpgsql
as $$
declare
  v_regra jsonb;
begin
  if p_pontuacao is not null then
    begin
      select r into v_regra
      from jsonb_array_elements(p_pontuacao) as r
      where (r->>'setsVencedor')::int = p_sets_vencedor
        and (r->>'setsPerdedor')::int = p_sets_perdedor
      limit 1;
    exception when others then
      v_regra := null;
    end;

    if v_regra is not null then
      return case when p_venceu
        then coalesce((v_regra->>'pontosVencedor')::int, 0)
        else coalesce((v_regra->>'pontosPerdedor')::int, 0)
      end;
    end if;
  end if;

  -- Fallback: fórmula hardcoded histórica (zerado/não-zerado), agnóstica ao
  -- formato de sets (funciona igual para bo3, bo5 etc.). Nas duas ramas o
  -- teste é sobre p_sets_perdedor (sets do lado perdedor do confronto):
  -- decide se o VENCEDOR ganhou de forma "seca" (3 pts) e também decide se
  -- o PRÓPRIO PERDEDOR foi "zerado" (0 pts) — nos dois casos é o mesmo
  -- valor (sets do time que perdeu), nunca p_sets_vencedor.
  return case when p_venceu
    then (case when p_sets_perdedor = 0 then 3 else 2 end)
    else (case when p_sets_perdedor = 0 then 0 else 1 end)
  end;
end;
$$;

create or replace function public.recalcular_classificacao_liga(p_liga_id integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pontuacao jsonb;
  v_criterios_raw text;
  v_criterios text[];
  v_criterio text;
  v_order_parts text[] := array[]::text[];
  v_order_sql text;
  v_sql text;
begin
  perform pg_advisory_xact_lock(p_liga_id);

  select "pontuacaoResultado", "criteriosClassificacao"
    into v_pontuacao, v_criterios_raw
  from "Liga" where id = p_liga_id;

  -- criteriosClassificacao é texto livre (json array) sem validação
  -- estrutural até hoje; parse defensivo com fallback pra ordem hardcoded
  -- atual caso o conteúdo esteja ausente, malformado ou vazio.
  begin
    if v_criterios_raw is not null then
      select array_agg(value) into v_criterios
      from jsonb_array_elements_text(v_criterios_raw::jsonb) as value;
    end if;
  exception when others then
    v_criterios := null;
  end;

  if v_criterios is null or array_length(v_criterios, 1) is null then
    v_criterios := array['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS'];
  end if;

  -- Whitelist fixa: só valores reconhecidos entram no ORDER BY dinâmico;
  -- qualquer valor desconhecido é ignorado silenciosamente (não derruba o
  -- recálculo por um typo salvo antes de existir validação de app).
  -- IMPORTANTE: v_criterio NUNCA é concatenado diretamente no SQL dinâmico
  -- abaixo — só os literais fixos deste CASE entram em v_order_parts. Se
  -- algum novo criterio for adicionado aqui, ele DEVE continuar sendo um
  -- literal fixo (nunca `quote_ident(v_criterio)` ou similar), senão a
  -- coluna livre "criteriosClassificacao" vira um vetor de SQL injection.
  foreach v_criterio in array v_criterios loop
    v_order_parts := v_order_parts || case upper(trim(v_criterio))
      when 'PONTOS' then 'pontos desc'
      when 'VITORIAS' then 'vitorias desc'
      when 'DERROTAS' then 'derrotas asc'
      when 'SALDO_SETS' then '(sets_pro - sets_contra) desc'
      when 'SALDO_PONTOS' then '(pontos_pro - pontos_contra) desc'
      when 'SETS_PRO' then 'sets_pro desc'
      when 'PONTOS_PRO' then 'pontos_pro desc'
      else null
    end;
  end loop;
  v_order_parts := array_remove(v_order_parts, null);

  if array_length(v_order_parts, 1) is null then
    v_order_parts := array['pontos desc', 'vitorias desc', '(sets_pro - sets_contra) desc', '(pontos_pro - pontos_contra) desc'];
  end if;

  v_order_sql := array_to_string(v_order_parts, ', ');

  v_sql := format($fmt$
    with equipes as (
      select e.id as equipe_id,
             coalesce(e.categoria, 'GERAL') as categoria,
             coalesce(e.serie, 'UNICA') as serie
      from "InscricaoCampeonato" ic
      join "Equipe" e on e.id = ic."equipeId"
      where ic."ligaId" = $1 and ic.status = 'APROVADA'
    ),
    partidas as (
      select
        p.id,
        p."equipeAId",
        p."equipeBId",
        coalesce(p."setsPorA", (
          select count(*) from "SetPartida" sp where sp."partidaId" = p.id and sp."pontosA" > sp."pontosB"
        ))::int as sets_a,
        coalesce(p."setsPorB", (
          select count(*) from "SetPartida" sp where sp."partidaId" = p.id and sp."pontosB" > sp."pontosA"
        ))::int as sets_b,
        coalesce(p."pontosPorA", (
          select coalesce(sum(sp."pontosA"), 0) from "SetPartida" sp where sp."partidaId" = p.id
        ))::int as pontos_a,
        coalesce(p."pontosPorB", (
          select coalesce(sum(sp."pontosB"), 0) from "SetPartida" sp where sp."partidaId" = p.id
        ))::int as pontos_b
      from "Partida" p
      where p."ligaId" = $1
        and upper(trim(coalesce(p.fase, 'GERAL'))) in ('GRUPOS', 'GERAL')
        and (
          upper(trim(coalesce(p.status, ''))) in ('ENCERRADA', 'FINALIZADA', 'FINISHED', 'APROVADA')
          or p."sumulaAprovadaEm" is not null
          or (p."sumulaSubmetidaEm" is not null and p."vencedorId" is not null)
        )
    ),
    partidas_validas as (
      select * from partidas
      where sets_a <> sets_b
        and "equipeAId" in (select equipe_id from equipes)
        and "equipeBId" in (select equipe_id from equipes)
    ),
    eventos as (
      select
        "equipeAId" as equipe_id,
        1 as jogos,
        (sets_a > sets_b)::int as vitorias,
        (sets_a < sets_b)::int as derrotas,
        sets_a as sets_pro,
        sets_b as sets_contra,
        pontos_a as pontos_pro,
        pontos_b as pontos_contra,
        public.calcular_pontos_resultado(greatest(sets_a, sets_b), least(sets_a, sets_b), sets_a > sets_b, $2) as pontos
      from partidas_validas
      union all
      select
        "equipeBId" as equipe_id,
        1,
        (sets_b > sets_a)::int,
        (sets_b < sets_a)::int,
        sets_b,
        sets_a,
        pontos_b,
        pontos_a,
        public.calcular_pontos_resultado(greatest(sets_a, sets_b), least(sets_a, sets_b), sets_b > sets_a, $2)
      from partidas_validas
    ),
    agregado as (
      select
        e.equipe_id,
        e.categoria,
        e.serie,
        coalesce(sum(ev.jogos), 0)::int as jogos,
        coalesce(sum(ev.vitorias), 0)::int as vitorias,
        coalesce(sum(ev.derrotas), 0)::int as derrotas,
        coalesce(sum(ev.sets_pro), 0)::int as sets_pro,
        coalesce(sum(ev.sets_contra), 0)::int as sets_contra,
        coalesce(sum(ev.pontos_pro), 0)::int as pontos_pro,
        coalesce(sum(ev.pontos_contra), 0)::int as pontos_contra,
        coalesce(sum(ev.pontos), 0)::int as pontos
      from equipes e
      left join eventos ev on ev.equipe_id = e.equipe_id
      group by e.equipe_id, e.categoria, e.serie
    ),
    ranqueado as (
      select
        *,
        row_number() over (
          order by %s
        ) as posicao
      from agregado
    )
    insert into "ClassificacaoEntrada" (
      "equipeId", "ligaId", categoria, serie, posicao, pontos, jogos, vitorias, derrotas,
      "setsPro", "setsContra", "pontosPro", "pontosContra", punicoes, "atualizadoEm"
    )
    select
      equipe_id, $1, categoria, serie, posicao, pontos, jogos, vitorias, derrotas,
      sets_pro, sets_contra, pontos_pro, pontos_contra, 0, now()
    from ranqueado
    on conflict ("ligaId", "equipeId") do update set
      categoria = excluded.categoria,
      serie = excluded.serie,
      posicao = excluded.posicao,
      pontos = excluded.pontos,
      jogos = excluded.jogos,
      vitorias = excluded.vitorias,
      derrotas = excluded.derrotas,
      "setsPro" = excluded."setsPro",
      "setsContra" = excluded."setsContra",
      "pontosPro" = excluded."pontosPro",
      "pontosContra" = excluded."pontosContra",
      "atualizadoEm" = excluded."atualizadoEm"
  $fmt$, v_order_sql);

  execute v_sql using p_liga_id, v_pontuacao;
end;
$$;
