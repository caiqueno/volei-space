-- RLS de producao para o fluxo LUV.
-- Rode no SQL Editor do Supabase depois de conferir que SUPABASE_SERVICE_ROLE_KEY
-- esta configurada no Vercel. As escritas passam pelas APIs do app.

begin;

alter table public."Liga" enable row level security;
alter table public."Equipe" enable row level security;
alter table public."InscricaoCampeonato" enable row level security;
alter table public."Jogador" enable row level security;
alter table public."Partida" enable row level security;
alter table public."SetPartida" enable row level security;
alter table public."SumulaPresenca" enable row level security;
alter table public."OcorrenciaPartida" enable row level security;
alter table public."DestaquesPartida" enable row level security;
alter table public."VotoMVP" enable row level security;
alter table public."ClassificacaoEntrada" enable row level security;
alter table public."Premiacao" enable row level security;
alter table public."Midia" enable row level security;
alter table public."Mensagem" enable row level security;
alter table public."Admin" enable row level security;
alter table public."CandidaturaEquipe" enable row level security;
alter table public."CandidaturaArbitro" enable row level security;
alter table public."CandidaturaQuadra" enable row level security;
alter table public."CandidaturaOrganizador" enable row level security;
alter table public."Pagamento" enable row level security;
alter table public."Arbitro" enable row level security;
alter table public."EscalaArbitro" enable row level security;

drop policy if exists "luv_public_select_liga" on public."Liga";
create policy "luv_public_select_liga"
on public."Liga"
for select
to anon, authenticated
using ("status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO'));

drop policy if exists "luv_public_select_equipe" on public."Equipe";
create policy "luv_public_select_equipe"
on public."Equipe"
for select
to anon, authenticated
using (
  exists (
    select 1 from public."Liga" l
    where l.id = "Equipe"."ligaId"
      and l."status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
  )
);

drop policy if exists "luv_public_select_jogador" on public."Jogador";
create policy "luv_public_select_jogador"
on public."Jogador"
for select
to anon, authenticated
using (
  exists (
    select 1
    from public."Equipe" e
    join public."Liga" l on l.id = e."ligaId"
    where e.id = "Jogador"."equipeId"
      and l."status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
  )
);

drop policy if exists "luv_public_select_partida" on public."Partida";
create policy "luv_public_select_partida"
on public."Partida"
for select
to anon, authenticated
using (
  exists (
    select 1 from public."Liga" l
    where l.id = "Partida"."ligaId"
      and l."status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
  )
);

drop policy if exists "luv_public_select_set_partida" on public."SetPartida";
create policy "luv_public_select_set_partida"
on public."SetPartida"
for select
to anon, authenticated
using (
  exists (
    select 1
    from public."Partida" p
    join public."Liga" l on l.id = p."ligaId"
    where p.id = "SetPartida"."partidaId"
      and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
  )
);

drop policy if exists "luv_public_select_classificacao" on public."ClassificacaoEntrada";
create policy "luv_public_select_classificacao"
on public."ClassificacaoEntrada"
for select
to anon, authenticated
using (
  exists (
    select 1
    from public."Equipe" e
    join public."Liga" l on l.id = e."ligaId"
    where e.id = "ClassificacaoEntrada"."equipeId"
      and l."status" in ('EM_BREVE', 'ATIVA', 'ENCERRADA', 'FINALIZADO')
  )
);

drop policy if exists "luv_public_select_premiacao" on public."Premiacao";
create policy "luv_public_select_premiacao"
on public."Premiacao"
for select
to anon, authenticated
using (
  exists (
    select 1 from public."Liga" l
    where l.id = "Premiacao"."ligaId"
      and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
  )
);

drop policy if exists "luv_public_select_midia" on public."Midia";
create policy "luv_public_select_midia"
on public."Midia"
for select
to anon, authenticated
using (
  exists (
    select 1 from public."Liga" l
    where l.id = "Midia"."ligaId"
      and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
  )
);

drop policy if exists "luv_public_select_mensagem_aprovada" on public."Mensagem";
create policy "luv_public_select_mensagem_aprovada"
on public."Mensagem"
for select
to anon, authenticated
using (
  aprovada = true
  and exists (
    select 1 from public."Liga" l
    where l.id = "Mensagem"."ligaId"
      and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
  )
);

drop policy if exists "luv_public_select_destaques" on public."DestaquesPartida";
create policy "luv_public_select_destaques"
on public."DestaquesPartida"
for select
to anon, authenticated
using (
  exists (
    select 1
    from public."Partida" p
    join public."Liga" l on l.id = p."ligaId"
    where p.id = "DestaquesPartida"."partidaId"
      and p.status = 'ENCERRADA'
      and l."status" in ('ATIVA', 'ENCERRADA', 'FINALIZADO')
  )
);

create unique index if not exists "Liga_slug_key" on public."Liga" ("slug");
create unique index if not exists "InscricaoCampeonato_ligaId_equipeId_key"
  on public."InscricaoCampeonato" ("ligaId", "equipeId");

commit;
