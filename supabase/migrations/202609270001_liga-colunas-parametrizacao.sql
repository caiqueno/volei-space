-- Colunas que a Central de Parametrização e o Pix simulado já leem e gravam,
-- mas que não estavam no schema aplicado neste projeto.

alter table "Liga"
  add column if not exists "quantidadeGrupos" integer,
  add column if not exists "nomesGrupos" text,
  add column if not exists "setsPorPartida" integer not null default 3,
  add column if not exists "pontosPorSet" integer not null default 25,
  add column if not exists "criteriosClassificacao" text,
  add column if not exists "classificadosPorGrupo" integer,
  add column if not exists "tieBreakUltimoSet" boolean not null default false,
  add column if not exists "pontosUltimoSet" integer,
  add column if not exists "sumulaScoutsEnabled" boolean not null default false,
  add column if not exists "prazoAlteracaoElencoDias" integer,
  add column if not exists "pagamentoConfirmadoEm" timestamptz;

alter table "Equipe"
  add column if not exists lider text,
  add column if not exists tecnico text;

-- Inserts da API não passam por Prisma. @updatedAt e @default(uuid())
-- precisam existir como default no banco.
alter table "InscricaoEquipeRascunho"
  alter column id set default gen_random_uuid(),
  alter column token set default gen_random_uuid(),
  alter column "atualizadaEm" set default now();

alter table "InscricaoEquipeJogadorRascunho"
  alter column id set default gen_random_uuid(),
  alter column "atualizadoEm" set default now();

alter table "ConviteEquipe"
  alter column id set default gen_random_uuid(),
  alter column token set default gen_random_uuid(),
  alter column "atualizadoEm" set default now();

alter table "InscricaoCampeonato"
  alter column "atualizadaEm" set default now();
