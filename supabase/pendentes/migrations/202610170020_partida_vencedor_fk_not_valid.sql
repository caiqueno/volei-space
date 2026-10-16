-- 202610170020_partida_vencedor_fk_not_valid.sql   (M7, etapa 3 de 4: FK NOT VALID)
--
-- OBJETIVO
--   "Partida"."vencedorId" guarda o id da equipe vencedora mas não tem FK. Cria
--   "Partida_vencedorId_fkey" -> "Equipe"(id), NOT VALID (vale para escritas novas; linhas antigas
--   são validadas em 202610170021). Sem ON DELETE: apagar equipe vencedora continua barrado, como
--   já ocorre com equipeAId/equipeBId (RESTRICT em supabase-partidas-chaves-estrangeiras.sql).
--
-- PRÉ-REQUISITOS
--   Órfãos: rodar antes (só contagem) e ter o resultado 0, ou corrigir com aprovação:
--     select count(*) from "Partida" p
--      where p."vencedorId" is not null
--        and not exists (select 1 from "Equipe" e where e.id = p."vencedorId");
--   Atenção: o validate (021) falha se houver órfãos; esta etapa (NOT VALID) não falha por eles.
--
-- QUEBRA DE ROTAS
--   Escrita de Partida com vencedorId inexistente passa a falhar (23503). Código que grava
--   vencedorId: api/partidas/[id], RPCs de sumula/classificacao/confronto (conferir com grep
--   "vencedorId"). Partida sem vencedor continua NULL.
--
-- BACKUP NECESSÁRIO
--   Contagem de linhas e checksum de "Partida" (select count(*), sum(id) ...) antes e depois.
--
-- JANELA SEGURA
--   Fora de rodada: ADD FOREIGN KEY pega SHARE ROW EXCLUSIVE em "Partida" e "Equipe" (bloqueia
--   escrita por instantes). lock_timeout de 5 s.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170020_partida_vencedor_fk_not_valid.sql

begin;
set local lock_timeout = '5s';

do $m7$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."Partida"'::regclass and conname = 'Partida_vencedorId_fkey'
  ) then
    alter table public."Partida"
      add constraint "Partida_vencedorId_fkey"
      foreign key ("vencedorId") references public."Equipe" (id) not valid;
  end if;
end
$m7$;

commit;
