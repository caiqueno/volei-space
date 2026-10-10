-- Devolve a leitura pública de SetPartida e ClassificacaoEntrada para o Realtime.
--
-- 20261010140000 liga o RLS e revoga anon/authenticated em tudo que não é
-- Partida. 202610100002, se já tiver corrido, também tira o privilégio e as
-- policies USING (true) destas duas. O navegador assina as duas com a chave
-- anon (useBancoAoVivo: filtro partidaId em SetPartida e ligaId em
-- ClassificacaoEntrada). Sem SELECT e sem policy, o postgres_changes não chega.
--
-- Este arquivo só reabre leitura:
--   SELECT para anon e authenticated
--   policy FOR SELECT USING (true), se ainda não existir
--   replica identity full, para o filtro do canal enxergar UPDATE e DELETE
--   a tabela na publicação supabase_realtime, se a publicação existir e a
--   tabela ainda não estiver nela
-- Não concede INSERT, UPDATE nem DELETE. Não altera Partida: o privilégio
-- continua o das colunas de placar de 202610060004, sem sumulaToken.
-- Não altera Liga, CategoriaConfiguracao nem função de W.O.
-- 20261010139000_wo_configuravel.sql fica antes de 20261010140000 e antes
-- deste arquivo. 20261010139500_sancoes_suspensao.sql fica entre o W.O. e a
-- 140000. O prefixo 20261010150000 não existe mais.
-- Idempotente. Tabela ausente ou papel ausente é pulado.
-- Não foi aplicada em banco real.
--
-- Ordem: 20261010139000, 20261010139500, depois 20261010140000 e em seguida
-- este arquivo.
-- As duas de RLS entram no mesmo passo, nesta ordem. Sozinha, a 140000 deixa
-- o ao vivo sem evento. Não reaplique a 140000 depois desta.

do $leitura$
declare
  tem_anon boolean := exists (select 1 from pg_roles where rolname = 'anon');
  tem_authenticated boolean := exists (select 1 from pg_roles where rolname = 'authenticated');
begin
  if to_regclass('public."SetPartida"') is not null then
    execute 'alter table public."SetPartida" enable row level security';
    execute 'alter table public."SetPartida" replica identity full';
    execute 'revoke all on table public."SetPartida" from public';
  end if;
  if to_regclass('public."ClassificacaoEntrada"') is not null then
    execute 'alter table public."ClassificacaoEntrada" enable row level security';
    execute 'alter table public."ClassificacaoEntrada" replica identity full';
    execute 'revoke all on table public."ClassificacaoEntrada" from public';
  end if;

  if tem_anon and tem_authenticated then
    if to_regclass('public."SetPartida"') is not null then
      execute 'revoke all on table public."SetPartida" from anon, authenticated';
      execute 'grant select on table public."SetPartida" to anon, authenticated';
    end if;
    if to_regclass('public."ClassificacaoEntrada"') is not null then
      execute 'revoke all on table public."ClassificacaoEntrada" from anon, authenticated';
      execute 'grant select on table public."ClassificacaoEntrada" to anon, authenticated';
    end if;

    if to_regclass('public."SetPartida"') is not null
       and not exists (
         select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'SetPartida'
           and policyname = 'public_read_sets'
       ) then
      create policy "public_read_sets"
        on public."SetPartida"
        for select
        to anon, authenticated
        using (true);
    end if;

    if to_regclass('public."ClassificacaoEntrada"') is not null
       and not exists (
         select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'ClassificacaoEntrada'
           and policyname = 'public_read_classificacao'
       ) then
      create policy "public_read_classificacao"
        on public."ClassificacaoEntrada"
        for select
        to anon, authenticated
        using (true);
    end if;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if to_regclass('public."SetPartida"') is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'SetPartida'
       ) then
      alter publication supabase_realtime add table public."SetPartida";
    end if;
    if to_regclass('public."ClassificacaoEntrada"') is not null
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'ClassificacaoEntrada'
       ) then
      alter publication supabase_realtime add table public."ClassificacaoEntrada";
    end if;
  end if;
end
$leitura$;
