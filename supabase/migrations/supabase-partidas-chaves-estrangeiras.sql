-- Relações que a tela do jogo já consulta pelo nome da chave.
-- Em produção essas chaves não existiam, então o árbitro via o jogo sem os times.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'Partida_ligaId_fkey') then
    alter table "Partida" add constraint "Partida_ligaId_fkey" foreign key ("ligaId") references "Liga"(id) on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'Partida_equipeAId_fkey') then
    alter table "Partida" add constraint "Partida_equipeAId_fkey" foreign key ("equipeAId") references "Equipe"(id) on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'Partida_equipeBId_fkey') then
    alter table "Partida" add constraint "Partida_equipeBId_fkey" foreign key ("equipeBId") references "Equipe"(id) on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'Jogador_equipeId_fkey') then
    alter table "Jogador" add constraint "Jogador_equipeId_fkey" foreign key ("equipeId") references "Equipe"(id) on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'SetPartida_partidaId_fkey') then
    alter table "SetPartida" add constraint "SetPartida_partidaId_fkey" foreign key ("partidaId") references "Partida"(id) on update cascade on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'SumulaPresenca_partidaId_fkey') then
    alter table "SumulaPresenca" add constraint "SumulaPresenca_partidaId_fkey" foreign key ("partidaId") references "Partida"(id) on update cascade on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'SumulaPresenca_jogadorId_fkey') then
    alter table "SumulaPresenca" add constraint "SumulaPresenca_jogadorId_fkey" foreign key ("jogadorId") references "Jogador"(id) on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'SumulaPresenca_equipeId_fkey') then
    alter table "SumulaPresenca" add constraint "SumulaPresenca_equipeId_fkey" foreign key ("equipeId") references "Equipe"(id) on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'EscalaArbitro_partidaId_fkey') then
    alter table "EscalaArbitro" add constraint "EscalaArbitro_partidaId_fkey" foreign key ("partidaId") references "Partida"(id) on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'EscalaArbitro_arbitroId_fkey') then
    alter table "EscalaArbitro" add constraint "EscalaArbitro_arbitroId_fkey" foreign key ("arbitroId") references "Arbitro"(id) on update cascade on delete restrict;
  end if;
end $$;
