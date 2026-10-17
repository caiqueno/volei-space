-- 202610170034_papeleta.sql   (Rodada 9, papeleta digital)
--
-- OBJETIVO
--   "Papeleta": formação inicial de uma equipe em um set de uma partida. "formacao" é jsonb com 6 itens
--   {posicao 1..6, jogadorId}; "liberoId" e "capitaoId" são opcionais. Estados: RASCUNHO, ENVIADA, ACEITA.
--   Única por ("partidaId","equipeId","setNumero").
--   IMUTABILIDADE (RG-FOR-006): trigger "papeleta_imutavel_trg" impede alterar formacao, liberoId e capitaoId
--   (e partida/equipe/set) quando a linha já está ENVIADA ou ACEITA, impede voltar de estado e impede DELETE
--   fora de RASCUNHO. "atualizadoEm" é mantido pelo mesmo trigger. Correção depois de enviada é regra de
--   negócio do servidor (ex.: substituição registrada na súmula), nunca edição da papeleta.
--   Segurança: RLS ligada, sem policy e sem grant para anon/authenticated. Só service_role.
--
-- PRÉ-REQUISITOS
--   Tabelas "Partida", "Equipe" e "Jogador" existentes (supabase/migrations). A 0033 não é exigida.
--
-- QUEBRA DE ROTAS
--   Nenhuma (tabela nova, nada existente é alterado).
--
-- BACKUP NECESSÁRIO
--   Nenhum agora (tabela nova). Depois do uso real, a papeleta enviada é prova de jogo: manter no backup.
--
-- JANELA SEGURA
--   Qualquer horário (só objetos novos; lock_timeout de 5s).
--
-- REVERSÃO
--   supabase/pendentes/rollback/202610170034_papeleta.sql (DESTRUTIVO se já houver papeletas: exportar antes).

begin;
set local lock_timeout = '5s';

create table if not exists public."Papeleta" (
  id             uuid primary key default gen_random_uuid(),
  "partidaId"    integer not null references public."Partida"(id) on delete cascade,
  "equipeId"     integer not null references public."Equipe"(id) on delete cascade,
  "setNumero"    integer not null check ("setNumero" between 1 and 5),
  formacao       jsonb not null check (jsonb_typeof(formacao) = 'array' and jsonb_array_length(formacao) = 6),
  "liberoId"     integer references public."Jogador"(id) on delete restrict,
  "capitaoId"    integer references public."Jogador"(id) on delete restrict,
  estado         text not null default 'RASCUNHO' check (estado in ('RASCUNHO', 'ENVIADA', 'ACEITA')),
  "enviadaEm"    timestamptz,
  "aceitaEm"     timestamptz,
  "aceitaPor"    text,
  "conteudoHash" text,
  "criadoEm"     timestamptz not null default now(),
  "atualizadoEm" timestamptz not null default now(),
  constraint "Papeleta_partida_equipe_set_key" unique ("partidaId", "equipeId", "setNumero"),
  constraint "Papeleta_enviada_chk" check (estado = 'RASCUNHO' or ("enviadaEm" is not null and "conteudoHash" is not null)),
  constraint "Papeleta_aceita_chk" check (estado <> 'ACEITA' or ("aceitaEm" is not null and "aceitaPor" is not null))
);
create index if not exists "Papeleta_partidaId_estado_idx" on public."Papeleta" ("partidaId", estado);

create or replace function public.papeleta_imutavel()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    if old.estado <> 'RASCUNHO' then
      raise exception 'Papeleta % já %: não pode ser apagada (RG-FOR-006)', old.id, old.estado
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.estado in ('ENVIADA', 'ACEITA') then
    if new.formacao is distinct from old.formacao
       or new."liberoId" is distinct from old."liberoId"
       or new."capitaoId" is distinct from old."capitaoId"
       or new."partidaId" is distinct from old."partidaId"
       or new."equipeId" is distinct from old."equipeId"
       or new."setNumero" is distinct from old."setNumero"
       or new."conteudoHash" is distinct from old."conteudoHash"
       or new."enviadaEm" is distinct from old."enviadaEm" then
      raise exception 'Papeleta % já %: formação, líbero e capitão são imutáveis (RG-FOR-006)', old.id, old.estado
        using errcode = 'check_violation';
    end if;
    if old.estado = 'ACEITA' and new.estado <> 'ACEITA' then
      raise exception 'Papeleta % aceita não pode mudar de estado', old.id using errcode = 'check_violation';
    end if;
    if old.estado = 'ENVIADA' and new.estado = 'RASCUNHO' then
      raise exception 'Papeleta % enviada não volta a rascunho', old.id using errcode = 'check_violation';
    end if;
  end if;

  new."atualizadoEm" := now();
  return new;
end
$fn$;

drop trigger if exists papeleta_imutavel_trg on public."Papeleta";
create trigger papeleta_imutavel_trg
  before update or delete on public."Papeleta"
  for each row execute function public.papeleta_imutavel();

alter table public."Papeleta" enable row level security;
revoke all on table public."Papeleta" from public, anon, authenticated;
revoke all on function public.papeleta_imutavel() from public, anon, authenticated;
grant select, insert, update, delete on table public."Papeleta" to service_role;

commit;
