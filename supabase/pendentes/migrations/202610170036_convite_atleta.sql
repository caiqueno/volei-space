-- 202610170036_convite_atleta.sql   (Rodada 10, Meu Time)
--
-- OBJETIVO
--   "ConviteAtleta": convite enviado pelo líder da equipe para o atleta completar o próprio cadastro.
--   Guarda só o HASH do token ("tokenHash" único; o token em claro nunca vai ao banco) e o contato do
--   convidado CIFRADO no aplicativo ("contatoCifrado", chave fora do banco, LGPD). Estados PENDENTE,
--   ACEITO, EXPIRADO, REVOGADO; "aceitoEm" e "atletaId" só existem depois do aceite.
--   "equipeId" referencia "TimeClube" (a equipe permanente do Meu Time, 0024), não a "Equipe" legada.
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--   CIÊNCIA LGPD: no aceite o servidor grava "cienciaLgpdEm" (momento em que o atleta confirmou ter lido o
--   aviso de privacidade) e "cienciaVersao" (versão do texto exibido). Ambos nulos até o aceite.
--   USO DE "contatoCifrado": reservado para o contato (e-mail/telefone) do atleta convidado, cifrado no
--   aplicativo. Hoje nenhuma leitura o usa e NENHUMA rota o devolve; se um dia for lido, só o servidor
--   decifra, nunca o devolve ao cliente.
--
-- PRÉ-REQUISITOS
--   202610170024 ("TimeClube") e 202610170025 ("Atleta") aplicadas.
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabela nova, nada existente é alterado).
--
-- BACKUP NECESSÁRIO
--   Nenhum agora (tabela nova). Com dados reais, "contatoCifrado" entra no backup com acesso restrito.
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos; lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170036_convite_atleta.sql (apaga os convites emitidos).

begin;
set local lock_timeout = '5s';

create table if not exists public."ConviteAtleta" (
  id               uuid primary key default gen_random_uuid(),
  "timeId"         uuid not null references public."TimeClube"(id) on delete cascade,
  "tokenHash"      text not null check (char_length("tokenHash") between 32 and 256),
  "contatoCifrado" bytea,
  "criadoPor"      text not null check (char_length("criadoPor") between 1 and 100),
  "criadoEm"       timestamptz not null default now(),
  "expiraEm"       timestamptz not null,
  "revogadoEm"     timestamptz,
  "usadoEm"        timestamptz,
  "atletaId"       uuid references public."Atleta"(id) on delete set null,
  "cienciaLgpdEm"  timestamptz,
  "cienciaVersao"  text check ("cienciaVersao" is null or char_length("cienciaVersao") <= 50),
  constraint "ConviteAtleta_tokenHash_key" unique ("tokenHash")
);
create index if not exists "ConviteAtleta_timeId_idx" on public."ConviteAtleta" ("timeId");

alter table public."ConviteAtleta" enable row level security;
revoke all on table public."ConviteAtleta" from public, anon, authenticated;
grant select, insert, update, delete on table public."ConviteAtleta" to service_role;

commit;
