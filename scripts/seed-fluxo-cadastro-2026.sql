-- Dados de teste FLUXO-CADASTRO-2026. Não apaga outras massas.
-- Dois campeonatos iguais nos dois ambientes: um com classificação e um mata-mata.

do $$
declare
  organizador_id text;
  liga_class integer;
  liga_mata integer;
  categoria_class uuid;
  categoria_mata uuid;
  equipe_class_a integer;
  equipe_class_b integer;
  equipe_mata_a integer;
  equipe_mata_b integer;
  partida_id integer;
  jogador_n integer;
begin
  select c.id::text into organizador_id
  from "CandidaturaOrganizador" c
  where c.status in ('ATIVA', 'APROVADA', 'ATIVO', 'APROVADO')
  order by c.id
  limit 1;
  if organizador_id is null then
    select c.id::text into organizador_id from "CandidaturaOrganizador" c order by c.id limit 1;
  end if;
  if organizador_id is null then
    raise exception 'Não há organizador para receber a massa de teste.';
  end if;

  delete from "OcorrenciaPartida" where "partidaId" in (select id from "Partida" where "seedKey" like 'FLUXO-CADASTRO-%');
  delete from "SumulaPresenca" where "partidaId" in (select id from "Partida" where "seedKey" like 'FLUXO-CADASTRO-%');
  delete from "SetPartida" where "partidaId" in (select id from "Partida" where "seedKey" like 'FLUXO-CADASTRO-%');
  delete from "Partida" where "seedKey" like 'FLUXO-CADASTRO-%';
  delete from "ClassificacaoEntrada" where "ligaId" in (select id from "Liga" where "seedKey" like 'FLUXO-CADASTRO-%');
  delete from "Jogador" where "seedKey" like 'FLUXO-CADASTRO-%';
  delete from "InscricaoCampeonato" where "equipeId" in (select id from "Equipe" where "seedKey" like 'FLUXO-CADASTRO-%');
  delete from "Equipe" where "seedKey" like 'FLUXO-CADASTRO-%';
  delete from "CategoriaConfiguracao" where "ligaId" in (select id from "Liga" where "seedKey" like 'FLUXO-CADASTRO-%');
  delete from "CategoriaCampeonato" where "ligaId" in (select id from "Liga" where "seedKey" like 'FLUXO-CADASTRO-%');
  delete from "LigaSetupSecao" where "ligaId" in (select id from "Liga" where "seedKey" like 'FLUXO-CADASTRO-%');
  delete from "Liga" where "seedKey" like 'FLUXO-CADASTRO-%';

  insert into "Liga" (
    slug, nome, descricao, status, simulacao, formato, "faseEliminatoria",
    "setsPorPartida", "tieBreakUltimoSet", "pontosUltimoSet", "organizadorId", "seedKey",
    "dataInicio", "dataFim", "quantidadeEquipes", "quantidadeGrupos", "classificadosPorGrupo",
    "criteriosClassificacao", "inscricoesAbertas"
  ) values (
    'fluxo-cadastro-classificacao',
    'Campeonato Teste Classificação',
    'DADOS DE TESTE FLUXO-CADASTRO-2026',
    'ATIVA',
    false,
    'GRUPOS_MATA_MATA',
    'FINAL',
    3,
    true,
    15,
    organizador_id,
    'FLUXO-CADASTRO-CLASS',
    now() - interval '2 days',
    now() + interval '20 days',
    2,
    1,
    2,
    '["PONTOS","VITORIAS","SALDO_SETS","SALDO_PONTOS"]',
    false
  ) returning id into liga_class;

  insert into "Liga" (
    slug, nome, descricao, status, simulacao, formato, "faseEliminatoria",
    "setsPorPartida", "tieBreakUltimoSet", "pontosUltimoSet", "organizadorId", "seedKey",
    "dataInicio", "dataFim", "quantidadeEquipes", "criteriosClassificacao", "classificadosPorGrupo",
    "inscricoesAbertas"
  ) values (
    'fluxo-cadastro-mata-mata',
    'Campeonato Teste Mata-Mata',
    'DADOS DE TESTE FLUXO-CADASTRO-2026',
    'ATIVA',
    false,
    'MATA_MATA',
    'FINAL',
    3,
    true,
    15,
    organizador_id,
    'FLUXO-CADASTRO-MATA',
    now() - interval '2 days',
    now() + interval '20 days',
    2,
    null,
    null,
    false
  ) returning id into liga_mata;

  insert into "CategoriaCampeonato" ("ligaId", codigo, nome, slug, ordem, "statusConfiguracao")
  values (liga_class, 'MASCULINO', 'Masculino', 'masculino', 1, 'CONCLUIDA')
  returning id into categoria_class;
  insert into "CategoriaCampeonato" ("ligaId", codigo, nome, slug, ordem, "statusConfiguracao")
  values (liga_mata, 'MASCULINO', 'Masculino', 'masculino', 1, 'CONCLUIDA')
  returning id into categoria_mata;

  insert into "CategoriaConfiguracao" ("categoriaCampeonatoId", "ligaId", formato, "setsPorPartida", "pontosPorSet", "diferencaMinimaSet", "tieBreakUltimoSet", "pontosUltimoSet")
  values
    (categoria_class, liga_class, 'GRUPOS_MATA_MATA', 3, 25, 2, true, 15),
    (categoria_mata, liga_mata, 'MATA_MATA', 3, 25, 2, true, 15);

  insert into "Equipe" (nome, categoria, slug, "ligaId", "categoriaCampeonatoId", "seedKey")
  values ('Equipe Teste Alfa', 'MASCULINO', 'equipe-teste-alfa-classificacao', liga_class, categoria_class, 'FLUXO-CADASTRO-CLASS-EQ-A')
  returning id into equipe_class_a;
  insert into "Equipe" (nome, categoria, slug, "ligaId", "categoriaCampeonatoId", "seedKey")
  values ('Equipe Teste Beta', 'MASCULINO', 'equipe-teste-beta-classificacao', liga_class, categoria_class, 'FLUXO-CADASTRO-CLASS-EQ-B')
  returning id into equipe_class_b;
  insert into "Equipe" (nome, categoria, slug, "ligaId", "categoriaCampeonatoId", "seedKey")
  values ('Equipe Teste Alfa', 'MASCULINO', 'equipe-teste-alfa-mata-mata', liga_mata, categoria_mata, 'FLUXO-CADASTRO-MATA-EQ-A')
  returning id into equipe_mata_a;
  insert into "Equipe" (nome, categoria, slug, "ligaId", "categoriaCampeonatoId", "seedKey")
  values ('Equipe Teste Beta', 'MASCULINO', 'equipe-teste-beta-mata-mata', liga_mata, categoria_mata, 'FLUXO-CADASTRO-MATA-EQ-B')
  returning id into equipe_mata_b;

  insert into "InscricaoCampeonato" ("ligaId", "equipeId", "categoriaCampeonatoId", status, observacao)
  values
    (liga_class, equipe_class_a, categoria_class, 'APROVADA', 'DADOS DE TESTE FLUXO-CADASTRO-2026'),
    (liga_class, equipe_class_b, categoria_class, 'APROVADA', 'DADOS DE TESTE FLUXO-CADASTRO-2026'),
    (liga_mata, equipe_mata_a, categoria_mata, 'APROVADA', 'DADOS DE TESTE FLUXO-CADASTRO-2026'),
    (liga_mata, equipe_mata_b, categoria_mata, 'APROVADA', 'DADOS DE TESTE FLUXO-CADASTRO-2026');

  for jogador_n in 1..6 loop
    insert into "Jogador" (nome, posicao, numero, "equipeId", "autoRegistrado", banido, "seedKey")
    values (
      'Jogador Teste ' || lpad(jogador_n::text, 2, '0'),
      'Ponteiro',
      jogador_n,
      equipe_class_a,
      false,
      false,
      'FLUXO-CADASTRO-CLASS-J-' || lpad(jogador_n::text, 2, '0')
    );
    insert into "Jogador" (nome, posicao, numero, "equipeId", "autoRegistrado", banido, "seedKey")
    values (
      'Jogador Teste ' || lpad((jogador_n + 6)::text, 2, '0'),
      'Central',
      jogador_n,
      equipe_class_b,
      false,
      false,
      'FLUXO-CADASTRO-CLASS-J-' || lpad((jogador_n + 6)::text, 2, '0')
    );
  end loop;

  for jogador_n in 1..5 loop
    insert into "Jogador" (nome, posicao, numero, "equipeId", "autoRegistrado", banido, "seedKey")
    values (
      'Jogador Teste ' || lpad(jogador_n::text, 2, '0'),
      'Ponteiro',
      jogador_n,
      equipe_mata_a,
      false,
      false,
      'FLUXO-CADASTRO-MATA-J-' || lpad(jogador_n::text, 2, '0')
    );
    insert into "Jogador" (nome, posicao, numero, "equipeId", "autoRegistrado", banido, "seedKey")
    values (
      'Jogador Teste ' || lpad((jogador_n + 5)::text, 2, '0'),
      'Central',
      jogador_n,
      equipe_mata_b,
      false,
      false,
      'FLUXO-CADASTRO-MATA-J-' || lpad((jogador_n + 5)::text, 2, '0')
    );
  end loop;

  insert into "Partida" (
    "ligaId", "equipeAId", "equipeBId", categoria, rodada, status, "dataHora", "localNome",
    "setsPorA", "setsPorB", "pontosPorA", "pontosPorB", "vencedorId", "sumulaSubmetidaEm",
    fase, "categoriaCampeonatoId", "seedKey"
  ) values (
    liga_class, equipe_class_a, equipe_class_b, 'MASCULINO', 1, 'ENCERRADA', now() - interval '1 day', 'Quadra Teste',
    2, 0, 25, 18, equipe_class_a, now() - interval '22 hours',
    'GRUPOS', categoria_class, 'FLUXO-CADASTRO-CLASS-ENCERRADA'
  ) returning id into partida_id;
  insert into "SetPartida" ("partidaId", numero, "pontosA", "pontosB")
  values (partida_id, 1, 25, 18), (partida_id, 2, 25, 20);

  insert into "Partida" (
    "ligaId", "equipeAId", "equipeBId", categoria, rodada, status, "dataHora", "localNome",
    "setsPorA", "setsPorB", "pontosPorA", "pontosPorB", fase, "categoriaCampeonatoId", "seedKey"
  ) values (
    liga_class, equipe_class_a, equipe_class_b, 'MASCULINO', 2, 'EM_ANDAMENTO', now() - interval '15 minutes', 'Quadra Teste',
    1, 0, 12, 9, 'GRUPOS', categoria_class, 'FLUXO-CADASTRO-CLASS-ANDAMENTO'
  ) returning id into partida_id;
  insert into "SetPartida" ("partidaId", numero, "pontosA", "pontosB")
  values (partida_id, 1, 25, 21), (partida_id, 2, 12, 9);

  insert into "Partida" (
    "ligaId", "equipeAId", "equipeBId", categoria, rodada, status, "dataHora", "localNome",
    "setsPorA", "setsPorB", "pontosPorA", "pontosPorB", "vencedorId", "sumulaSubmetidaEm",
    fase, "categoriaCampeonatoId", "seedKey"
  ) values (
    liga_mata, equipe_mata_a, equipe_mata_b, 'MASCULINO', 1, 'ENCERRADA', now() - interval '3 hours', 'Quadra Teste',
    2, 1, 25, 23, equipe_mata_a, now() - interval '2 hours',
    'FINAL', categoria_mata, 'FLUXO-CADASTRO-MATA-ENCERRADA'
  ) returning id into partida_id;
  insert into "SetPartida" ("partidaId", numero, "pontosA", "pontosB")
  values (partida_id, 1, 25, 20), (partida_id, 2, 22, 25), (partida_id, 3, 15, 10);

  insert into "SumulaPresenca" ("partidaId", "jogadorId", "equipeId", presente, numero)
  select partida.id, jogador.id, jogador."equipeId", true, jogador.numero
  from "Partida" partida
  join "Jogador" jogador on jogador."equipeId" in (partida."equipeAId", partida."equipeBId")
  where partida."seedKey" like 'FLUXO-CADASTRO-%';

  insert into "OcorrenciaPartida" ("partidaId", tipo, descricao, "set", "jogadorId")
  select partida.id, evento.tipo, evento.descricao, 1, jogador.id
  from "Partida" partida
  join (values
    ('attack', 'Ponto de ataque de teste', 1),
    ('ace', 'Saque ace de teste', 2),
    ('block', 'Bloqueio de teste', 3)
  ) as evento(tipo, descricao, numero) on true
  join "Jogador" jogador on jogador."equipeId" = partida."equipeAId" and jogador.numero = evento.numero
  where partida."seedKey" in ('FLUXO-CADASTRO-CLASS-ENCERRADA', 'FLUXO-CADASTRO-CLASS-ANDAMENTO', 'FLUXO-CADASTRO-MATA-ENCERRADA');

  insert into "LigaSetupSecao" ("ligaId", secao, status, "concluidoEm")
  select liga_class, secao, 'completed', now()
  from unnest(array['informacoes','estrutura','classificacao','eliminatorias','calendario','inscricoes']) as secao;

  insert into "LigaSetupSecao" ("ligaId", secao, status, "concluidoEm")
  select liga_mata, secao, 'completed', now()
  from unnest(array['informacoes','estrutura','eliminatorias','calendario','inscricoes']) as secao;

  insert into "ClassificacaoEntrada" (
    "ligaId", "categoriaCampeonatoId", "equipeId", categoria, posicao, pontos, jogos, vitorias, derrotas,
    "setsPro", "setsContra", "pontosPro", "pontosContra", punicoes, "atualizadoEm"
  ) values
    (liga_class, categoria_class, equipe_class_a, 'MASCULINO', 1, 3, 1, 1, 0, 2, 0, 25, 18, 0, now()),
    (liga_class, categoria_class, equipe_class_b, 'MASCULINO', 2, 0, 1, 0, 1, 0, 2, 18, 25, 0, now());
  delete from "ClassificacaoEntrada" where "ligaId" = liga_mata;
end $$;
