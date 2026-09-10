alter table public."CandidaturaQuadra"
  add column if not exists instagram text;

alter table public."Liga"
  add column if not exists regulamento text,
  add column if not exists premiacao text;
