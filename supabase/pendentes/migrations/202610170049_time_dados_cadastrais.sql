-- 202610170049_time_dados_cadastrais.sql   (Rodada 17, dados cadastrais do time)
--
-- OBJETIVO
--   Acrescentar a "TimeClube" (a equipe permanente do Meu Time), de forma ADITIVA e nullable:
--   * "contatoEmail" text, normalizado em minúsculas, com formato mínimo;
--   * "contatoTelefoneCifrado" bytea, no formato de src/lib/lgpd/cifra.ts (octet_length >= 30): telefone
--     NUNCA em claro;
--   * "corPrimaria" e "corSecundaria" text, no formato #RRGGBB;
--   * "escudoPath" text: caminho no bucket de escudo (nunca URL). "escudoUrl" (0024) segue existindo para
--     compatibilidade com o código atual; a troca de uma pela outra é decisão do backend.
--   Os CHECKs entram NOT VALID (valem para linhas novas e alteradas, sem varrer a tabela).
--
--   Segurança: nenhuma policy, nenhum grant; "TimeClube" continua com RLS ligada e só service_role (0024).
--   Isolamento entre organizadores: o servidor só entrega estes campos a membro do time (MembroEquipe) ou
--   ao organizador da inscrição, e o telefone cifrado nunca sai em API pública.
--
-- PRÉ-REQUISITOS
--   202610170024 aplicada ("TimeClube"). A migration aborta com mensagem clara se faltar.
--
-- QUEBRA DE ROTAS
--   Nenhuma (colunas nulas novas, nenhum código as grava ainda). Escrita de cor fora
--   de #RRGGBB ou telefone cifrado curto passa a ser recusada.
--
-- BACKUP NECESSÁRIO
--   Nenhum (só adição).
--
-- JANELA SEGURA
--   Qualquer horário, fora de rodada por prudência (lock_timeout de 5 s). ADD COLUMN nullable não reescreve
--   a tabela.
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170049_time_dados_cadastrais.sql (remove CHECKs e colunas; os dados
--   gravados nelas se perdem).

begin;
set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."TimeClube"') is null then
    raise exception 'Aplique antes a 202610170024 (TimeClube)';
  end if;
end
$$;

alter table public."TimeClube"
  add column if not exists "contatoEmail"           text,
  add column if not exists "contatoTelefoneCifrado" bytea,
  add column if not exists "corPrimaria"            text,
  add column if not exists "corSecundaria"          text,
  add column if not exists "escudoPath"             text;

comment on column public."TimeClube"."contatoTelefoneCifrado" is
  'Telefone de contato cifrado (AES-256-GCM, src/lib/lgpd/cifra.ts). Nunca em claro, nunca em API publica.';
comment on column public."TimeClube"."escudoPath" is
  'Caminho do objeto no bucket de escudo (nunca URL). Gravado pelo servidor apos upload por URL assinada.';

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public."TimeClube"'::regclass and conname = 'TimeClube_contatoEmail_chk') then
    alter table public."TimeClube" add constraint "TimeClube_contatoEmail_chk"
      check ("contatoEmail" is null or ("contatoEmail" = lower(btrim("contatoEmail"))
             and char_length("contatoEmail") between 3 and 320 and position('@' in "contatoEmail") > 1)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public."TimeClube"'::regclass and conname = 'TimeClube_contatoTelefoneCifrado_chk') then
    alter table public."TimeClube" add constraint "TimeClube_contatoTelefoneCifrado_chk"
      check ("contatoTelefoneCifrado" is null or octet_length("contatoTelefoneCifrado") >= 30) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public."TimeClube"'::regclass and conname = 'TimeClube_corPrimaria_chk') then
    alter table public."TimeClube" add constraint "TimeClube_corPrimaria_chk"
      check ("corPrimaria" is null or "corPrimaria" ~ '^#[0-9a-fA-F]{6}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public."TimeClube"'::regclass and conname = 'TimeClube_corSecundaria_chk') then
    alter table public."TimeClube" add constraint "TimeClube_corSecundaria_chk"
      check ("corSecundaria" is null or "corSecundaria" ~ '^#[0-9a-fA-F]{6}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public."TimeClube"'::regclass and conname = 'TimeClube_escudoPath_chk') then
    alter table public."TimeClube" add constraint "TimeClube_escudoPath_chk"
      check ("escudoPath" is null or (char_length("escudoPath") between 3 and 300
             and "escudoPath" !~ '^[A-Za-z][A-Za-z0-9+.-]*:' and "escudoPath" !~ '^/'
             and "escudoPath" !~ '(^|/)\.\.(/|$)')) not valid;
  end if;
end
$$;

commit;
