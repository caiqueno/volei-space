-- Massa TOURNAMENT-SEED-2026. Idempotente: não apaga dados e não duplica seedKey.
-- Códigos de teste do árbitro ficam em scripts/massa-acesso-arbitro.ts.
-- Executar só depois da migration supabase-acesso-arbitro-jogo.sql.

do $$
declare
  organizador_id text;
  campeonato integer;
  jogo integer;
  liga_id integer;
  categoria_id uuid;
  equipe_a integer;
  equipe_b integer;
  partida_id integer;
  chave_liga text;
  chave_jogo text;
  nome_a text;
  nome_b text;
  indice_a integer;
  indice_b integer;
  status_jogo text;
  inicio timestamp;
  sets_a integer;
  sets_b integer;
  pontos_a integer;
  pontos_b integer;
  vencedor integer;
  nomes text[] := array['Alpha','Beta','Delta','Elite','Prime','Arena','Titans','Impacto'];
  titulos text[] := array[
    'Copa Regional 2026','Liga Metropolitana 2026','Copa Primavera 2026','Torneio Nacional 2026','Super Liga 2026',
    'Copa das Academias 2026','Liga Estadual 2026','Campeonato de Verão 2026','Copa dos Campeões 2026','Grand Tournament 2026'
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
    chave_liga := 'SEED-CHAMP-' || lpad(campeonato::text, 2, '0');
    select id into liga_id from "Liga" where "seedKey" = chave_liga;
    if liga_id is null then
      insert into "Liga" (
        slug, nome, descricao, status, simulacao, "setsPorPartida", "tieBreakUltimoSet", "pontosUltimoSet",
        "organizadorId", "seedKey", "dataInicio", "dataFim"
      ) values (
        'seed-champ-' || lpad(campeonato::text, 2, '0'),
        titulos[campeonato],
        'TOURNAMENT-SEED-2026',
        'ATIVA',
        false,
        5,
        true,
        15,
        organizador_id,
        chave_liga,
        now() - interval '7 days',
        now() + interval '21 days'
      )
      returning id into liga_id;
    end if;

    select id into categoria_id
    from "CategoriaCampeonato"
    where "ligaId" = liga_id and codigo = 'MASCULINO';
    if categoria_id is null then
      insert into "CategoriaCampeonato" ("ligaId", codigo, nome, slug, ordem, "statusConfiguracao")
      values (liga_id, 'MASCULINO', 'Masculino', 'masculino', 1, 'CONCLUIDA')
      returning id into categoria_id;
    end if;

    insert into "CategoriaConfiguracao" ("categoriaCampeonatoId", "ligaId", formato, "setsPorPartida", "pontosPorSet", "diferencaMinimaSet", "tieBreakUltimoSet", "pontosUltimoSet")
    values (categoria_id, liga_id, 'PONTOS_CORRIDOS', 5, 25, 2, true, 15)
    on conflict ("categoriaCampeonatoId") do nothing;

    insert into "Equipe" (nome, categoria, "ligaId", "categoriaCampeonatoId")
    select 'Vôlei ' || apelido || ' ' || lpad(campeonato::text, 2, '0'), 'MASCULINO', liga_id, categoria_id
    from unnest(nomes) as apelido
    where not exists (
      select 1 from "Equipe" equipe
      where equipe."categoriaCampeonatoId" = categoria_id
        and equipe.nome = 'Vôlei ' || apelido || ' ' || lpad(campeonato::text, 2, '0')
    );

    for jogo in 1..40 loop
      chave_jogo := 'SEED-GAME-' || lpad(campeonato::text, 2, '0') || '-' || lpad(jogo::text, 3, '0');
      if exists (select 1 from "Partida" where "seedKey" = chave_jogo) then
        continue;
      end if;

      indice_a := ((jogo - 1) % 8) + 1;
      indice_b := ((jogo + 2) % 8) + 1;
      if indice_a = indice_b then
        indice_b := (indice_a % 8) + 1;
      end if;
      nome_a := 'Vôlei ' || nomes[indice_a] || ' ' || lpad(campeonato::text, 2, '0');
      nome_b := 'Vôlei ' || nomes[indice_b] || ' ' || lpad(campeonato::text, 2, '0');
      select id into equipe_a from "Equipe" where "categoriaCampeonatoId" = categoria_id and nome = nome_a;
      select id into equipe_b from "Equipe" where "categoriaCampeonatoId" = categoria_id and nome = nome_b;

      if jogo <= 10 then
        status_jogo := 'ENCERRADA';
        inicio := now() - make_interval(hours => campeonato * 8 + jogo);
        if jogo % 2 = 0 then
          sets_a := 3; sets_b := 0; pontos_a := 25; pontos_b := 18; vencedor := equipe_a;
        else
          sets_a := 0; sets_b := 3; pontos_a := 20; pontos_b := 25; vencedor := equipe_b;
        end if;
      elsif jogo <= 30 then
        status_jogo := 'EM_ANDAMENTO';
        inicio := now() - make_interval(mins => 15 + (jogo % 20));
        sets_a := 1; sets_b := 0;
        pontos_a := 8 + ((campeonato + jogo) % 12);
        pontos_b := 4 + ((campeonato * 2 + jogo) % 9);
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
      )
      returning id into partida_id;

      if status_jogo = 'ENCERRADA' then
        insert into "SetPartida" ("partidaId", numero, "pontosA", "pontosB")
        values (partida_id, 1, pontos_a, pontos_b), (partida_id, 2, pontos_a, pontos_b), (partida_id, 3, pontos_a, pontos_b);
      elsif status_jogo = 'EM_ANDAMENTO' then
        insert into "SetPartida" ("partidaId", numero, "pontosA", "pontosB")
        values (partida_id, 1, 25, 18), (partida_id, 2, pontos_a, pontos_b);
      end if;
    end loop;
  end loop;

  update "SetPartida" as set_aberto
  set "pontosA" = 8 + (partida.id % 11),
      "pontosB" = 4 + (partida.id % 8)
  from "Partida" as partida
  where set_aberto."partidaId" = partida.id
    and partida."seedKey" like 'SEED-GAME-%'
    and partida.status = 'EM_ANDAMENTO'
    and set_aberto.numero = 2
    and set_aberto."pontosA" = 12
    and set_aberto."pontosB" = 9;

  update "Partida" as partida
  set "pontosPorA" = set_aberto."pontosA",
      "pontosPorB" = set_aberto."pontosB"
  from "SetPartida" as set_aberto
  where set_aberto."partidaId" = partida.id
    and partida."seedKey" like 'SEED-GAME-%'
    and partida.status = 'EM_ANDAMENTO'
    and set_aberto.numero = 2;

  insert into "AcessoArbitroJogo" ("partidaId", token, "codigoHash", ativo, "criadoPor", "revogadoEm", "revogadoPor")
  select partida.id, acesso.token, extensions.crypt(acesso.codigo, extensions.gen_salt('bf', 10)), acesso.ativo, organizador_id,
         case when acesso.ativo then null else now() end,
         case when acesso.ativo then null else organizador_id end
  from (
    values
      ('SEED-GAME-01-001', 'a7f3c91e4b28d640aa11ce90f6d2b847', 'arbitro-ativo', true),
      ('SEED-GAME-01-002', 'b81e04d7c5aa3912ff60de77c3a90815', 'arbitro-teste', true),
      ('SEED-GAME-01-003', 'c44d90ab12e77805aa63bf10d9c4e226', 'arbitro-revogado', false),
      ('SEED-GAME-01-004', 'd09c55e1f6b84377aa20cd84e1f7a338', 'arbitro-novo', true)
  ) as acesso(chave, token, codigo, ativo)
  join "Partida" as partida on partida."seedKey" = acesso.chave
  on conflict ("partidaId") do nothing;

  insert into "AcessoArbitroEvento" ("partidaId", "acessoId", tipo, "organizadorId", resultado)
  select acesso."partidaId", acesso.id, evento.tipo, organizador_id, 'ok'
  from "AcessoArbitroJogo" as acesso
  join "Partida" as partida on partida.id = acesso."partidaId"
  join (
    values
      ('SEED-GAME-01-001', 'LINK_GERADO'),
      ('SEED-GAME-01-002', 'LINK_GERADO'),
      ('SEED-GAME-01-003', 'LINK_GERADO'),
      ('SEED-GAME-01-003', 'LINK_REVOGADO'),
      ('SEED-GAME-01-004', 'LINK_GERADO'),
      ('SEED-GAME-01-004', 'CODIGO_ALTERADO')
  ) as evento(chave, tipo) on evento.chave = partida."seedKey"
  where not exists (
    select 1 from "AcessoArbitroEvento" as ja
    where ja."partidaId" = acesso."partidaId" and ja.tipo = evento.tipo
  );
end $$;

select
  (select count(*) from "Liga" where "seedKey" like 'SEED-CHAMP-%') as campeonatos,
  (select count(*) from "Partida" where "seedKey" like 'SEED-GAME-%') as jogos,
  (select count(*) from "Partida" where "seedKey" like 'SEED-GAME-%' and status = 'ENCERRADA') as concluidos,
  (select count(*) from "Partida" where "seedKey" like 'SEED-GAME-%' and status = 'EM_ANDAMENTO') as em_andamento,
  (select count(*) from "Partida" where "seedKey" like 'SEED-GAME-%' and status = 'AGENDADA') as para_iniciar,
  (select count(*) from "Partida" where "seedKey" like 'SEED-GAME-%' and "equipeAId" = "equipeBId") as mesmo_time,
  (select count(*) from "Liga" where "seedKey" like 'SEED-CHAMP-%' and "organizadorId" is not null) as ligas_com_organizador,
  (select min(encerrados) from (
    select count(*) filter (where partida.status = 'ENCERRADA') as encerrados
    from "Liga" liga join "Partida" partida on partida."ligaId" = liga.id
    where liga."seedKey" like 'SEED-CHAMP-%' group by liga."seedKey"
  ) por_liga) as min_concluidos,
  (select min(ao_vivo) from (
    select count(*) filter (where partida.status = 'EM_ANDAMENTO') as ao_vivo
    from "Liga" liga join "Partida" partida on partida."ligaId" = liga.id
    where liga."seedKey" like 'SEED-CHAMP-%' group by liga."seedKey"
  ) por_liga) as min_ao_vivo,
  (select min(futuros) from (
    select count(*) filter (where partida.status = 'AGENDADA') as futuros
    from "Liga" liga join "Partida" partida on partida."ligaId" = liga.id
    where liga."seedKey" like 'SEED-CHAMP-%' group by liga."seedKey"
  ) por_liga) as min_futuros,
  (select count(*) from "AcessoArbitroJogo" acesso join "Partida" partida on partida.id = acesso."partidaId" where partida."seedKey" like 'SEED-GAME-01-00%' and acesso.ativo) as links_ativos,
  (select count(*) from "AcessoArbitroJogo" acesso join "Partida" partida on partida.id = acesso."partidaId" where partida."seedKey" = 'SEED-GAME-01-003' and acesso.ativo = false) as revogados,
  (select count(*) from "Partida" partida where partida."seedKey" = 'SEED-GAME-01-005' and not exists (select 1 from "AcessoArbitroJogo" acesso where acesso."partidaId" = partida.id)) as sem_link;
