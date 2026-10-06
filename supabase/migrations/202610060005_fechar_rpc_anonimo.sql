-- `revoke ... from anon, authenticated` não alcança a concessão que o Postgres dá a
-- PUBLIC ao criar uma função. Sem isto a chave publicável ainda chamava
-- /rest/v1/rpc/recalcular_classificacao_liga e recalculava a tabela de qualquer
-- campeonato sem sessão. Nenhuma dessas funções é chamada pelo navegador: todas
-- rodam dentro das rotas do Next, pelo service role.
--
-- Função de gatilho não perde nada: o Postgres confere o EXECUTE na criação do
-- gatilho, não a cada disparo.
do $rpc$
declare
  alvo record;
begin
  for alvo in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', alvo.assinatura);
    execute format('grant execute on function %s to service_role', alvo.assinatura);
  end loop;
end
$rpc$;
