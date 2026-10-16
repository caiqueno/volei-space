-- supabase/seed.sql  (Rodada 2)
--
-- Dados 100% FICTÍCIOS para banco LOCAL ou de PREVIEW. Nunca rodar em produção.
-- Executado pelo `supabase db reset` (ver supabase/config.toml, [db.seed]) DEPOIS das migrations
-- de supabase/migrations. Antes disso o banco precisa da baseline do schema (docs/analise/22).
--
-- NUNCA FOI EXECUTADO por um Postgres. Foi escrito só contra colunas que aparecem nas migrations
-- aplicáveis (supabase/migrations) e em scripts/seed-torneio-2026.sql. O que não tem certeza está
-- comentado no fim, com o motivo.
--
-- Conteúdo:
--   2 organizadores        (CandidaturaOrganizador, sem senha: não há login com estes cadastros)
--   3 competições          aberta, privada (simulacao = true + link de convite) e encerrada
--   4 equipes com atletas  2 na aberta, 2 na encerrada (6 atletas cada)
--   1 partida em andamento na competição aberta (+ 1 encerrada e 1 agendada para dar contexto)
--
-- Idempotente: cada linha é identificada por id/seedKey fixo e só é inserida se ainda não existir.
-- Não apaga nada. Pode rodar quantas vezes quiser.
--
-- Dados pessoais: todos inventados. CPFs são sequências inválidas (000.000.000-0X, dígitos
-- verificadores errados de propósito), e-mails usam o domínio reservado .invalid (RFC 2606),
-- telefones são 0000-000X, nascimentos são datas arbitrárias. Nenhum documento é enviado.
-- Nada de segredo: sem senhaHash, sem token de árbitro, sem chave.

do $seed$
declare
  org_a   text := 'seed-r2-org-a';
  org_b   text := 'seed-r2-org-b';
  liga_id integer;
  cat_id  uuid;
  chave   text;
  slug_c  text;
  ligas   text[][] := array[
    -- chave,            slug,                  nome,                          status,      simulacao, organizador
    ['SEED-R2-LIGA-01', 'seed-r2-copa-aberta',   'Copa Aberta de Teste (seed)',   'ATIVA',     'false', 'seed-r2-org-a'],
    ['SEED-R2-LIGA-02', 'seed-r2-copa-privada',  'Copa Privada de Teste (seed)',  'ATIVA',     'true',  'seed-r2-org-b'],
    ['SEED-R2-LIGA-03', 'seed-r2-copa-encerrada','Copa Encerrada de Teste (seed)','ENCERRADA', 'false', 'seed-r2-org-a']
  ];
  i       integer;
  e       integer;
  j       integer;
  equipe_id integer;
  chave_eq  text;
  eq_a    integer;
  eq_b    integer;
  partida_id integer;
  nomes_eq text[] := array['Seed Falcões', 'Seed Tubarões', 'Seed Corujas', 'Seed Leopardos'];
  nomes_at text[] := array['Ana', 'Bia', 'Carla', 'Duda', 'Elisa', 'Fabi'];
  posicoes text[] := array['Levantador', 'Oposto', 'Ponteiro', 'Central', 'Líbero', 'Ponteiro'];
begin
  ---------------------------------------------------------------------------
  -- 1) Organizadores (cadastro legado; "Liga"."organizadorId" = "CandidaturaOrganizador".id)
  ---------------------------------------------------------------------------
  if not exists (select 1 from "CandidaturaOrganizador" where id = org_a) then
    insert into "CandidaturaOrganizador" (id, nome, email, telefone, organizacao, cidade, plano, status)
    values (org_a, 'Organizador Seed A', 'organizador.a@seed.invalid', '00000000001',
            'Organização Seed A', 'Cidade Fictícia', 'PADRAO', 'ATIVA');
  end if;
  if not exists (select 1 from "CandidaturaOrganizador" where id = org_b) then
    insert into "CandidaturaOrganizador" (id, nome, email, telefone, organizacao, cidade, plano, status)
    values (org_b, 'Organizador Seed B', 'organizador.b@seed.invalid', '00000000002',
            'Organização Seed B', 'Cidade Fictícia', 'PADRAO', 'ATIVA');
  end if;

  ---------------------------------------------------------------------------
  -- 2) Competições + categoria única "MASCULINO" em cada uma
  ---------------------------------------------------------------------------
  for i in 1..3 loop
    chave  := ligas[i][1];
    slug_c := ligas[i][2];

    select id into liga_id from "Liga" where "seedKey" = chave;
    if liga_id is null then
      insert into "Liga" (
        slug, nome, descricao, status, simulacao, "setsPorPartida", "tieBreakUltimoSet", "pontosUltimoSet",
        "organizadorId", "seedKey", "dataInicio", "dataFim"
      ) values (
        slug_c, ligas[i][3], 'SEED-R2 (dados fictícios)', ligas[i][4], ligas[i][5]::boolean,
        3, true, 15, ligas[i][6], chave,
        case when ligas[i][4] = 'ENCERRADA' then now() - interval '60 days' else now() - interval '7 days' end,
        case when ligas[i][4] = 'ENCERRADA' then now() - interval '30 days' else now() + interval '21 days' end
      )
      returning id into liga_id;
    end if;

    select id into cat_id from "CategoriaCampeonato" where "ligaId" = liga_id and codigo = 'MASCULINO';
    if cat_id is null then
      insert into "CategoriaCampeonato" ("ligaId", codigo, nome, slug, ordem, "statusConfiguracao")
      values (liga_id, 'MASCULINO', 'Masculino', 'masculino', 1, 'CONCLUIDA')
      returning id into cat_id;
    end if;

    insert into "CategoriaConfiguracao" (
      "categoriaCampeonatoId", "ligaId", formato, "setsPorPartida", "pontosPorSet",
      "diferencaMinimaSet", "tieBreakUltimoSet", "pontosUltimoSet"
    ) values (cat_id, liga_id, 'PONTOS_CORRIDOS', 3, 25, 2, true, 15)
    on conflict ("categoriaCampeonatoId") do nothing;

    -----------------------------------------------------------------------
    -- 3) Equipes: 2 na competição aberta (i = 1) e 2 na encerrada (i = 3); a privada fica sem equipe.
    -----------------------------------------------------------------------
    if i in (1, 3) then
      for e in 1..2 loop
        chave_eq := 'SEED-R2-EQ-' || lpad((case when i = 1 then e else e + 2 end)::text, 2, '0');
        select id into equipe_id from "Equipe" where "seedKey" = chave_eq;
        if equipe_id is null then
          insert into "Equipe" (nome, categoria, "ligaId", "categoriaCampeonatoId", "statusEquipe", "seedKey")
          values (nomes_eq[case when i = 1 then e else e + 2 end], 'MASCULINO', liga_id, cat_id, 'ATIVA', chave_eq)
          returning id into equipe_id;
        end if;

        -- 4) Atletas fictícios (6 por equipe; numero 1 a 6; CPF inválido de propósito)
        for j in 1..6 loop
          insert into "Jogador" (nome, posicao, numero, "equipeId", "autoRegistrado", banido, "seedKey", cpf, "dataNascimento")
          select nomes_at[j] || ' ' || nomes_eq[case when i = 1 then e else e + 2 end],
                 posicoes[j], j, equipe_id, false, false,
                 'TESTE-SEED-R2-' || chave_eq || '-J' || lpad(j::text, 3, '0'),
                 '000.000.000-0' || j,
                 date '2000-01-01' + (j * 37)
          where not exists (
            select 1 from "Jogador" ja
            where ja."seedKey" = 'TESTE-SEED-R2-' || chave_eq || '-J' || lpad(j::text, 3, '0')
          );
        end loop;
      end loop;
    end if;
  end loop;

  ---------------------------------------------------------------------------
  -- 5) Partidas
  ---------------------------------------------------------------------------
  -- 5a) Competição aberta: 1 partida EM ANDAMENTO (set 1 encerrado 25 x 20, set 2 em 12 x 9).
  select l.id, c.id into liga_id, cat_id
  from "Liga" l join "CategoriaCampeonato" c on c."ligaId" = l.id and c.codigo = 'MASCULINO'
  where l."seedKey" = 'SEED-R2-LIGA-01';
  select id into eq_a from "Equipe" where "seedKey" = 'SEED-R2-EQ-01';
  select id into eq_b from "Equipe" where "seedKey" = 'SEED-R2-EQ-02';

  if liga_id is not null and eq_a is not null and eq_b is not null
     and not exists (select 1 from "Partida" where "seedKey" = 'SEED-R2-GAME-01') then
    insert into "Partida" (
      "ligaId", "equipeAId", "equipeBId", categoria, rodada, status, "dataHora", "localNome",
      "setsPorA", "setsPorB", "pontosPorA", "pontosPorB", fase, "categoriaCampeonatoId", "seedKey"
    ) values (
      liga_id, eq_a, eq_b, 'MASCULINO', 1, 'EM_ANDAMENTO', now() - interval '20 minutes', 'Quadra Seed 1',
      1, 0, 12, 9, 'GERAL', cat_id, 'SEED-R2-GAME-01'
    ) returning id into partida_id;
    insert into "SetPartida" ("partidaId", numero, "pontosA", "pontosB")
    values (partida_id, 1, 25, 20), (partida_id, 2, 12, 9);
  end if;

  -- 5b) Competição aberta: 1 partida AGENDADA (para a tela de próximos jogos).
  if liga_id is not null and eq_a is not null and eq_b is not null
     and not exists (select 1 from "Partida" where "seedKey" = 'SEED-R2-GAME-02') then
    insert into "Partida" (
      "ligaId", "equipeAId", "equipeBId", categoria, rodada, status, "dataHora", "localNome",
      fase, "categoriaCampeonatoId", "seedKey"
    ) values (
      liga_id, eq_b, eq_a, 'MASCULINO', 2, 'AGENDADA', now() + interval '3 days', 'Quadra Seed 1',
      'GERAL', cat_id, 'SEED-R2-GAME-02'
    );
  end if;

  -- 5c) Competição encerrada: 1 partida ENCERRADA 3 x 0 (classificação e histórico).
  select l.id, c.id into liga_id, cat_id
  from "Liga" l join "CategoriaCampeonato" c on c."ligaId" = l.id and c.codigo = 'MASCULINO'
  where l."seedKey" = 'SEED-R2-LIGA-03';
  select id into eq_a from "Equipe" where "seedKey" = 'SEED-R2-EQ-03';
  select id into eq_b from "Equipe" where "seedKey" = 'SEED-R2-EQ-04';

  if liga_id is not null and eq_a is not null and eq_b is not null
     and not exists (select 1 from "Partida" where "seedKey" = 'SEED-R2-GAME-03') then
    insert into "Partida" (
      "ligaId", "equipeAId", "equipeBId", categoria, rodada, status, "dataHora", "localNome",
      "setsPorA", "setsPorB", "pontosPorA", "pontosPorB", "vencedorId", "sumulaSubmetidaEm",
      fase, "categoriaCampeonatoId", "seedKey"
    ) values (
      liga_id, eq_a, eq_b, 'MASCULINO', 1, 'ENCERRADA', now() - interval '45 days', 'Quadra Seed 2',
      3, 0, 25, 18, eq_a, now() - interval '45 days' + interval '95 minutes',
      'GERAL', cat_id, 'SEED-R2-GAME-03'
    ) returning id into partida_id;
    insert into "SetPartida" ("partidaId", numero, "pontosA", "pontosB")
    values (partida_id, 1, 25, 18), (partida_id, 2, 25, 20), (partida_id, 3, 25, 22);
  end if;

  ---------------------------------------------------------------------------
  -- 6) Competição privada: acesso por link de convite (tabela de 202610010003).
  --    Token fictício e fixo, só para teste local; não é segredo de produção.
  ---------------------------------------------------------------------------
  select id into liga_id from "Liga" where "seedKey" = 'SEED-R2-LIGA-02';
  if liga_id is not null then
    insert into "LinkInscricaoCampeonato" ("ligaId", token, ativo, "criadoPor")
    values (liga_id, 'seed-r2-convite-privada-0000000000000000', true, org_b)
    on conflict ("ligaId") do nothing;
  end if;
end
$seed$;

-- Conferência (somente leitura): deve devolver 3, 4, 24 e 3.
select
  (select count(*) from "Liga" where "seedKey" like 'SEED-R2-LIGA-%') as competicoes,
  (select count(*) from "Equipe" where "seedKey" like 'SEED-R2-EQ-%') as equipes,
  (select count(*) from "Jogador" where "seedKey" like 'TESTE-SEED-R2-%') as atletas,
  (select count(*) from "Partida" where "seedKey" like 'SEED-R2-GAME-%') as partidas;

-------------------------------------------------------------------------------
-- TRECHOS SEM CERTEZA (deixados fora de propósito)
-------------------------------------------------------------------------------
-- * Tabelas das migrations pendentes (supabase/pendentes): Organizador, Clube, TimeClube, Atleta,
--   Inscricao... NÃO são semeadas aqui porque ainda não existem no schema aplicável. Depois que
--   as pendentes 0024 a 0026 forem promovidas, acrescentar (exemplo, não executado):
--     insert into "Organizador" (nome, "legadoId") values ('Organizador Seed A', 'seed-r2-org-a')
--       on conflict ("legadoId") do nothing;
-- * "Liga"."inscricoesAbertas", "regulamento" e demais campos da tela de inscrição: dependem do DDL
--   real de "Liga" (não há CREATE TABLE no repositório; prisma/schema.prisma está defasado). Usar os
--   defaults do banco e conferir em preview.
-- * Presença de súmula (SumulaPresenca) para a partida em andamento: omitida; o guard de
--   202609220003 exige jogador da equipe da partida e a súmula é criada pelo app ao iniciar o jogo.
-- * Acesso de árbitro à partida (AcessoArbitroJogo): exige pgcrypto/extensions.crypt e código; use
--   scripts/massa-acesso-arbitro.ts, que já cuida disso, em vez de gravar código no seed.
