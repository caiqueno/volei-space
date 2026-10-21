-- Reversão de 202610170055. NÃO apaga bucket nem objeto (o Storage bloqueia DELETE direto em
-- storage.buckets e apagar perderia arquivos). Mantém o bucket privado e fecha novos envios
-- (limite 1 byte e lista de MIME vazia). Para remover de vez, esvazie e exclua pelo painel ou pela
-- API de Storage, depois de backup.
begin;
set local lock_timeout = '5s';
update storage.buckets
set public = false,
    file_size_limit = 1,
    allowed_mime_types = array[]::text[]
where id = 'comprovante-pagamento';
commit;
