-- supabase/seed.sql  (Rodada 19)
--
-- SOMENTE PARA DESENVOLVIMENTO / LOCAL. Dados 100% FICTÍCIOS. NUNCA rodar em produção.
-- Executado pelo `supabase db reset` (supabase/config.toml, [db.seed]) DEPOIS das migrations, ou
-- colado no SQL Editor do projeto Supabase de DESENVOLVIMENTO. O banco precisa já ter o schema
-- base (docs/analise/22) e as migrations de supabase/migrations.
--
-- Funciona num banco VAZIO: todo INSERT informa o id explicitamente (nada depende de sequência
-- ou default) e as linhas entram na ordem das chaves estrangeiras:
--   CandidaturaOrganizador -> Liga -> CategoriaCampeonato -> CategoriaConfiguracao
--   -> Equipe -> Jogador -> Partida -> SetPartida
-- É idempotente: cada INSERT termina em on conflict do nothing. Não apaga nada; pode rodar
-- quantas vezes quiser.
--
-- Conteúdo:
--   1 organizador fictício (sem senha: ninguém entra com ele)
--   1 liga pública "Liga Seed (fictícia)" com 2 categorias (Masculino e Feminino)
--   6 equipes (3 por categoria), 48 jogadores (8 por equipe) com nomes inventados
--   6 jogos: 3 encerrados, 1 em andamento, 2 agendados
--
-- Faixa de ids reservada ao seed (para não colidir com dados reais criados depois):
--   Liga 9001, Equipe 9101 a 9106, Jogador 910101 a 910608, Partida 9201 a 9206,
--   SetPartida 920101 em diante.
-- Se o banco usa sequência para o id, ela continua em 1 e não conflita com essa faixa.
--
-- Dados pessoais: nenhum real. Sem CPF, sem telefone, sem data de nascimento, sem documento,
-- sem foto. O único e-mail usa o domínio reservado .invalid (RFC 2606). Sem segredo: sem
-- senhaHash, sem token de árbitro, sem chave.
--
-- O administrador NÃO é criado aqui: veja docs/ROTEIRO-TESTE-LOCAL.md.

begin;

-- 1) Organizador fictício (Liga.organizadorId referencia CandidaturaOrganizador.id)
insert into "CandidaturaOrganizador" (id, nome, email, organizacao, cidade, plano, status)
values ('seed-r19-org', 'Organizador Seed', 'organizador@seed.invalid',
        'Organização Seed', 'Cidade Fictícia', 'PADRAO', 'ATIVA')
on conflict do nothing;

-- 2) Liga pública (simulacao = false: aparece na vitrine; sem link de convite)
insert into "Liga" (
  id, slug, nome, descricao, status, simulacao, "setsPorPartida", "tieBreakUltimoSet",
  "pontosUltimoSet", "organizadorId", "seedKey", "dataInicio", "dataFim"
) values (
  9001, 'seed-liga-ficticia', 'Liga Seed (fictícia)', 'Dados de desenvolvimento, todos inventados.',
  'ATIVA', false, 3, true, 15, 'seed-r19-org', 'SEED-R19-LIGA-01',
  now() - interval '14 days', now() + interval '30 days'
)
on conflict do nothing;

-- 3) Duas categorias
insert into "CategoriaCampeonato" (id, "ligaId", codigo, nome, slug, ordem, "statusConfiguracao")
values
  ('00000000-0000-4000-8000-000000009a01', 9001, 'MASCULINO', 'Masculino', 'masculino', 1, 'CONCLUIDA'),
  ('00000000-0000-4000-8000-000000009a02', 9001, 'FEMININO',  'Feminino',  'feminino',  2, 'CONCLUIDA')
on conflict do nothing;

insert into "CategoriaConfiguracao" (
  "categoriaCampeonatoId", "ligaId", formato, "setsPorPartida", "pontosPorSet",
  "diferencaMinimaSet", "tieBreakUltimoSet", "pontosUltimoSet"
) values
  ('00000000-0000-4000-8000-000000009a01', 9001, 'PONTOS_CORRIDOS', 3, 25, 2, true, 15),
  ('00000000-0000-4000-8000-000000009a02', 9001, 'PONTOS_CORRIDOS', 3, 25, 2, true, 15)
on conflict do nothing;

-- 4) Seis equipes
insert into "Equipe" (id, nome, categoria, "ligaId", "categoriaCampeonatoId", "statusEquipe", "seedKey")
values
  (9101, 'Seed Falcões',  'MASCULINO', 9001, '00000000-0000-4000-8000-000000009a01', 'ATIVA', 'SEED-R19-EQ-01'),
  (9102, 'Seed Tubarões', 'MASCULINO', 9001, '00000000-0000-4000-8000-000000009a01', 'ATIVA', 'SEED-R19-EQ-02'),
  (9103, 'Seed Corujas',  'MASCULINO', 9001, '00000000-0000-4000-8000-000000009a01', 'ATIVA', 'SEED-R19-EQ-03'),
  (9104, 'Seed Gaivotas', 'FEMININO',  9001, '00000000-0000-4000-8000-000000009a02', 'ATIVA', 'SEED-R19-EQ-04'),
  (9105, 'Seed Panteras', 'FEMININO',  9001, '00000000-0000-4000-8000-000000009a02', 'ATIVA', 'SEED-R19-EQ-05'),
  (9106, 'Seed Garças',   'FEMININO',  9001, '00000000-0000-4000-8000-000000009a02', 'ATIVA', 'SEED-R19-EQ-06')
on conflict do nothing;

-- 5) 48 jogadores: 8 por equipe. Nome = primeiro nome (do naipe) + sobrenome inventado da equipe.
--    id = id da equipe * 100 + número da camisa (ex.: 910103 = camisa 3 da equipe 9101).
insert into "Jogador" (id, nome, posicao, numero, "equipeId", "autoRegistrado", banido, "seedKey")
select
  t.eid * 100 + n,
  (case when t.eid <= 9103
     then (array['Arlindo','Benício','Crispim','Dagoberto','Elói','Fausto','Giordano','Hermes'])[n]
     else (array['Aurora','Bernadete','Cecília','Dalila','Eulália','Fabíola','Gioconda','Heloísa'])[n]
   end) || ' ' || t.sobrenome,
  (array['Levantador','Oposto','Ponteiro','Central','Líbero','Ponteiro','Central','Oposto'])[n],
  n, t.eid, false, false,
  'SEED-R19-JOG-' || t.eid || '-' || lpad(n::text, 2, '0')
from (values
  (9101, 'Vasconcelo-Teste'),
  (9102, 'Montalvão-Teste'),
  (9103, 'Quintanar-Teste'),
  (9104, 'Arrudeiro-Teste'),
  (9105, 'Pimentelli-Teste'),
  (9106, 'Casagrandi-Teste')
) as t(eid, sobrenome)
cross join generate_series(1, 8) as n
on conflict do nothing;

-- 6) Seis jogos em estados variados (pontos = soma dos sets)
insert into "Partida" (
  id, "ligaId", "equipeAId", "equipeBId", categoria, "categoriaCampeonatoId", rodada, status,
  "dataHora", "localNome", "setsPorA", "setsPorB", "pontosPorA", "pontosPorB", "vencedorId",
  "sumulaSubmetidaEm", fase, "seedKey"
) values
  -- Masculino: encerrado 3 x 0, em andamento (1 x 0, segundo set 12 x 9), agendado
  (9201, 9001, 9101, 9102, 'MASCULINO', '00000000-0000-4000-8000-000000009a01', 1, 'ENCERRADA',
   now() - interval '10 days', 'Quadra Seed 1', 3, 0, 75, 60, 9101,
   now() - interval '10 days' + interval '95 minutes', 'GERAL', 'SEED-R19-GAME-01'),
  (9202, 9001, 9102, 9103, 'MASCULINO', '00000000-0000-4000-8000-000000009a01', 2, 'EM_ANDAMENTO',
   now() - interval '20 minutes', 'Quadra Seed 1', 1, 0, 37, 29, null,
   null, 'GERAL', 'SEED-R19-GAME-02'),
  (9203, 9001, 9103, 9101, 'MASCULINO', '00000000-0000-4000-8000-000000009a01', 3, 'AGENDADA',
   now() + interval '3 days', 'Quadra Seed 1', null, null, null, null, null,
   null, 'GERAL', 'SEED-R19-GAME-03'),
  -- Feminino: encerrado 3 x 1, encerrado 3 x 2, agendado
  (9204, 9001, 9104, 9105, 'FEMININO', '00000000-0000-4000-8000-000000009a02', 1, 'ENCERRADA',
   now() - interval '9 days', 'Quadra Seed 2', 3, 1, 95, 88, 9104,
   now() - interval '9 days' + interval '110 minutes', 'GERAL', 'SEED-R19-GAME-04'),
  (9205, 9001, 9105, 9106, 'FEMININO', '00000000-0000-4000-8000-000000009a02', 2, 'ENCERRADA',
   now() - interval '3 days', 'Quadra Seed 2', 3, 2, 103, 107, 9105,
   now() - interval '3 days' + interval '130 minutes', 'GERAL', 'SEED-R19-GAME-05'),
  (9206, 9001, 9106, 9104, 'FEMININO', '00000000-0000-4000-8000-000000009a02', 3, 'AGENDADA',
   now() + interval '5 days', 'Quadra Seed 2', null, null, null, null, null,
   null, 'GERAL', 'SEED-R19-GAME-06')
on conflict do nothing;

-- 7) Sets das partidas que já começaram
insert into "SetPartida" (id, "partidaId", numero, "pontosA", "pontosB")
values
  (920101, 9201, 1, 25, 18), (920102, 9201, 2, 25, 20), (920103, 9201, 3, 25, 22),
  (920201, 9202, 1, 25, 20), (920202, 9202, 2, 12, 9),
  (920401, 9204, 1, 25, 23), (920402, 9204, 2, 20, 25), (920403, 9204, 3, 25, 21), (920404, 9204, 4, 25, 19),
  (920501, 9205, 1, 25, 22), (920502, 9205, 2, 20, 25), (920503, 9205, 3, 25, 23),
  (920504, 9205, 4, 18, 25), (920505, 9205, 5, 15, 12)
on conflict do nothing;

commit;

-- Conferência (somente leitura): deve devolver 1, 2, 6, 48, 6 e 14.
select
  (select count(*) from "Liga" where "seedKey" = 'SEED-R19-LIGA-01') as ligas,
  (select count(*) from "CategoriaCampeonato" where "ligaId" = 9001) as categorias,
  (select count(*) from "Equipe" where "seedKey" like 'SEED-R19-EQ-%') as equipes,
  (select count(*) from "Jogador" where "seedKey" like 'SEED-R19-JOG-%') as jogadores,
  (select count(*) from "Partida" where "seedKey" like 'SEED-R19-GAME-%') as partidas,
  (select count(*) from "SetPartida" where "partidaId" between 9201 and 9206) as sets;

-------------------------------------------------------------------------------
-- LIMITES CONHECIDOS (nunca foi executado por um Postgres)
-------------------------------------------------------------------------------
-- * Escrito só contra colunas que aparecem nas migrations e no prisma/schema.prisma. As tabelas
--   Liga, Equipe, Jogador, Partida e SetPartida vêm da baseline (docs/analise/22), que não está
--   versionada. "Jogador"."seedKey" só existe no schema.prisma: se faltar no banco, remova a
--   coluna do passo 5.
-- * Os dados SEED-R2-* da versão antiga deste arquivo não são removidos de bancos que já os têm.
-- * Meu Time (Organizador, Clube, Atleta, Inscricao...) não é semeado: depende das migrations
--   pendentes 0024 a 0026. Depois de aplicá-las no banco de desenvolvimento, crie um time pela tela.
-- * Acesso de árbitro à partida: use scripts/massa-acesso-arbitro.ts, que cuida de pgcrypto.
