-- 202610170028_meu_time_atleta_lote_posicao.sql   (Rodada 3, Meu Time)
--
-- OBJETIVO
--   "Atleta": acrescenta "posicao" (text) e "numeroPreferido" (int, 0 a 99, nullable) e aceita a
--   origem 'LOTE' (cadastro em lote). "dataNascimento" pode ser NULA somente quando origem = 'LOTE'
--   (atleta de lote entra com pendência de nascimento) ou 'MIGRACAO' (regra anterior, mantida).
--   Os CHECKs "Atleta_origem_check" e "Atleta_nascimento_obrigatorio_chk" são recriados (drop if
--   exists + add): as versões novas são mais largas, então nenhuma linha existente as viola.
--
-- PRÉ-REQUISITO: 202610170025 aplicada. QUEBRA DE ROTAS: nenhuma (só afrouxa o CHECK e acrescenta colunas).
--   Nome do CHECK de origem é o padrão do Postgres para CHECK inline (a verificar no banco real).
-- REVERSÃO: rollback/202610170028_meu_time_atleta_lote_posicao.sql (recusa se houver atleta LOTE).

begin;
set local lock_timeout = '5s';

alter table public."Atleta" add column if not exists posicao text;
alter table public."Atleta" add column if not exists "numeroPreferido" integer;

alter table public."Atleta" drop constraint if exists "Atleta_numeroPreferido_chk";
alter table public."Atleta"
  add constraint "Atleta_numeroPreferido_chk"
  check ("numeroPreferido" is null or "numeroPreferido" between 0 and 99);

alter table public."Atleta" drop constraint if exists "Atleta_origem_check";
alter table public."Atleta"
  add constraint "Atleta_origem_check"
  check (origem in ('APP', 'CONVITE', 'MIGRACAO', 'LOTE'));

alter table public."Atleta" drop constraint if exists "Atleta_nascimento_obrigatorio_chk";
alter table public."Atleta"
  add constraint "Atleta_nascimento_obrigatorio_chk"
  check (origem in ('MIGRACAO', 'LOTE') or "dataNascimento" is not null);

commit;
