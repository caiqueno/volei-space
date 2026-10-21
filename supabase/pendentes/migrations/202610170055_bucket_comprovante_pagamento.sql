-- 202610170055_bucket_comprovante_pagamento.sql   (Rodada 19, comprovante de pagamento Pix da inscrição)
--
-- OBJETIVO
--   Criar, de forma idempotente, o bucket PRIVADO "comprovante-pagamento" (5 MB; image/jpeg, image/png,
--   image/webp e application/pdf). Padrão da 0050: upload só por URL assinada de envio emitida pelo
--   servidor; leitura só por URL assinada curta, para o líder dono da inscrição e para o organizador da
--   liga. O comprovante pode conter dado pessoal (nome, CPF parcial, banco): nunca público.
--   NENHUMA policy é criada em storage.objects: sem policy, anon e authenticated não leem, não listam,
--   não inserem, não atualizam nem apagam. Um bloco no fim ABORTA a migration se alguma policy existente
--   deixar anon/authenticated/public escrever ou ler esse bucket.
--   O caminho do objeto fica em "PagamentoInscricao"."comprovantePath" (0054). Ligar o tipo de upload ao
--   novo bucket é trabalho de backend (src/lib/uploads/config.ts), fora desta migration; o limite do
--   servidor deve acompanhar (5 MB). O bucket é a barreira real de tamanho e MIME.
--
-- PRÉ-REQUISITOS
--   Schema "storage" do Supabase com storage.buckets (id, name, public, file_size_limit,
--   allowed_mime_types). Independe da 0054 (ordem livre entre as duas).
--
-- QUEBRA DE ROTAS
--   Nenhuma (bucket novo, ninguém envia para ele ainda).
--
-- BACKUP NECESSÁRIO
--   Nenhum (nada existente é alterado). Se o id já existir com outra configuração, o upsert reescreve
--   public, limite e MIME: conferir antes com
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets (leitura).
--
-- JANELA SEGURA
--   Qualquer horário.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170055_bucket_comprovante_pagamento.sql (não apaga bucket nem objeto:
--   o Storage bloqueia DELETE direto em storage.buckets; a reversão fecha o acesso zerando o limite de
--   tamanho e a lista de MIME, o que impede novos envios; o bucket continua privado. Para remover,
--   esvaziar e excluir pelo painel ou pela API de Storage, depois de backup).

begin;
set local lock_timeout = '5s';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprovante-pagamento', 'comprovante-pagamento', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Asserções: bucket privado e nenhuma policy de anon/authenticated/public que leia ou escreva nele.
do $b$
declare
  achada text;
begin
  if exists (select 1 from storage.buckets where id = 'comprovante-pagamento' and public) then
    raise exception 'comprovante-pagamento precisa ser privado';
  end if;

  select string_agg(policyname, ', ') into achada
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and (roles && array['public', 'anon', 'authenticated']::name[])
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'comprovante-pagamento';
  if achada is not null then
    raise exception 'policy(s) permitem acesso direto a comprovante-pagamento: %', achada;
  end if;
end
$b$;

commit;
