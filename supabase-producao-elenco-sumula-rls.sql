-- LUV - elenco do capitão, arquivos de atletas e endurecimento inicial de RLS.
-- Execute no SQL Editor do Supabase.
--
-- IMPORTANTE:
-- Antes de ativar políticas restritivas em produção, configure no Vercel:
-- SUPABASE_SERVICE_ROLE_KEY = chave service_role do projeto Supabase.
-- As rotas sensíveis do backend usam essa chave para escrever com segurança.

-- 1) Campo para guardar documentos anexados ao atleta.
alter table public."Jogador"
  add column if not exists "documentosUrls" text;

-- 2) Bucket público controlado para fotos e documentos de atletas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atleta-arquivos',
  'atleta-arquivos',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "atleta_arquivos_leitura_publica" on storage.objects;
create policy "atleta_arquivos_leitura_publica"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'atleta-arquivos');

drop policy if exists "atleta_arquivos_upload_publico_temporario" on storage.objects;
create policy "atleta_arquivos_upload_publico_temporario"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'atleta-arquivos');

drop policy if exists "atleta_arquivos_update_publico_temporario" on storage.objects;
create policy "atleta_arquivos_update_publico_temporario"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'atleta-arquivos')
with check (bucket_id = 'atleta-arquivos');

-- 3) Leitura pública das páginas do campeonato.
-- Escritas devem passar pelo backend com service_role.
alter table public."Liga" enable row level security;
alter table public."Equipe" enable row level security;
alter table public."Jogador" enable row level security;
alter table public."Partida" enable row level security;
alter table public."SetPartida" enable row level security;
alter table public."SumulaPresenca" enable row level security;
alter table public."OcorrenciaPartida" enable row level security;
alter table public."DestaquesPartida" enable row level security;
alter table public."ClassificacaoEntrada" enable row level security;
alter table public."InscricaoCampeonato" enable row level security;

drop policy if exists "public_read_ligas" on public."Liga";
create policy "public_read_ligas" on public."Liga"
for select to anon, authenticated
using (true);

drop policy if exists "public_read_equipes" on public."Equipe";
create policy "public_read_equipes" on public."Equipe"
for select to anon, authenticated
using (true);

drop policy if exists "public_read_jogadores" on public."Jogador";
create policy "public_read_jogadores" on public."Jogador"
for select to anon, authenticated
using (true);

drop policy if exists "public_read_partidas" on public."Partida";
create policy "public_read_partidas" on public."Partida"
for select to anon, authenticated
using (true);

drop policy if exists "public_read_sets" on public."SetPartida";
create policy "public_read_sets" on public."SetPartida"
for select to anon, authenticated
using (true);

drop policy if exists "public_read_sumula_presencas" on public."SumulaPresenca";
create policy "public_read_sumula_presencas" on public."SumulaPresenca"
for select to anon, authenticated
using (true);

drop policy if exists "public_read_ocorrencias" on public."OcorrenciaPartida";
create policy "public_read_ocorrencias" on public."OcorrenciaPartida"
for select to anon, authenticated
using (true);

drop policy if exists "public_read_destaques" on public."DestaquesPartida";
create policy "public_read_destaques" on public."DestaquesPartida"
for select to anon, authenticated
using (true);

drop policy if exists "public_read_classificacao" on public."ClassificacaoEntrada";
create policy "public_read_classificacao" on public."ClassificacaoEntrada"
for select to anon, authenticated
using (true);

drop policy if exists "public_read_inscricoes_campeonato" on public."InscricaoCampeonato";
create policy "public_read_inscricoes_campeonato" on public."InscricaoCampeonato"
for select to anon, authenticated
using (true);

-- 4) Bloqueio explícito de escrita pública nas tabelas críticas.
-- O service_role ignora RLS; as rotas do backend validam o tipo de usuário por JWT próprio.
-- Não crie policies de insert/update/delete para anon nessas tabelas em produção.
