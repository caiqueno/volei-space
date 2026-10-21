-- 202610170045_codigo_acesso.sql   (Rodada 16, login sem senha por código)
--
-- OBJETIVO
--   Tabela "CodigoAcesso": códigos de uso único, curtos (até 10 min), enviados por e-mail ou WhatsApp.
--   * NUNCA guarda o código em claro: só "codigoHash" (SHA-256 com sal, calculado pelo servidor).
--   * "emailNormalizado" é a identidade da pessoa (minúsculas, sem espaços nas pontas; CHECK).
--   * "destinoCifrado" (bytea) guarda o telefone do WhatsApp CIFRADO com src/lib/lgpd/cifra.ts
--     (AES-256-GCM, chave LGPD_CHAVE_CIFRA fora do banco; o servidor grava com cifrarContato(), literal
--     \x...). Para o canal EMAIL fica nulo (o e-mail já está em "emailNormalizado"). Nada de telefone em texto.
--   * "expiraEm" no máximo 10 min depois de "criadoEm" (CHECK), "tentativas" de 0 a 10, "usadoEm" marca o uso.
--   * "ipHash": hash do IP (nunca o IP cru), para limite de abuso.
--   Função public.expurgar_codigos_acesso(): apaga códigos expirados há mais de 1 dia e devolve a contagem.
--   security definer, search_path fixo, execute só para service_role (padrão da 0042). Esta migration NÃO
--   agenda a função (pg_cron ou cron da Vercel com CRON_SECRET, decisão operacional separada).
--
--   Segurança: RLS ligada, sem policy, sem grant para anon/authenticated; só service_role.
--
-- PRÉ-REQUISITOS
--   Nenhum (tabela nova, sem FK; gen_random_uuid() é nativo do Postgres 13+).
--
-- QUEBRA DE ROTAS
--   Nenhuma (aditiva; nada lê a tabela até a rota de login por código entrar).
--
-- BACKUP NECESSÁRIO
--   Nenhum (nenhum dado existente é tocado).
--
-- JANELA SEGURA
--   Qualquer horário (tabela nova, lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170045_codigo_acesso.sql (apaga função e tabela; códigos em aberto se
--   perdem, o que só obriga a pedir outro código).

begin;
set local lock_timeout = '5s';

create table if not exists public."CodigoAcesso" (
  id                 uuid primary key default gen_random_uuid(),
  "emailNormalizado" text not null
                       check ("emailNormalizado" = lower(btrim("emailNormalizado"))
                              and char_length("emailNormalizado") between 3 and 320),
  canal              text not null check (canal in ('EMAIL', 'WHATSAPP')),
  "destinoCifrado"   bytea,
  "codigoHash"       text not null check (char_length("codigoHash") between 32 and 200),
  "criadoEm"         timestamptz not null default now(),
  "expiraEm"         timestamptz not null default (now() + interval '10 minutes'),
  tentativas         smallint not null default 0 check (tentativas between 0 and 10),
  "usadoEm"          timestamptz,
  "ipHash"           text check ("ipHash" is null or char_length("ipHash") <= 200),
  constraint "CodigoAcesso_validade_chk"
    check ("expiraEm" > "criadoEm" and "expiraEm" <= "criadoEm" + interval '10 minutes'),
  constraint "CodigoAcesso_destino_chk"
    check ((canal = 'EMAIL' and "destinoCifrado" is null) or (canal = 'WHATSAPP' and "destinoCifrado" is not null))
);

create index if not exists "CodigoAcesso_email_criadoEm_idx"
  on public."CodigoAcesso" ("emailNormalizado", "criadoEm" desc);
create index if not exists "CodigoAcesso_expiraEm_idx"
  on public."CodigoAcesso" ("expiraEm");

alter table public."CodigoAcesso" enable row level security;
revoke all on table public."CodigoAcesso" from public, anon, authenticated;
grant select, insert, update, delete on table public."CodigoAcesso" to service_role;

create or replace function public.expurgar_codigos_acesso()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  apagados integer;
begin
  delete from public."CodigoAcesso"
   where "expiraEm" < now() - interval '1 day';
  get diagnostics apagados = row_count;
  return apagados;
end
$fn$;

revoke all on function public.expurgar_codigos_acesso() from public, anon, authenticated;
grant execute on function public.expurgar_codigos_acesso() to service_role;

commit;
