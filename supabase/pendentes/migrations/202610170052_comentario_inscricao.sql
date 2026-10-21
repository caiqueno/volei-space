-- 202610170052_comentario_inscricao.sql   (Rodada 18, inscrição por campeonato)
--
-- OBJETIVO
--   "ComentarioInscricao": conversa de correção entre organizador e líder dentro de uma inscrição
--   (pedido de correção, resposta, nota). "autor" é text sem FK (não existe tabela Usuario; guarda o id
--   da conta, mesmo padrão de "Notificacao"."usuarioId"). "autorPapel" ORGANIZADOR ou LIDER; "tipo"
--   CORRECAO, RESPOSTA ou NOTA; "mensagem" 1 a 1000 caracteres, SEM dado pessoal (CPF, telefone,
--   documento): o servidor deve recusar. "resolvidoEm" nulo = em aberto. Apagar a inscrição apaga os
--   comentários (on delete cascade). Índice por ("inscricaoId", "criadoEm").
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role; o servidor
--   confere que o organizador é dono da liga da inscrição (isolamento A x B é do servidor, via
--   "Inscricao"."ligaId") e que o líder é membro do time.
--
-- PRÉ-REQUISITOS
--   * 202610170026 aplicada ("Inscricao"; a migration aborta se não existir).
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabela nova).
--
-- BACKUP NECESSÁRIO
--   Nenhum (objeto novo).
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos; lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170052_comentario_inscricao.sql (apaga os comentários).

begin;
set local lock_timeout = '5s';

do $v$
begin
  if to_regclass('public."Inscricao"') is null then
    raise exception 'Aplique antes a 202610170026 (Inscricao)';
  end if;
end
$v$;

create table if not exists public."ComentarioInscricao" (
  id              uuid primary key default gen_random_uuid(),
  "inscricaoId"   uuid not null references public."Inscricao"(id) on delete cascade,
  autor           text not null check (char_length(autor) between 1 and 100),
  "autorPapel"    text not null check ("autorPapel" in ('ORGANIZADOR', 'LIDER')),
  mensagem        text not null check (char_length(btrim(mensagem)) between 1 and 1000),
  tipo            text not null check (tipo in ('CORRECAO', 'RESPOSTA', 'NOTA')),
  "criadoEm"      timestamptz not null default now(),
  "resolvidoEm"   timestamptz
);
create index if not exists "ComentarioInscricao_inscricao_criadoEm_idx"
  on public."ComentarioInscricao" ("inscricaoId", "criadoEm");

alter table public."ComentarioInscricao" enable row level security;
revoke all on table public."ComentarioInscricao" from public, anon, authenticated;
grant select, insert, update, delete on table public."ComentarioInscricao" to service_role;

commit;
