-- 202610170050_buckets_time_atleta.sql   (Rodada 17, buckets de escudo do time e de foto/documento do atleta)
--
-- OBJETIVO
--   Criar, de forma idempotente, os buckets do Meu Time (upload só por URL assinada emitida pelo servidor):
--   * time-escudo         PÚBLICO (leitura por URL pública), 2 MB, image/png, image/jpeg, image/webp;
--   * atleta-foto-rosto   PÚBLICO e SEPARADO (decisão D5: só foto de rosto), 2 MB, image/png, image/jpeg,
--                         image/webp;
--   * atleta-documento    PRIVADO, 5 MB, image/jpeg, image/png, image/webp e application/pdf (leitura só por
--                         URL assinada de 120 s, src/lib/uploads).
--   NENHUMA policy é criada em storage.objects: sem policy, anon e authenticated não conseguem inserir,
--   atualizar, apagar nem listar; o servidor usa service_role e URL assinada de envio. Um bloco no fim
--   ABORTA a migration se alguma policy existente deixar anon/authenticated/public escrever nesses buckets.
--
--   EXISTENTES (0004 e src/lib/uploads/config.ts, a verificar no banco real): "atleta-arquivos" (privado,
--   8 MB, documentos), "jogador-fotos-rosto" (público, 4 MB), "equipe-emblemas" (público, 4 MB), além de
--   quadra-fotos, galeria-campeonato e organizador-logos. Os três buckets desta migration são NOVOS e
--   independentes; o código atual ainda envia para os antigos. Ligar os tipos de upload do Meu Time aos
--   novos nomes é trabalho de backend (src/lib/uploads/config.ts), fora desta migration, e o limite do
--   servidor deve acompanhar (2 MB, 2 MB, 5 MB). O bucket é a barreira real de tamanho e MIME.
--
-- PRÉ-REQUISITOS
--   Schema "storage" do Supabase com storage.buckets (id, name, public, file_size_limit,
--   allowed_mime_types). Não depende de outras pendentes (a 0004 é independente).
--
-- QUEBRA DE ROTAS
--   Nenhuma (buckets novos, ninguém envia para eles ainda).
--
-- BACKUP NECESSÁRIO
--   Nenhum (nada existente é alterado). Se algum desses ids já existir com outra configuração, o upsert
--   reescreve public, limite e MIME: conferir antes com
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets (leitura).
--
-- JANELA SEGURA
--   Qualquer horário.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170050_buckets_time_atleta.sql (não apaga bucket nem objeto: o Storage
--   do Supabase bloqueia DELETE direto em storage.buckets; apenas fecha a leitura pública. Para remover,
--   esvaziar e excluir pelo painel ou pela API de Storage, depois de backup).

begin;
set local lock_timeout = '5s';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'time-escudo', 'time-escudo', true, 2097152,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atleta-foto-rosto', 'atleta-foto-rosto', true, 2097152,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atleta-documento', 'atleta-documento', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Asserções: documento privado e nenhuma escrita direta de anon/authenticated nos três buckets.
do $b$
declare
  achada text;
begin
  if exists (select 1 from storage.buckets where id = 'atleta-documento' and public) then
    raise exception 'atleta-documento precisa ser privado';
  end if;

  select string_agg(policyname, ', ') into achada
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and (roles && array['public', 'anon', 'authenticated']::name[])
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(time-escudo|atleta-foto-rosto|atleta-documento)';
  if achada is not null then
    raise exception 'policy(s) permitem escrita direta nos buckets novos: %', achada;
  end if;

  select string_agg(policyname, ', ') into achada
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and cmd in ('SELECT', 'ALL')
    and (roles && array['public', 'anon', 'authenticated']::name[])
    and (coalesce(qual, '') ~ 'atleta-documento');
  if achada is not null then
    raise exception 'policy(s) permitem leitura direta de atleta-documento: %', achada;
  end if;
end
$b$;

commit;
