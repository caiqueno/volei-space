-- Reversão de 202610170004_bucket_atleta_privado.sql
--
-- ATENÇÃO: reabre documentos de atletas (inclui menores) a qualquer pessoa com a URL, e restaura
-- o upload/UPDATE anônimo. Só em emergência, por prazo curto.
-- Os objetos não são movidos nem apagados pela migration; reverter apenas muda flag e policies.
-- As colunas "Jogador"."*Legado" NÃO são removidas (são backup de URLs). Remover só depois de a
-- etapa 2 (reescrita de URLs) ter sido validada ou descartada, e com backup:
--   alter table public."Jogador" drop column if exists "fotoUrlLegado", drop column if exists "fotoRostoUrlLegado", drop column if exists "documentosUrlsLegado";
-- Se a etapa 2 (reescrita de URLs) já tiver rodado, restaurar antes fotoUrl/fotoRostoUrl/documentosUrls
-- a partir das colunas *Legado (ver 16-plano-aplicacao-migrations.md).
-- Depois: supabase migration repair --status reverted 202610170004

begin;
set local lock_timeout = '5s';

update storage.buckets set public = true where id = 'atleta-arquivos';

drop policy if exists "luv_leitura_buckets_publicos" on storage.objects;
drop policy if exists "luv_upload_transitorio_buckets_publicos" on storage.objects;

-- Policies originais (supabase-storage-uploads-elenco-quadras.sql, a versão mais ampla).
drop policy if exists "luv_public_read_uploads" on storage.objects;
drop policy if exists "luv_public_insert_uploads" on storage.objects;
drop policy if exists "luv_public_update_uploads" on storage.objects;
drop policy if exists "luv_read_public_uploads" on storage.objects;
drop policy if exists "luv_insert_public_uploads" on storage.objects;
create policy "luv_public_read_uploads"
on storage.objects for select to anon, authenticated
using (bucket_id in ('equipe-emblemas', 'atleta-arquivos', 'jogador-fotos', 'quadra-fotos'));

create policy "luv_public_insert_uploads"
on storage.objects for insert to anon, authenticated
with check (bucket_id in ('equipe-emblemas', 'atleta-arquivos', 'jogador-fotos', 'quadra-fotos'));

create policy "luv_public_update_uploads"
on storage.objects for update to anon, authenticated
using (bucket_id in ('equipe-emblemas', 'atleta-arquivos', 'jogador-fotos', 'quadra-fotos'))
with check (bucket_id in ('equipe-emblemas', 'atleta-arquivos', 'jogador-fotos', 'quadra-fotos'));

-- galeria-campeonato tinha policies na versão de supabase-admin-uploads-portal.sql.
create policy "luv_read_public_uploads"
on storage.objects for select to anon, authenticated
using (bucket_id in ('atleta-arquivos', 'jogador-fotos', 'quadra-fotos', 'galeria-campeonato'));

create policy "luv_insert_public_uploads"
on storage.objects for insert to anon, authenticated
with check (bucket_id in ('atleta-arquivos', 'jogador-fotos', 'quadra-fotos', 'galeria-campeonato'));

-- O bucket jogador-fotos-rosto pode ficar (público, sem escrita anônima). Para removê-lo, esvaziar antes:
--   delete from storage.buckets where id = 'jogador-fotos-rosto';   (falha se houver objetos)

commit;
