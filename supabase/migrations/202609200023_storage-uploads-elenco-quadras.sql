-- Buckets e politicas de Storage usados pelos uploads do site.
-- Necessario para emblemas de equipes, foto/documentos de atletas e fotos de quadras.
-- Os arquivos sao publicos porque o frontend usa getPublicUrl para exibir.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('equipe-emblemas', 'equipe-emblemas', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('atleta-arquivos', 'atleta-arquivos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('jogador-fotos', 'jogador-fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('quadra-fotos', 'quadra-fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "luv_public_read_uploads" on storage.objects;
create policy "luv_public_read_uploads"
on storage.objects
for select
to anon, authenticated
using (bucket_id in ('equipe-emblemas', 'atleta-arquivos', 'jogador-fotos', 'quadra-fotos'));

drop policy if exists "luv_public_insert_uploads" on storage.objects;
create policy "luv_public_insert_uploads"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id in ('equipe-emblemas', 'atleta-arquivos', 'jogador-fotos', 'quadra-fotos'));

drop policy if exists "luv_public_update_uploads" on storage.objects;
create policy "luv_public_update_uploads"
on storage.objects
for update
to anon, authenticated
using (bucket_id in ('equipe-emblemas', 'atleta-arquivos', 'jogador-fotos', 'quadra-fotos'))
with check (bucket_id in ('equipe-emblemas', 'atleta-arquivos', 'jogador-fotos', 'quadra-fotos'));
