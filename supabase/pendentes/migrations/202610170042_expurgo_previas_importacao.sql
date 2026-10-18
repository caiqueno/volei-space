-- 202610170042_expurgo_previas_importacao.sql   (Rodada 13, Meu Time, LGPD)
--
-- OBJETIVO
--   Função public.expurgar_previas_importacao(): apaga de "ImportacaoAtletas" as linhas com status 'PREVIA'
--   e "expiraEm" < now() (prévias vencidas, que guardam dados pessoais) e devolve a contagem apagada.
--   security definer com search_path = public, pg_temp. Execute revogado de public/anon/authenticated e
--   concedido só a service_role. Prévias CONFIRMADA não são tocadas (retenção a definir com o jurídico).
--
-- COMO AGENDAR (esta migration NÃO agenda nada)
--   Opção A, pg_cron (se a extensão estiver habilitada no projeto Supabase), por exemplo de hora em hora:
--     select cron.schedule('expurgo-previas-importacao', '0 * * * *', $$select public.expurgar_previas_importacao()$$);
--   Opção B, rota de cron da Vercel (vercel.json "crons") chamando uma rota do servidor protegida por
--   CRON_SECRET, que usa o client service_role: supabase.rpc('expurgar_previas_importacao').
--   Agendar é decisão operacional separada, depois de aplicar e ensaiar em preview.
--
-- PRÉ-REQUISITOS
--   202610170037 ("ImportacaoAtletas") aplicada (a migration aborta se a tabela não existir).
--
-- QUEBRA DE ROTAS
--   Nenhuma (função nova).
--
-- BACKUP NECESSÁRIO
--   Nenhum para criar a função. Uma vez agendada ela apaga dados: prévias são descartáveis por desenho.
--
-- JANELA SEGURA
--   Qualquer horário (lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170042_expurgo_previas_importacao.sql (remove a função; desagendar
--   antes, se tiver sido agendada).

begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."ImportacaoAtletas"') is null then
    raise exception 'Aplique antes a 202610170037 (ImportacaoAtletas)';
  end if;
end
$$;

create or replace function public.expurgar_previas_importacao()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  apagadas integer;
begin
  delete from public."ImportacaoAtletas"
   where status = 'PREVIA'
     and "expiraEm" < now();
  get diagnostics apagadas = row_count;
  return apagadas;
end
$fn$;

revoke all on function public.expurgar_previas_importacao() from public, anon, authenticated;
grant execute on function public.expurgar_previas_importacao() to service_role;

commit;
