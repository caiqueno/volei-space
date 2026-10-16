-- Reversão de 202610170003_fechar_leitura_publica_pii.sql
--
-- ATENÇÃO: reverter M1 reabre dado pessoal. Use só em emergência (rota pública quebrada e sem
-- correção rápida no código), por prazo curto, e só a PARTE A. Este arquivo deliberadamente NÃO
-- reabre Jogador, Pagamento, Admin, ContaPublico, Candidatura*, Interessado, CodigoAcesso*,
-- ConviteEquipe nem Arbitro (guardam CPF, documentos, telefone, senhaHash ou webhookPayload).
--
-- Reversão FIEL (estado exato anterior) exige o resultado salvo de Q2 (pg_policies) e Q3/Q3b
-- (grants) do PLANO 5.1, coletados antes da migration. Reaplicar a partir deles.
--
-- Depois de reverter, registrar: supabase migration repair --status reverted 202610170003

-- ============ PARTE A: reabrir leitura das tabelas SEM dado pessoal (emergência) ============
begin;
set local lock_timeout = '5s';

-- A.1 Políticas de leitura aberta que a migration removeu (conteúdo original de
--     supabase-producao-elenco-sumula-rls.sql:63-111), exceto Jogador e Equipe/InscricaoCampeonato
--     (Equipe e InscricaoCampeonato têm contato do líder e observações; reabrir só se indispensável).
drop policy if exists "public_read_ligas" on public."Liga";
create policy "public_read_ligas" on public."Liga" for select to anon, authenticated using (true);

drop policy if exists "public_read_partidas" on public."Partida";
create policy "public_read_partidas" on public."Partida" for select to anon, authenticated using (true);

drop policy if exists "public_read_sets" on public."SetPartida";
create policy "public_read_sets" on public."SetPartida" for select to anon, authenticated using (true);

drop policy if exists "public_read_sumula_presencas" on public."SumulaPresenca";
create policy "public_read_sumula_presencas" on public."SumulaPresenca" for select to anon, authenticated using (true);

drop policy if exists "public_read_ocorrencias" on public."OcorrenciaPartida";
create policy "public_read_ocorrencias" on public."OcorrenciaPartida" for select to anon, authenticated using (true);

drop policy if exists "public_read_destaques" on public."DestaquesPartida";
create policy "public_read_destaques" on public."DestaquesPartida" for select to anon, authenticated using (true);

drop policy if exists "public_read_classificacao" on public."ClassificacaoEntrada";
create policy "public_read_classificacao" on public."ClassificacaoEntrada" for select to anon, authenticated using (true);

-- A.2 Privilégio de leitura que a migration retirou.
grant select on table public."Liga" to anon, authenticated;
grant select on table public."SetPartida" to anon, authenticated;
grant select on table public."SumulaPresenca" to anon, authenticated;
grant select on table public."OcorrenciaPartida" to anon, authenticated;
grant select on table public."DestaquesPartida" to anon, authenticated;
grant select on table public."ClassificacaoEntrada" to anon, authenticated;
-- Partida: o select por colunas (sem sumulaToken) segue; NÃO devolva o token à chave anon.

-- A.3 Equipe e InscricaoCampeonato SOMENTE se uma rota pública quebrada não puder esperar o deploy.
--     Descomente conscientemente; a leitura volta limitada a campeonatos publicados pelas policies
--     luv_public_select_equipe (criada em supabase-rls-producao-permissoes-campeonatos.sql).
-- grant select on table public."Equipe" to anon, authenticated;

-- A.4 A view pública pode ficar (não expõe PII). Para removê-la:
-- drop view if exists public.jogador_publico;

commit;

-- ============ PARTE B: NÃO executar sem o dump de Q2/Q3 ============
-- Escrita anônima (INSERT/UPDATE em Liga, Equipe, Partida, InscricaoCampeonato, ClassificacaoEntrada e
-- sequences) NÃO deve ser devolvida em hipótese alguma: era o risco C1 do relatório 13.
-- RLS ligada em tabelas que antes não tinham: para desligar uma tabela específica em emergência
--   alter table public."<Tabela>" disable row level security;
-- mantendo Jogador e Candidatura* sempre fechadas (revoke de anon/authenticated).
