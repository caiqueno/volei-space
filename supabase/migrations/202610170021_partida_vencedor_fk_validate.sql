-- 202610170021_partida_vencedor_fk_validate.sql   (M7, etapa 4 de 4: VALIDATE da FK)
--
-- OBJETIVO
--   Valida as linhas antigas de "Partida" contra "Partida_vencedorId_fkey" (criada em 020).
--   VALIDATE CONSTRAINT não bloqueia leitura nem escrita. Se existir órfão, falha e nada muda.
--
-- PRÉ-REQUISITOS
--   a. 202610170020 aplicada.
--   b. Contagem de órfãos igual a zero (consulta no cabeçalho de 020).
--
-- QUEBRA DE ROTAS
--   Nenhuma.
--
-- BACKUP NECESSÁRIO
--   Nenhum (só leitura).
--
-- JANELA SEGURA
--   Baixa carga; varre "Partida".
--
-- REVERSÃO
--   supabase/rollback/202610170021_partida_vencedor_fk_validate.sql

begin;
set local lock_timeout = '5s';

do $m7$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public."Partida"'::regclass
      and conname = 'Partida_vencedorId_fkey'
      and not convalidated
  ) then
    alter table public."Partida" validate constraint "Partida_vencedorId_fkey";
  end if;
end
$m7$;

commit;
