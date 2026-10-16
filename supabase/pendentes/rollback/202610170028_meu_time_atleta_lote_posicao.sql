-- Reversão de 202610170028. Recusa-se a rodar se existir atleta de origem LOTE (resolver os dados antes).
-- As colunas "posicao" e "numeroPreferido" são apagadas: DESTRUTIVO para esses dados.
begin;
set local lock_timeout = '5s';
do $r$
begin
  if exists (select 1 from public."Atleta" where origem = 'LOTE') then
    raise exception 'existem atletas de origem LOTE; migre-os antes de reverter' using errcode = '23514';
  end if;
end
$r$;
alter table public."Atleta" drop constraint if exists "Atleta_nascimento_obrigatorio_chk";
alter table public."Atleta"
  add constraint "Atleta_nascimento_obrigatorio_chk" check (origem = 'MIGRACAO' or "dataNascimento" is not null);
alter table public."Atleta" drop constraint if exists "Atleta_origem_check";
alter table public."Atleta"
  add constraint "Atleta_origem_check" check (origem in ('APP', 'CONVITE', 'MIGRACAO'));
alter table public."Atleta" drop constraint if exists "Atleta_numeroPreferido_chk";
alter table public."Atleta" drop column if exists "numeroPreferido";
alter table public."Atleta" drop column if exists posicao;
commit;
