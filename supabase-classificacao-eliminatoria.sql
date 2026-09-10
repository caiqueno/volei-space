-- Configuracao de fase eliminatoria e registro de classificacao manual.
-- Rode este script no Supabase antes de usar o botao "CLASSIFICAR TIME".

alter table "Liga"
  add column if not exists "faseEliminatoria" text not null default 'NENHUMA';

alter table "Liga"
  drop constraint if exists "Liga_faseEliminatoria_check";

alter table "Liga"
  add constraint "Liga_faseEliminatoria_check"
  check ("faseEliminatoria" in ('NENHUMA', 'FINAL', 'SEMIFINAL', 'QUARTAS', 'OITAVAS'));

update "Liga"
set "faseEliminatoria" = case
  when coalesce(formato, '') = 'PONTOS_CORRIDOS' then 'NENHUMA'
  when coalesce("faseEliminatoria", 'NENHUMA') = 'NENHUMA' then 'SEMIFINAL'
  else "faseEliminatoria"
end;

create table if not exists "ClassificacaoEliminatoria" (
  id bigserial primary key,
  "ligaId" integer not null references "Liga"(id) on delete cascade,
  "equipeId" integer not null references "Equipe"(id) on delete cascade,
  "organizadorId" text not null,
  origem text not null default 'MANUAL',
  "criadoEm" timestamptz not null default now(),
  constraint "ClassificacaoEliminatoria_origem_check" check (origem in ('AUTOMATICA', 'MANUAL')),
  constraint "ClassificacaoEliminatoria_liga_equipe_unique" unique ("ligaId", "equipeId")
);

create index if not exists "ClassificacaoEliminatoria_liga_idx"
  on "ClassificacaoEliminatoria" ("ligaId");

create index if not exists "ClassificacaoEliminatoria_equipe_idx"
  on "ClassificacaoEliminatoria" ("equipeId");

create index if not exists "ClassificacaoEliminatoria_organizador_idx"
  on "ClassificacaoEliminatoria" ("organizadorId");
