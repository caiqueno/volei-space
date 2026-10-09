-- Senha atribuída pelo administrador precisa ser substituída na primeira entrada.

alter table "CandidaturaOrganizador"
  add column if not exists "trocarSenha" boolean not null default false;

notify pgrst, 'reload schema';
