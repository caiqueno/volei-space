-- Reversão de 202610170051. Volta o CHECK aos 5 estados da 0026 e remove "posicaoEspera".
-- Aborta (sem alterar nada) se existir inscrição em EM_ANALISE ou LISTA_ESPERA: resolva antes
-- (aprovar, recusar ou remover). Não converte dados por conta própria.
begin;
set local lock_timeout = '5s';
do $v$
begin
  if exists (select 1 from public."Inscricao" where status in ('EM_ANALISE', 'LISTA_ESPERA')) then
    raise exception 'Há inscrições em EM_ANALISE/LISTA_ESPERA; resolva antes de reverter a 202610170051';
  end if;
end
$v$;
alter table public."Inscricao" drop constraint if exists "Inscricao_status_check";
alter table public."Inscricao" add constraint "Inscricao_status_check"
  check (status in ('RASCUNHO', 'CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS', 'AJUSTE_PEDIDO', 'REMOVIDA')) not valid;
alter table public."Inscricao" validate constraint "Inscricao_status_check";
alter table public."Inscricao" drop constraint if exists "Inscricao_posicaoEspera_chk";
alter table public."Inscricao" drop column if exists "posicaoEspera";
commit;
