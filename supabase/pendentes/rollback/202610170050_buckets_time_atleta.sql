-- Reversão de 202610170050. NÃO apaga bucket nem objeto (o Storage bloqueia DELETE direto em
-- storage.buckets e apagar perderia arquivos). Fecha a leitura pública dos dois buckets públicos; para
-- remover de vez, esvazie e exclua pelo painel ou pela API de Storage, depois de backup.
begin;
set local lock_timeout = '5s';
update storage.buckets set public = false where id in ('time-escudo', 'atleta-foto-rosto');
commit;
