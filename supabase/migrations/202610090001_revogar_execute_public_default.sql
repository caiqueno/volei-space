-- Funções novas nasciam executáveis pela chave publicável.
--
-- 202610060004 revoga default privileges de anon e authenticated dentro do
-- schema public. Isso não alcança o EXECUTE que o Postgres concede a PUBLIC
-- por default global. A documentação do Postgres é explícita: um
-- ALTER DEFAULT PRIVILEGES IN SCHEMA ... REVOKE EXECUTE FROM PUBLIC não
-- remove esse default; o revoke por schema só desfaz um grant feito por
-- schema. A forma sem schema substitui o default global.
--
-- Vale para funções criadas depois desta migration pelo papel postgres
-- (é o papel da CLI). Função já existente continua coberta por
-- 202610060005. Função criada no SQL Editor como supabase_admin não entra
-- neste default: nesse caso, o mesmo revoke precisa ser repetido para
-- esse papel por quem puder alterá-lo.
--
-- service_role segue podendo executar funções novas no schema public.
-- anon e authenticated não ganham EXECUTE.

alter default privileges for role postgres
  revoke execute on functions from public;

do $defaults$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute
      'alter default privileges for role postgres in schema public grant execute on functions to service_role';
  end if;
end
$defaults$;
