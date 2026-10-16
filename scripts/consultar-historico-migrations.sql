-- Consulta só de leitura. Não aplica migration, não faz repair e não altera
-- linha. Rode no SQL Editor ou com um cliente já ligado, só depois de
-- aprovação para olhar o banco. Não acompanha supabase db push.
--
-- Se a segunda consulta falhar porque a coluna name não existe, fique na
-- primeira: ela mostra as colunas reais de schema_migrations.

select column_name, data_type
from information_schema.columns
where table_schema = 'supabase_migrations'
  and table_name = 'schema_migrations'
order by ordinal_position;

select version, name
from supabase_migrations.schema_migrations
order by version;

-- Índices atuais das tabelas desta leva. A primeira coluna do índice é o
-- que cobre a chave estrangeira de uma coluna só.
select
  t.relname as tabela,
  i.relname as indice,
  pg_get_indexdef(ix.indexrelid) as definicao
from pg_index ix
join pg_class t on t.oid = ix.indrelid
join pg_class i on i.oid = ix.indexrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in (
    'Partida',
    'SetPartida',
    'SumulaPresenca',
    'EscalaArbitro',
    'DestaquesPartida',
    'ClassificacaoEntrada',
    'InscricaoCampeonato'
  )
order by t.relname, i.relname;

-- Apoio do backlog de integridade. Só lê definição. Não cria constraint.
select
  c.conrelid::regclass as tabela,
  c.conname,
  c.contype,
  pg_get_constraintdef(c.oid) as definicao
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in ('Partida', 'SetPartida', 'InscricaoCampeonato')
order by t.relname, c.contype, c.conname;

-- Funções de public sem search_path fixo. A observação de produção fala em
-- 6. O repositório tem mais definições sem SET search_path; esta lista é
-- a do banco ligado, não a do arquivo.
select
  p.proname as funcao,
  pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (
    select 1
    from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
    where cfg like 'search_path=%'
  )
order by p.proname;

-- Duplicatas que impediriam uma unicidade futura. Só conta. Não apaga.
select 'SetPartida' as tabela, "partidaId", numero, count(*) as linhas
from public."SetPartida"
group by "partidaId", numero
having count(*) > 1;

select
  'InscricaoCampeonato' as tabela,
  "ligaId",
  "equipeId",
  "categoriaCampeonatoId",
  count(*) as linhas
from public."InscricaoCampeonato"
group by "ligaId", "equipeId", "categoriaCampeonatoId"
having count(*) > 1;
