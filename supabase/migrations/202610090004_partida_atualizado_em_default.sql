-- A geração de confrontos grava Partida pelo cliente do Supabase.
-- Prisma marca atualizadoEm como obrigatório, mas o @updatedAt não vira
-- default no Postgres. Sem este default o insert da estrutura e do mata-mata
-- chega com a coluna nula e o banco recusa a partida.

alter table "Partida"
  alter column "atualizadoEm" set default now();
