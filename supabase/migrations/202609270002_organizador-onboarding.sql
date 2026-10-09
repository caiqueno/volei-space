-- O cadastro do organizador não coleta mais o nome da organização.
-- Esse dado entra depois, no onboarding (PATCH /api/organizador/perfil).
-- Telefone também é opcional no formulário. logoUrl é usado pelo perfil.

alter table "CandidaturaOrganizador"
  alter column organizacao drop not null,
  alter column telefone drop not null;

alter table "CandidaturaOrganizador"
  add column if not exists "logoUrl" text;

alter table "CandidaturaOrganizador"
  alter column "atualizadaEm" set default now();

-- O insert da API não passa por Prisma, então @updatedAt precisa de default no banco.
alter table "Liga"
  alter column "atualizadoEm" set default now();
