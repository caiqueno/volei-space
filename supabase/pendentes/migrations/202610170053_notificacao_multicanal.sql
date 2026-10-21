-- 202610170053_notificacao_multicanal.sql   (Rodada 18, notificações por e-mail, WhatsApp e push)
--
-- OBJETIVO
--   Camada de entrega multicanal sobre "Notificacao" (0039, que continua sendo a caixa de entrada interna):
--   * "PreferenciaNotificacao": opt-in/opt-out por usuário, canal (EMAIL, WHATSAPP, PUSH) e tipo
--     (INSCRICAO, LEMBRETE, TABELA, JOGO ou TODOS; texto livre de 1 a 40 caracteres). Único por
--     ("usuarioId", canal, tipo). "ativo" padrão true. Sem preferência gravada, o servidor decide o padrão.
--   * "PushAssinatura": assinatura Web Push do navegador. "endpoint" único; "chaveP256dh" e "chaveAuth"
--     são SEGREDOS DA ASSINATURA (quem os lê pode enviar push ao usuário): a tabela é só service_role e
--     nenhuma view, função ou resposta de API pode expor essas colunas. "ultimoErro" sem PII (<= 200).
--   * "NotificacaoEntrega": fila/registro por canal de cada "Notificacao" (apaga junto, on delete
--     cascade). estado PENDENTE, ENVIADA, FALHOU ou IGNORADA; "tentativas" 0 a 5; "proximaTentativaEm"
--     para recuo entre tentativas; "erro" até 200 caracteres, SEM PII (código/classe do erro, nunca
--     e-mail, telefone ou corpo da mensagem). Índice parcial (estado, "proximaTentativaEm") onde PENDENTE.
--   * "LembreteEnviado": "chave" única (ex.: lembrete:{jogo}:{usuario}:{antecedencia}) impede lembrete
--     duplicado entre execuções do cron; o servidor faz insert ... on conflict do nothing e só envia se
--     inseriu.
--   * public.expurgar_entregas_antigas(): apaga "NotificacaoEntrega" ENVIADA/IGNORADA com mais de 30 dias
--     e "LembreteEnviado" com mais de 90, devolve a soma apagada. security definer, search_path fixo,
--     execute só para service_role (padrão da 0042/0045). Esta migration NÃO agenda a função (pg_cron ou
--     cron da Vercel com CRON_SECRET, decisão operacional separada). FALHOU e PENDENTE não são apagadas.
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated em todas as tabelas. Só
--   service_role; o servidor filtra pelo usuário autenticado.
--
-- PRÉ-REQUISITOS
--   * 202610170039 aplicada ("Notificacao"; a migration aborta se não existir).
--
-- QUEBRA DE ROTAS
--   Nenhuma (objetos novos; "Notificacao" não é alterada).
--
-- BACKUP NECESSÁRIO
--   Nenhum (objetos novos).
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos; lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170053_notificacao_multicanal.sql (apaga função e tabelas;
--   desagendar o expurgo antes; assinaturas push e preferências se perdem).

begin;
set local lock_timeout = '5s';

do $v$
begin
  if to_regclass('public."Notificacao"') is null then
    raise exception 'Aplique antes a 202610170039 (Notificacao)';
  end if;
end
$v$;

create table if not exists public."PreferenciaNotificacao" (
  id            uuid primary key default gen_random_uuid(),
  "usuarioId"   text not null check (char_length("usuarioId") between 1 and 100),
  canal         text not null check (canal in ('EMAIL', 'WHATSAPP', 'PUSH')),
  tipo          text not null check (char_length(btrim(tipo)) between 1 and 40),
  ativo         boolean not null default true,
  "criadoEm"    timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now(),
  constraint "PreferenciaNotificacao_usuario_canal_tipo_key" unique ("usuarioId", canal, tipo)
);

create table if not exists public."PushAssinatura" (
  id              uuid primary key default gen_random_uuid(),
  "usuarioId"     text not null check (char_length("usuarioId") between 1 and 100),
  endpoint        text not null check (char_length(endpoint) between 1 and 2000),
  "chaveP256dh"   text not null check (char_length("chaveP256dh") between 1 and 200),
  "chaveAuth"     text not null check (char_length("chaveAuth") between 1 and 100),
  "criadoEm"      timestamptz not null default now(),
  "expiraEm"      timestamptz,
  "ultimoErro"    text check ("ultimoErro" is null or char_length("ultimoErro") <= 200),
  constraint "PushAssinatura_endpoint_key" unique (endpoint)
);
create index if not exists "PushAssinatura_usuarioId_idx" on public."PushAssinatura" ("usuarioId");

create table if not exists public."NotificacaoEntrega" (
  id                    uuid primary key default gen_random_uuid(),
  "notificacaoId"       uuid not null references public."Notificacao"(id) on delete cascade,
  canal                 text not null check (canal in ('EMAIL', 'WHATSAPP', 'PUSH')),
  estado                text not null default 'PENDENTE'
                          check (estado in ('PENDENTE', 'ENVIADA', 'FALHOU', 'IGNORADA')),
  tentativas            smallint not null default 0 check (tentativas between 0 and 5),
  "criadoEm"            timestamptz not null default now(),
  "enviadoEm"           timestamptz,
  "proximaTentativaEm"  timestamptz,
  erro                  text check (erro is null or char_length(erro) <= 200)
);
create index if not exists "NotificacaoEntrega_pendente_proxima_idx"
  on public."NotificacaoEntrega" (estado, "proximaTentativaEm") where estado = 'PENDENTE';
create index if not exists "NotificacaoEntrega_notificacaoId_idx"
  on public."NotificacaoEntrega" ("notificacaoId");
create index if not exists "NotificacaoEntrega_estado_criadoEm_idx"
  on public."NotificacaoEntrega" (estado, "criadoEm") where estado in ('ENVIADA', 'IGNORADA');

create table if not exists public."LembreteEnviado" (
  chave         text primary key check (char_length(chave) between 1 and 200),
  "usuarioId"   text not null check (char_length("usuarioId") between 1 and 100),
  tipo          text not null check (char_length(btrim(tipo)) between 1 and 40),
  "enviadoEm"   timestamptz not null default now()
);
create index if not exists "LembreteEnviado_enviadoEm_idx" on public."LembreteEnviado" ("enviadoEm");

do $n$
declare
  nome text;
begin
  foreach nome in array array[
    'PreferenciaNotificacao', 'PushAssinatura', 'NotificacaoEntrega', 'LembreteEnviado'
  ] loop
    execute format('alter table public.%I enable row level security', nome);
    execute format('revoke all on table public.%I from public, anon, authenticated', nome);
    execute format('grant select, insert, update, delete on table public.%I to service_role', nome);
  end loop;
end
$n$;

create or replace function public.expurgar_entregas_antigas()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  apagadas integer;
  total integer := 0;
begin
  delete from public."NotificacaoEntrega"
   where estado in ('ENVIADA', 'IGNORADA')
     and "criadoEm" < now() - interval '30 days';
  get diagnostics apagadas = row_count;
  total := total + apagadas;

  delete from public."LembreteEnviado"
   where "enviadoEm" < now() - interval '90 days';
  get diagnostics apagadas = row_count;
  total := total + apagadas;

  return total;
end
$fn$;

revoke all on function public.expurgar_entregas_antigas() from public, anon, authenticated;
grant execute on function public.expurgar_entregas_antigas() to service_role;

commit;
