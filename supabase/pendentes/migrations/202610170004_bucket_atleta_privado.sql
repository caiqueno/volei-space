-- 202610170004_bucket_atleta_privado.sql   (M2 do plano da Fase 0, decisão D5)
--
-- OBJETIVO
--   1. Tornar o bucket atleta-arquivos PRIVADO (documentos e fotos de atletas, inclusive menores).
--   2. Remover as policies de storage.objects que dão SELECT/INSERT/UPDATE a anon nesse bucket
--      (supabase-producao-elenco-sumula-rls.sql:13-48, supabase-admin-uploads-portal.sql:27-59,
--       supabase-storage-uploads-elenco-quadras.sql:5-37). As policies de lista (bucket_id in (...))
--      são substituídas por policies que NÃO citam atleta-arquivos.
--   3. Criar o bucket PÚBLICO separado jogador-fotos-rosto, só para foto de rosto (D5), com leitura
--      pública e SEM upload anônimo (escrita só por service_role, via rota do servidor).
--   4. Criar as colunas de apoio "fotoUrlLegado", "fotoRostoUrlLegado" e "documentosUrlsLegado" em
--      "Jogador", vazias. SEM reescrever nenhuma URL nesta migration (decisão: reescrita destrutiva
--      fica para passo separado, ver docs/analise/16-plano-aplicacao-migrations.md, seção M2-etapa-2).
--
--   Upload anônimo continua temporariamente permitido (só INSERT, sem UPDATE) nos buckets
--   equipe-emblemas, jogador-fotos, quadra-fotos e galeria-campeonato, porque os componentes do
--   navegador ainda enviam direto. Todos usam upsert:false, então não precisam de UPDATE. Remover o
--   INSERT quando esses uploads migrarem para rota de servidor (política
--   luv_upload_transitorio_buckets_publicos abaixo).
--
-- PRÉ-REQUISITOS
--   a. Q4, Q5 e Q5b rodadas (buckets, policies de storage e volume por bucket) e guardadas fora do repo.
--   b. Código novo em produção ANTES: rota de servidor para upload (valida tipo e tamanho) e para URL
--      assinada de curta duração (após checar organizador dono, capitão ou árbitro escalado). Foto de
--      rosto nova vai para jogador-fotos-rosto; documento vai para atleta-arquivos (privado).
--   c. Backup dos objetos (ver abaixo) concluído e conferido.
--   d. NUNCA reaplicar supabase-admin-uploads-portal.sql nem supabase-storage-uploads-elenco-quadras.sql
--      depois desta migration: ambos fazem upsert de storage.buckets com public = true e recriam as
--      policies abertas. (Plano: movê-los para supabase/legacy/ na baseline.)
--
-- QUEBRA DE ROTAS E TELAS
--   * Uploads diretos do navegador em atleta-arquivos: src/app/capitao/page.tsx:337-345 (foto e
--     documentos do atleta) e FormularioInscricaoRapida.tsx:104 (quando bucket = atleta-arquivos).
--   * Todo <img>, <a> ou JSON com URL pública antiga de atleta-arquivos
--     (/storage/v1/object/public/atleta-arquivos/...) passa a devolver 400/404:
--     src/app/admin/candidaturas/page.tsx:272 e :346, api/capitao/jogadores/route.ts (204-224),
--     api/arbitro/partidas/[token], api/jogadores/qr/[token] (usa fotoRostoUrl), ao-vivo e súmula.
--     Enquanto as URLs gravadas não forem reescritas (etapa 2), fotos antigas deixam de aparecer.
--   * Links de documentos já compartilhados no WhatsApp deixam de abrir: avisar os organizadores.
--
-- BACKUP NECESSÁRIO (obrigatório)
--   Cópia de TODOS os objetos de atleta-arquivos para armazenamento privado e cifrado fora do projeto
--   Supabase (conferir contagem e tamanho com Q5b) e dump das colunas Jogador.fotoUrl, fotoRostoUrl e
--   documentosUrls (sem copiar para arquivos do repositório nem para respostas).
--
-- JANELA SEGURA
--   Janela própria, separada de M1, em dia sem jogos, depois do deploy do código de upload/URL assinada.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170004_bucket_atleta_privado.sql (volta public = true e recria as
--   policies de Q5; as colunas *Legado ficam, são backup).

begin;
set local lock_timeout = '5s';

-- 1) Bucket privado. Se não existir (banco novo), cria já privado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atleta-arquivos', 'atleta-arquivos', false, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 2) Bucket público só para foto de rosto (limite de 4 MB, o mesmo do capitão).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'jogador-fotos-rosto', 'jogador-fotos-rosto', true, 4194304,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 3) Remove TODAS as policies abertas que citam atleta-arquivos (nomes conhecidos).
drop policy if exists "atleta_arquivos_leitura_publica" on storage.objects;
drop policy if exists "atleta_arquivos_upload_publico_temporario" on storage.objects;
drop policy if exists "atleta_arquivos_update_publico_temporario" on storage.objects;
drop policy if exists "luv_read_public_uploads" on storage.objects;
drop policy if exists "luv_insert_public_uploads" on storage.objects;
drop policy if exists "luv_update_public_uploads" on storage.objects;
drop policy if exists "luv_public_read_uploads" on storage.objects;
drop policy if exists "luv_public_insert_uploads" on storage.objects;
drop policy if exists "luv_public_update_uploads" on storage.objects;

-- 4) Policies novas, sem atleta-arquivos.
--    Leitura (necessária para listagem/consulta pela API de storage; a URL pública de bucket
--    público não depende dela). Residual a verificar: a policy permite listar os objetos dos buckets
--    públicos; remover se o upload funcionar sem ela em preview.
drop policy if exists "luv_leitura_buckets_publicos" on storage.objects;
create policy "luv_leitura_buckets_publicos"
on storage.objects
for select
to anon, authenticated
using (bucket_id in (
  'equipe-emblemas', 'jogador-fotos', 'jogador-fotos-rosto', 'quadra-fotos', 'galeria-campeonato'
));

--    Upload TRANSITÓRIO do navegador: só INSERT, só nos buckets de imagem pública. jogador-fotos-rosto
--    fica de fora de propósito (escrita só por service_role).
drop policy if exists "luv_upload_transitorio_buckets_publicos" on storage.objects;
create policy "luv_upload_transitorio_buckets_publicos"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id in (
  'equipe-emblemas', 'jogador-fotos', 'quadra-fotos', 'galeria-campeonato'
));

-- 5) Colunas de apoio (ponto de reversão da reescrita de URLs). Vazias aqui; o preenchimento é a
--    etapa 2, em lotes e fora desta migration (UPDATE em "Jogador" dispara triggers de categoria).
alter table public."Jogador"
  add column if not exists "fotoUrlLegado" text,
  add column if not exists "fotoRostoUrlLegado" text,
  add column if not exists "documentosUrlsLegado" text;

comment on column public."Jogador"."fotoUrlLegado" is
  'Copia da URL publica antiga de fotoUrl antes da reescrita para caminho relativo (M2 etapa 2). Backup.';
comment on column public."Jogador"."fotoRostoUrlLegado" is
  'Copia da URL publica antiga de fotoRostoUrl antes da reescrita (M2 etapa 2). Backup.';
comment on column public."Jogador"."documentosUrlsLegado" is
  'Copia de documentosUrls antes da reescrita (M2 etapa 2). Backup; contem referencias a documentos.';

-- Mesmo com revoke de M1, garantir que as colunas novas não ficam acessíveis a anon.
revoke all on table public."Jogador" from anon, authenticated;

-- 6) Asserção: o bucket de documentos tem de estar privado.
do $m2$
begin
  if exists (select 1 from storage.buckets where id = 'atleta-arquivos' and public) then
    raise exception 'M2 incompleta: atleta-arquivos continua publico';
  end if;
end
$m2$;

commit;
