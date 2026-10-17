-- Reversão de 202610170029. Recusa-se a rodar se já houver evento dos tipos acrescentados
-- (a tabela é append-only: não se apaga evento para reverter).
begin;
set local lock_timeout = '5s';
do $r$
begin
  if exists (
    select 1 from public."SumulaEvento"
    where tipo in ('SET_INICIADO', 'RALLY_REPETIDO', 'TROCA_LIBERO', 'REDESIGNACAO_LIBERO', 'FALTA_POSICAO',
                   'FALTA_ROTACAO', 'TROCA_LADO', 'SET_ANULADO', 'INTERRUPCAO', 'EQUIPE_INCOMPLETA', 'OBSERVACAO',
                   'DISCREPANCIA_PAPELETA', 'CAPITAO_EM_JOGO', 'PROTESTO_ANUNCIADO', 'PROTESTO_REGISTRADO',
                   'PROTESTO_DESISTIDO', 'PEDIDO_INDEVIDO')
  ) then
    raise exception 'existem eventos dos tipos do motor; reversao recusada' using errcode = '23514';
  end if;
end
$r$;
comment on column public."SumulaEvento".payload is null;
alter table public."SumulaEvento" drop constraint if exists "SumulaEvento_tipo_check";
alter table public."SumulaEvento"
  add constraint "SumulaEvento_tipo_check" check (tipo in (
    'INICIO_SET', 'PONTO', 'SAQUE', 'SUBSTITUICAO', 'TEMPO', 'SANCAO',
    'LIBERO', 'DESAFIO', 'FIM_SET', 'WO', 'FIM_PARTIDA', 'DESFAZ', 'SNAPSHOT'));
commit;
