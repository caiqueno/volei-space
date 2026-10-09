-- Execute no SQL Editor do Supabase.
-- Corrige o bloqueio de insert dos cadastros via API atual.

alter table "CandidaturaEquipe" disable row level security;
alter table "CandidaturaArbitro" disable row level security;
alter table "CandidaturaQuadra" disable row level security;
