-- 202610170051_inscricao_analise_espera.sql   (Rodada 18, inscrição por campeonato)
--
-- OBJETIVO
--   A inscrição por campeonato passa a poder ser AUTOMÁTICA ou COM APROVAÇÃO do organizador, com vagas
--   limitadas e lista de espera. Para isso "Inscricao".status volta a aceitar dois estados, somando 7:
--   RASCUNHO, EM_ANALISE, CONFIRMADA, CONFIRMADA_COM_PENDENCIAS, AJUSTE_PEDIDO, LISTA_ESPERA, REMOVIDA.
--   (A 202610170026 tinha cortado EM_ANALISE e LISTA_ESPERA por decisão da Rodada 2; a regra mudou.)
--   * Substitui o CHECK de status de forma idempotente: remove todo CHECK de "Inscricao" que cite o
--     estado REMOVIDA (nome real esperado "Inscricao_status_check", gerado pela 0026; a busca por
--     definição cobre outro nome no banco real) e cria "Inscricao_status_check" com os 7 estados.
--     "Inscricao_aceite_par_chk" e o CHECK de "avisos" não citam status e não são tocados.
--   * Coluna "posicaoEspera" smallint nula (CHECK > 0): posição na fila quando status = LISTA_ESPERA.
--   * Triggers: "inscricao_propaga_estado" (0026) usa só status <> 'REMOVIDA' para o espelho
--     "InscricaoAtleta"."inscricaoAtiva"; continua correta e NÃO é recriada. Efeito a saber: EM_ANALISE e
--     LISTA_ESPERA contam como inscrição viva, então ocupam o unique (categoria, time) e prendem o
--     atleta na categoria (índice de exclusividade). É o desejado (time não entra duas vezes na fila).
--     A numeração da fila (sem buracos, sem repetição) fica no servidor; não há unique em "posicaoEspera"
--     para não travar a reordenação ao promover alguém.
--   Segurança: nenhuma tabela nova; RLS e grants da "Inscricao" (só service_role) permanecem.
--
-- PRÉ-REQUISITOS
--   * 202610170026 aplicada ("Inscricao" existe; a migration aborta se não existir).
--
-- QUEBRA DE ROTAS
--   Nenhuma (só amplia o conjunto de valores aceitos; nenhum valor atual deixa de valer).
--
-- BACKUP NECESSÁRIO
--   Nenhum (nenhum dado é alterado; o CHECK novo é mais largo que o antigo).
--
-- JANELA SEGURA
--   Fora de rodada por prudência: troca de CHECK pega ACCESS EXCLUSIVE curto (lock_timeout 5 s); a tabela
--   é pequena.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170051_inscricao_analise_espera.sql (aborta se houver linha em
--   EM_ANALISE ou LISTA_ESPERA; resolver essas inscrições antes).

begin;
set local lock_timeout = '5s';

do $v$
begin
  if to_regclass('public."Inscricao"') is null then
    raise exception 'Aplique antes a 202610170026 (Inscricao)';
  end if;
end
$v$;

alter table public."Inscricao"
  add column if not exists "posicaoEspera" smallint;

-- Remove qualquer CHECK de estado existente (pelo conteúdo, não só pelo nome) e recria com os 7 estados.
do $c$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public."Inscricao"'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%REMOVIDA%'
  loop
    execute format('alter table public."Inscricao" drop constraint if exists %I', r.conname);
  end loop;
end
$c$;

alter table public."Inscricao" drop constraint if exists "Inscricao_status_check";
alter table public."Inscricao" add constraint "Inscricao_status_check"
  check (status in (
    'RASCUNHO', 'EM_ANALISE', 'CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS',
    'AJUSTE_PEDIDO', 'LISTA_ESPERA', 'REMOVIDA')) not valid;
alter table public."Inscricao" validate constraint "Inscricao_status_check";

alter table public."Inscricao" drop constraint if exists "Inscricao_posicaoEspera_chk";
alter table public."Inscricao" add constraint "Inscricao_posicaoEspera_chk"
  check ("posicaoEspera" is null or "posicaoEspera" > 0);

commit;
