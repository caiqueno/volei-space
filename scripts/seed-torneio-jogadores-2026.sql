-- Jogadores da massa TOURNAMENT-SEED-2026.
-- Idempotente: só insere seedKey ausente. Não apaga dados.
-- Rode depois de scripts/seed-torneio-2026.sql.
-- Chaves: TESTE-SEED-2026-CH##-EQ##-J###

do $$
declare
  campeonato integer;
  equipe_n integer;
  jogador_n integer;
  liga_id integer;
  equipe_id integer;
  chave_liga text;
  chave_equipe text;
  chave_jogador text;
  nomes text[] := array['Lucas','Rafael','Gabriel','Bruno','Caio','Diego','Felipe','André','Matheus','João','Pedro','Gustavo'];
  sobrenomes text[] := array['Monteiro','Ventura','Nogueira','Valença','Ferraz','Tavares','Noronha','Vasconcelos','Ribeiro','Vilar','Alencar','Paiva'];
  posicoes text[] := array['Levantador','Oposto','Ponteiro','Central','Líbero','Ponteiro','Levantador','Oposto','Central','Ponteiro','Líbero','Central'];
  clubes text[] := array['Alpha','Beta','Delta','Elite','Prime','Arena','Titans','Impacto'];
begin
  for campeonato in 1..10 loop
    chave_liga := 'SEED-CHAMP-' || lpad(campeonato::text, 2, '0');
    select id into liga_id from "Liga" where "seedKey" = chave_liga;
    if liga_id is null then
      continue;
    end if;

    for equipe_n in 1..8 loop
      chave_equipe := chave_liga || '-EQ' || lpad(equipe_n::text, 2, '0');
      select id into equipe_id from "Equipe" where "seedKey" = chave_equipe;
      if equipe_id is null then
        select id into equipe_id
        from "Equipe"
        where "ligaId" = liga_id
          and nome = 'Vôlei ' || clubes[equipe_n] || ' ' || lpad(campeonato::text, 2, '0')
        order by id
        limit 1;
        if equipe_id is not null then
          update "Equipe" set "seedKey" = chave_equipe where id = equipe_id and "seedKey" is null;
        end if;
      end if;
      if equipe_id is null then
        continue;
      end if;

      for jogador_n in 1..12 loop
        chave_jogador := 'TESTE-SEED-2026-CH' || lpad(campeonato::text, 2, '0')
          || '-EQ' || lpad(equipe_n::text, 2, '0')
          || '-J' || lpad(jogador_n::text, 3, '0');
        insert into "Jogador" (nome, posicao, numero, "equipeId", "autoRegistrado", banido, "seedKey")
        select nomes[jogador_n] || ' ' || sobrenomes[1 + ((jogador_n + equipe_n - 2) % 12)],
               posicoes[jogador_n],
               jogador_n,
               equipe_id,
               false,
               false,
               chave_jogador
        where not exists (
          select 1 from "Jogador" ja where ja."seedKey" = chave_jogador
        );
      end loop;
    end loop;
  end loop;

  insert into "SumulaPresenca" ("partidaId", "jogadorId", "equipeId", presente, numero)
  select partida.id, jogador.id, jogador."equipeId", true, jogador.numero
  from "Partida" partida
  join "Equipe" equipe on equipe.id in (partida."equipeAId", partida."equipeBId")
  join "Jogador" jogador on jogador."equipeId" = equipe.id
  where partida."seedKey" like 'SEED-GAME-%'
    and not exists (
      select 1 from "SumulaPresenca" presente
      where presente."partidaId" = partida.id and presente."jogadorId" = jogador.id
    );
end $$;

select
  (select count(*) from "Jogador" where "seedKey" like 'TESTE-SEED-2026-%') as jogadores_seed,
  (select count(*) from "Equipe" where "seedKey" like 'SEED-CHAMP-%-EQ%') as equipes_com_chave,
  (select count(*) from "SumulaPresenca" presente
     join "Partida" partida on partida.id = presente."partidaId"
     where partida."seedKey" like 'SEED-GAME-%') as presencas_seed;
