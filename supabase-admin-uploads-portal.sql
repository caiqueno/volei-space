-- Complemento para os itens de Admin, Portal publico e Uploads.
-- Rode no SQL Editor do Supabase.

create table if not exists public."AdminAcaoHistorico" (
  id uuid primary key default gen_random_uuid(),
  "adminEmail" text,
  tipo text not null,
  "registroId" text not null,
  acao text not null,
  detalhes jsonb default '{}'::jsonb,
  "criadaEm" timestamptz not null default now()
);

create index if not exists "AdminAcaoHistorico_tipo_registro_idx"
  on public."AdminAcaoHistorico" (tipo, "registroId", "criadaEm" desc);

alter table public."AdminAcaoHistorico" enable row level security;

drop policy if exists "admin_historico_service_role_all" on public."AdminAcaoHistorico";
create policy "admin_historico_service_role_all"
on public."AdminAcaoHistorico"
for all
to service_role
using (true)
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('atleta-arquivos', 'atleta-arquivos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('jogador-fotos', 'jogador-fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('quadra-fotos', 'quadra-fotos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('galeria-campeonato', 'galeria-campeonato', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "luv_read_public_uploads" on storage.objects;
create policy "luv_read_public_uploads"
on storage.objects
for select
to anon, authenticated
using (bucket_id in ('atleta-arquivos', 'jogador-fotos', 'quadra-fotos', 'galeria-campeonato'));

drop policy if exists "luv_insert_public_uploads" on storage.objects;
create policy "luv_insert_public_uploads"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id in ('atleta-arquivos', 'jogador-fotos', 'quadra-fotos', 'galeria-campeonato'));

drop policy if exists "luv_update_public_uploads" on storage.objects;
create policy "luv_update_public_uploads"
on storage.objects
for update
to anon, authenticated
using (bucket_id in ('atleta-arquivos', 'jogador-fotos', 'quadra-fotos', 'galeria-campeonato'))
with check (bucket_id in ('atleta-arquivos', 'jogador-fotos', 'quadra-fotos', 'galeria-campeonato'));
