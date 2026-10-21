-- 202610170048_atleta_dados_cadastrais.sql   (Rodada 17, dados cadastrais do atleta: foto, documento, contatos)
--
-- OBJETIVO
--   Completar o cadastro do atleta do Meu Time, de forma ADITIVA e com tudo nulo, sem guardar nada em claro:
--   * "Atleta": "fotoRostoPath" (caminho no bucket de foto de rosto, nunca URL), "fotoRostoEnviadaEm"
--     e CHECK de "documentoTipo" em ('RG','CNH','CERTIDAO','PASSAPORTE','OUTRO');
--   * "AtletaDocumento" (1:1 com "Atleta", onde a PII já mora desde a 0025): "documentoPath" (caminho no
--     bucket PRIVADO, nunca URL), "documentoEnviadoEm", e garantia de que "cpfCifrado",
--     "documentoNumeroCifrado", "telefoneCifrado" e "telefoneEmergenciaCifrado" existem como bytea.
--   * CHECK de formato nos quatro campos cifrados (octet_length >= 30, o mínimo do formato de
--     src/lib/lgpd/cifra.ts: 0x01 | iv(12) | tag(16) | texto): um CPF ou telefone gravado em claro (11 a
--     14 bytes) é recusado pelo banco. O valor entra como literal \x... (PostgREST), como a cifra já faz.
--
--   DECISÕES (desvios do pedido, justificados):
--   a. As colunas cifradas NÃO foram duplicadas em "Atleta". A 0025 já isola CPF, número de documento e
--      telefones em "AtletaDocumento" (cpfCifrado, documentoNumeroCifrado, telefoneCifrado,
--      telefoneEmergenciaCifrado, todas bytea) para que nenhum SELECT comum em "Atleta" traga PII. Por isso
--      "documentoPath" e "documentoEnviadoEm" também ficam em "AtletaDocumento". A foto de rosto, que vai a
--      bucket público e não é dado sensível, fica em "Atleta".
--   b. "cpfHash" e "documentoTipo" já existem em "Atleta" (0025). O hash é HMAC-SHA256 com pepper do
--      servidor sobre os dígitos. O índice único parcial "Atleta_cpfHash_key" (global, só linhas não
--      mescladas) já existe e é o certo: a identidade do atleta é única na plataforma, não por time ou
--      clube (o mesmo atleta passa por vários times e clubes, e a duplicidade por time sai de
--      "InscricaoAtleta_exclusividade_key" e "VinculoAtletaClube" unique (clubeId, atletaId)). Um índice
--      único por time/clube seria mais fraco e permitiria dois cadastros do mesmo CPF. Nada novo aqui.
--   c. O CHECK de "documentoTipo" entra NOT VALID (vale para linhas novas e alteradas; não varre a
--      tabela). Validar depois, se quiser: alter table ... validate constraint "Atleta_documentoTipo_chk".
--
--   Segurança: nenhuma policy, nenhum grant; as tabelas continuam com RLS ligada e só service_role (0025).
--
-- PRÉ-REQUISITOS
--   202610170025 aplicada ("Atleta" e "AtletaDocumento"). A migration aborta com mensagem clara se faltar.
--
-- QUEBRA DE ROTAS
--   Nenhuma (colunas e checks novos; o código atual não grava essas colunas). Um INSERT/UPDATE que grave
--   cifrado com menos de 30 bytes, ou "documentoTipo" fora da lista, passa a ser recusado.
--
-- BACKUP NECESSÁRIO
--   Nenhum (só adição). Antes de VALIDATE de qualquer CHECK com dado real, conferir por consulta de leitura
--   (sem copiar PII) se há "documentoTipo" fora da lista.
--
-- JANELA SEGURA
--   Qualquer horário, fora de rodada por prudência: ADD COLUMN nullable não reescreve a tabela; o ADD
--   CONSTRAINT NOT VALID pega lock curto (lock_timeout de 5 s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170048_atleta_dados_cadastrais.sql (remove as colunas novas, perdendo
--   os caminhos gravados nelas; os arquivos no Storage ficam intactos) e os CHECKs.

begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."Atleta"') is null or to_regclass('public."AtletaDocumento"') is null then
    raise exception 'Aplique antes a 202610170025 (Atleta e AtletaDocumento)';
  end if;
end
$$;

alter table public."Atleta"
  add column if not exists "fotoRostoPath"       text,
  add column if not exists "fotoRostoEnviadaEm"  timestamptz;

alter table public."AtletaDocumento"
  add column if not exists "cpfCifrado"                bytea,
  add column if not exists "documentoNumeroCifrado"    bytea,
  add column if not exists "telefoneCifrado"           bytea,
  add column if not exists "telefoneEmergenciaCifrado" bytea,
  add column if not exists "documentoPath"             text,
  add column if not exists "documentoEnviadoEm"        timestamptz;

comment on column public."Atleta"."fotoRostoPath" is
  'Caminho do objeto no bucket de foto de rosto (nunca URL). Gravado pelo servidor apos upload por URL assinada.';
comment on column public."AtletaDocumento"."documentoPath" is
  'Caminho do objeto no bucket PRIVADO de documentos (nunca URL). Leitura so por URL assinada de curta duracao.';
comment on column public."AtletaDocumento"."cpfCifrado" is
  'CPF cifrado (AES-256-GCM, formato de src/lib/lgpd/cifra.ts). Nunca em claro.';

-- CHECKs idempotentes (NOT VALID: valem para linhas novas, sem varrer a tabela).
do $$
declare
  caminho text := $c$%s is null or (char_length(%s) between 3 and 300
      and %s !~ '^[A-Za-z][A-Za-z0-9+.-]*:' and %s !~ '^/' and %s !~ '(^|/)\.\.(/|$)')$c$;
  col text;
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public."Atleta"'::regclass and conname = 'Atleta_documentoTipo_chk') then
    alter table public."Atleta" add constraint "Atleta_documentoTipo_chk"
      check ("documentoTipo" is null or "documentoTipo" in ('RG', 'CNH', 'CERTIDAO', 'PASSAPORTE', 'OUTRO')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public."Atleta"'::regclass and conname = 'Atleta_fotoRostoPath_chk') then
    execute format('alter table public."Atleta" add constraint "Atleta_fotoRostoPath_chk" check (%s) not valid',
      format(caminho, '"fotoRostoPath"', '"fotoRostoPath"', '"fotoRostoPath"', '"fotoRostoPath"', '"fotoRostoPath"'));
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public."AtletaDocumento"'::regclass and conname = 'AtletaDocumento_documentoPath_chk') then
    execute format('alter table public."AtletaDocumento" add constraint "AtletaDocumento_documentoPath_chk" check (%s) not valid',
      format(caminho, '"documentoPath"', '"documentoPath"', '"documentoPath"', '"documentoPath"', '"documentoPath"'));
  end if;

  foreach col in array array['cpfCifrado', 'documentoNumeroCifrado', 'telefoneCifrado', 'telefoneEmergenciaCifrado'] loop
    if not exists (select 1 from pg_constraint where conrelid = 'public."AtletaDocumento"'::regclass and conname = 'AtletaDocumento_' || col || '_chk') then
      execute format('alter table public."AtletaDocumento" add constraint %I check (%I is null or octet_length(%I) >= 30) not valid',
        'AtletaDocumento_' || col || '_chk', col, col);
    end if;
  end loop;
end
$$;

commit;
