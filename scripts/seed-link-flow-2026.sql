-- Massa LINK-FLOW-2026. Não apaga dados e não reutiliza SEED-CHAMP / SEED-GAME.
-- Códigos do árbitro ficam em scripts/massa-link-flow.ts.

do $$
declare
  organizador_id text;
  campeonato integer;
  equipe_n integer;
  jogador_n integer;
  jogo integer;
  liga_id integer;
  categoria_id uuid;
  equipe_id integer;
  equipe_a integer;
  equipe_b integer;
  partida_id integer;
  chave_liga text;
  chave_jogo text;
  chave_equipe text;
  indice_a integer;
  indice_b integer;
  status_jogo text;
  inicio timestamp;
  sets_a integer;
  sets_b integer;
  pontos_a integer;
  pontos_b integer;
  vencedor integer;
  clubes text[] := array['Atlas','Bruma','Cume','Dorsal','Estrela','Fronteira','Galeão','Horizonte','Ícaro','Jatobá'];
  nomes text[] := array['Lucas','Rafael','Gabriel','Bruno','Caio','Diego','Felipe','André','Matheus','João','Pedro','Gustavo'];
  sobrenomes text[] := array['Monteiro','Ventura','Nogueira','Valença','Ferraz','Tavares','Noronha','Vasconcelos','Ribeiro','Vilar','Alencar','Paiva'];
  posicoes text[] := array['Levantador','Oposto','Ponteiro','Central','Líbero','Ponteiro','Levantador','Oposto','Central','Ponteiro','Líbero','Central'];
  titulos text[] := array[
    'Copa Nacional de Vôlei 2026','Liga Paulista de Vôlei 2026','Copa Metropolitana 2026','Super Torneio Regional 2026','Liga das Academias 2026',
    'Copa Brasil Esportiva 2026','Torneio Elite 2026','Liga das Cidades 2026','Copa Master 2026','Grand Championship 2026'
  ];
begin
  select c.id::text into organizador_id
  from "CandidaturaOrganizador" c
  where c.status in ('ATIVA', 'APROVADA', 'ATIVO', 'APROVADO')
  order by c.id
  limit 1;
  if organizador_id is null then
    select c.id::text into organizador_id from "CandidaturaOrganizador" c order by c.id limit 1;
  end if;

  for campeonato in 1..10 loop
    chave_liga := 'LINK-FLOW-CHAMP-' || lpad(campeonato::text, 2, '0');
    select id into liga_id from "Liga" where "seedKey" = chave_liga;
    if liga_id is null then
      insert into "Liga" (
        slug, nome, descricao, status, simulacao, "setsPorPartida", "tieBreakUltimoSet", "pontosUltimoSet",
        "organizadorId", "seedKey", "dataInicio", "dataFim", "quantidadeEquipes", "inscricoesAbertas",
        "inscricoesAberturaEm", "inscricoesEncerramentoEm"
      ) values (
        'link-flow-champ-' || lpad(campeonato::text, 2, '0'),
        titulos[campeonato],
        'LINK-FLOW-2026',
        'ATIVA',
        false,
        5,
        true,
        15,
        organizador_id,
        chave_liga,
        now() - interval '7 days',
        now() + interval '21 days',
        case when campeonato = 9 then 11 else 16 end,
        true,
        case when campeonato = 5 then now() + interval '10 days' else now() - interval '20 days' end,
        case when campeonato = 6 then now() - interval '1 day' else now() + interval '20 days' end
      )
      returning id into liga_id;
    end if;

    select id into categoria_id from "CategoriaCampeonato" where "ligaId" = liga_id and codigo = 'MASCULINO';
    if categoria_id is null then
      insert into "CategoriaCampeonato" ("ligaId", codigo, nome, slug, ordem, "statusConfiguracao")
      values (liga_id, 'MASCULINO', 'Masculino', 'masculino', 1, 'CONCLUIDA')
      returning id into categoria_id;
    end if;

    insert into "CategoriaConfiguracao" ("categoriaCampeonatoId", "ligaId", formato, "setsPorPartida", "pontosPorSet", "diferencaMinimaSet", "tieBreakUltimoSet", "pontosUltimoSet")
    values (categoria_id, liga_id, 'PONTOS_CORRIDOS', 5, 25, 2, true, 15)
    on conflict ("categoriaCampeonatoId") do nothing;

    for equipe_n in 1..10 loop
      chave_equipe := chave_liga || '-EQ' || lpad(equipe_n::text, 2, '0');
      select id into equipe_id from "Equipe" where "seedKey" = chave_equipe;
      if equipe_id is null then
        insert into "Equipe" (nome, categoria, "ligaId", "categoriaCampeonatoId", "seedKey")
        values ('Vôlei ' || clubes[equipe_n] || ' ' || lpad(campeonato::text, 2, '0'), 'MASCULINO', liga_id, categoria_id, chave_equipe)
        returning id into equipe_id;
      end if;
      for jogador_n in 1..12 loop
        insert into "Jogador" (nome, posicao, numero, "equipeId", "autoRegistrado", banido, "seedKey")
        select nomes[jogador_n] || ' ' || sobrenomes[1 + ((jogador_n + equipe_n - 2) % 12)],
               posicoes[jogador_n],
               jogador_n,
               equipe_id,
               false,
               jogador_n = 12 and equipe_n = 10,
               'TESTE-LINK-2026-CH' || lpad(campeonato::text, 2, '0') || '-EQ' || lpad(equipe_n::text, 2, '0') || '-J' || lpad(jogador_n::text, 3, '0')
        where not exists (
          select 1 from "Jogador" ja
          where ja."seedKey" = 'TESTE-LINK-2026-CH' || lpad(campeonato::text, 2, '0') || '-EQ' || lpad(equipe_n::text, 2, '0') || '-J' || lpad(jogador_n::text, 3, '0')
        );
      end loop;
    end loop;

    for jogo in 1..40 loop
      chave_jogo := 'LINK-FLOW-GAME-' || lpad(campeonato::text, 2, '0') || '-' || lpad(jogo::text, 3, '0');
      if exists (select 1 from "Partida" where "seedKey" = chave_jogo) then
        continue;
      end if;
      indice_a := ((jogo - 1) % 10) + 1;
      indice_b := ((jogo + 3) % 10) + 1;
      if indice_a = indice_b then indice_b := (indice_a % 10) + 1; end if;
      select id into equipe_a from "Equipe" where "seedKey" = chave_liga || '-EQ' || lpad(indice_a::text, 2, '0');
      select id into equipe_b from "Equipe" where "seedKey" = chave_liga || '-EQ' || lpad(indice_b::text, 2, '0');
      if jogo <= 10 then
        status_jogo := 'ENCERRADA';
        inicio := now() - make_interval(hours => campeonato * 6 + jogo);
        if jogo % 2 = 0 then sets_a := 3; sets_b := 0; pontos_a := 25; pontos_b := 18; vencedor := equipe_a;
        else sets_a := 0; sets_b := 3; pontos_a := 20; pontos_b := 25; vencedor := equipe_b; end if;
      elsif jogo <= 30 then
        status_jogo := 'EM_ANDAMENTO';
        inicio := now() - make_interval(mins => 20 + (jogo % 25));
        sets_a := 1; sets_b := 0;
        pontos_a := 9 + ((campeonato + jogo) % 10);
        pontos_b := 6 + ((campeonato + jogo) % 8);
        vencedor := null;
      else
        status_jogo := 'AGENDADA';
        inicio := now() + make_interval(hours => campeonato + jogo);
        sets_a := null; sets_b := null; pontos_a := null; pontos_b := null; vencedor := null;
      end if;
      insert into "Partida" (
        "ligaId", "equipeAId", "equipeBId", categoria, rodada, status, "dataHora", "localNome",
        "setsPorA", "setsPorB", "pontosPorA", "pontosPorB", "vencedorId", "sumulaSubmetidaEm",
        fase, "categoriaCampeonatoId", "seedKey"
      ) values (
        liga_id, equipe_a, equipe_b, 'MASCULINO', ((jogo - 1) / 8) + 1, status_jogo, inicio,
        'Quadra ' || lpad((((jogo - 1) % 4) + 1)::text, 2, '0'),
        sets_a, sets_b, pontos_a, pontos_b, vencedor,
        case when status_jogo = 'ENCERRADA' then inicio + interval '95 minutes' else null end,
        'GERAL', categoria_id, chave_jogo
      ) returning id into partida_id;
      if status_jogo = 'ENCERRADA' then
        insert into "SetPartida" ("partidaId", numero, "pontosA", "pontosB")
        values (partida_id, 1, pontos_a, pontos_b), (partida_id, 2, pontos_a, pontos_b), (partida_id, 3, pontos_a, pontos_b);
      elsif status_jogo = 'EM_ANDAMENTO' then
        insert into "SetPartida" ("partidaId", numero, "pontosA", "pontosB")
        values (partida_id, 1, 25, 18), (partida_id, 2, pontos_a, pontos_b);
      end if;
    end loop;
  end loop;

  insert into "SumulaPresenca" ("partidaId", "jogadorId", "equipeId", presente, numero)
  select partida.id, jogador.id, jogador."equipeId", true, jogador.numero
  from "Partida" partida
  join "Equipe" equipe on equipe.id in (partida."equipeAId", partida."equipeBId")
  join "Jogador" jogador on jogador."equipeId" = equipe.id
  where partida."seedKey" like 'LINK-FLOW-GAME-%'
    and partida.status in ('ENCERRADA', 'EM_ANDAMENTO')
    and not exists (
      select 1 from "SumulaPresenca" presente
      where presente."partidaId" = partida.id and presente."jogadorId" = jogador.id
    );

  insert into "OcorrenciaPartida" ("partidaId", tipo, descricao, "set", "jogadorId")
  select partida.id, evento.tipo, evento.descricao, 1, jogador.id
  from "Partida" partida
  join "Jogador" jogador on jogador."equipeId" = partida."equipeAId" and jogador.numero = evento.numero
  join (values ('PONTO', 'Ponto de ataque', 1), ('ACE', 'Saque ace', 2), ('BLOQUEIO', 'Bloqueio', 4), ('SUBSTITUICAO', 'Substituição', 7)) as evento(tipo, descricao, numero) on true
  where partida."seedKey" like 'LINK-FLOW-GAME-%'
    and partida.status in ('ENCERRADA', 'EM_ANDAMENTO')
    and not exists (
      select 1 from "OcorrenciaPartida" ja
      where ja."partidaId" = partida.id and ja.tipo = evento.tipo and ja."jogadorId" = jogador.id
    );

  insert into "LinkInscricaoCampeonato" ("ligaId", token, ativo, "criadoPor", "revogadoEm", "revogadoPor")
  select liga.id, acesso.token, acesso.ativo, organizador_id,
         case when acesso.ativo then null else now() end,
         case when acesso.ativo then null else organizador_id end
  from (values
    ('LINK-FLOW-CHAMP-01', 'aa11c0de10f14b6e8a7731d4e5f60718', true),
    ('LINK-FLOW-CHAMP-02', 'bb22c0de10f14b6e8a7731d4e5f60718', true),
    ('LINK-FLOW-CHAMP-03', 'cc33c0de10f14b6e8a7731d4e5f60718', false),
    ('LINK-FLOW-CHAMP-04', 'dd44c0de10f14b6e8a7731d4e5f60719', true),
    ('LINK-FLOW-CHAMP-05', 'ee55c0de10f14b6e8a7731d4e5f60718', true),
    ('LINK-FLOW-CHAMP-06', 'ff66c0de10f14b6e8a7731d4e5f60718', true),
    ('LINK-FLOW-CHAMP-07', 'a177c0de10f14b6e8a7731d4e5f60718', true),
    ('LINK-FLOW-CHAMP-08', 'a188c0de10f14b6e8a7731d4e5f60718', true),
    ('LINK-FLOW-CHAMP-09', 'a199c0de10f14b6e8a7731d4e5f60718', true),
    ('LINK-FLOW-CHAMP-10', 'a1aac0de10f14b6e8a7731d4e5f60718', true)
  ) as acesso(chave, token, ativo)
  join "Liga" liga on liga."seedKey" = acesso.chave
  on conflict ("ligaId") do nothing;

  insert into "LinkInscricaoEvento" ("ligaId", "linkId", tipo, "organizadorId", resultado)
  select link."ligaId", link.id, 'LINK_INSCRICAO_REGENERADO', organizador_id, 'ok'
  from "LinkInscricaoCampeonato" link
  join "Liga" liga on liga.id = link."ligaId"
  where liga."seedKey" = 'LINK-FLOW-CHAMP-04'
    and not exists (
      select 1 from "LinkInscricaoEvento" ja
      where ja."ligaId" = link."ligaId" and ja.tipo = 'LINK_INSCRICAO_REGENERADO'
    );

  insert into "AcessoArbitroJogo" ("partidaId", token, "codigoHash", ativo, "criadoPor", "revogadoEm", "revogadoPor")
  select partida.id, acesso.token, extensions.crypt(acesso.codigo, extensions.gen_salt('bf', 10)), acesso.ativo, organizador_id,
         case when acesso.ativo then null else now() end,
         case when acesso.ativo then null else organizador_id end
  from (values
    ('LINK-FLOW-GAME-01-001', 'c1f0aa11b22c33d44e55f66778899ab0', 'link-ativo', true),
    ('LINK-FLOW-GAME-01-002', 'c2f0aa11b22c33d44e55f66778899ab0', 'link-novo', true),
    ('LINK-FLOW-GAME-01-003', 'c3f0aa11b22c33d44e55f66778899ab0', 'link-revogado', false),
    ('LINK-FLOW-GAME-01-005', 'c5f0aa11b22c33d44e55f66778899ab1', 'link-ativo', true)
  ) as acesso(chave, token, codigo, ativo)
  join "Partida" partida on partida."seedKey" = acesso.chave
  on conflict ("partidaId") do nothing;

  insert into "AcessoArbitroEvento" ("partidaId", "acessoId", tipo, "organizadorId", resultado)
  select acesso."partidaId", acesso.id, evento.tipo, organizador_id, 'ok'
  from "AcessoArbitroJogo" acesso
  join "Partida" partida on partida.id = acesso."partidaId"
  join (values
    ('LINK-FLOW-GAME-01-001', 'LINK_GERADO'),
    ('LINK-FLOW-GAME-01-002', 'CODIGO_ALTERADO'),
    ('LINK-FLOW-GAME-01-003', 'LINK_REVOGADO'),
    ('LINK-FLOW-GAME-01-005', 'LINK_REGENERADO')
  ) as evento(chave, tipo) on evento.chave = partida."seedKey"
  where not exists (
    select 1 from "AcessoArbitroEvento" ja
    where ja."partidaId" = acesso."partidaId" and ja.tipo = evento.tipo
  );
end $$;
