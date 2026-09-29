-- Run after the existing baseline, in a transaction. Never applies itself.
begin;
create or replace function public.validar_config_formulario_categoria(value jsonb) returns boolean language plpgsql immutable set search_path=public as $$
declare section record; field record; allowed text[]; begin
 if value is null or jsonb_typeof(value)<>'object' then return false; end if;
 for section in select * from jsonb_each(value) loop
  if section.key not in ('equipe','lider','atleta') or jsonb_typeof(section.value)<>'object' then return false; end if;
  allowed:=case section.key when 'equipe' then array['nome','nomeAbreviado','logo','cidade','instagram'] when 'lider' then array['nomeCompleto','cpf','dataNascimento','whatsapp','email','documento','foto'] else array['nomeCompleto','cpf','rg','dataNascimento','foto','numeroCamisa','posicao','altura','instagram','documento'] end;
  for field in select * from jsonb_each(section.value) loop
   if not(field.key=any(allowed)) or field.value not in ('"required"'::jsonb,'"optional"'::jsonb,'"disabled"'::jsonb) then return false; end if;
  end loop;
 end loop;
 return true;
end $$;
create table public."CategoriaCampeonato" (
 id uuid primary key default gen_random_uuid(), "ligaId" integer not null references "Liga"(id),
 codigo text not null check (codigo in ('FEMININO','FEMININO_MASTER','MASCULINO','MASCULINO_MASTER','MISTO')),
 nome text not null, slug text not null, ordem integer not null default 0 check(ordem >= 0),
 "statusConfiguracao" text not null default 'NAO_INICIADA' check("statusConfiguracao" in ('NAO_INICIADA','EM_ANDAMENTO','COPIADA_REVISAR','CONCLUIDA','ATENCAO_NECESSARIA')),
 versao integer not null default 1, "revisaoOperacional" integer not null default 0,
 "criadoEm" timestamptz not null default now(), "atualizadoEm" timestamptz not null default now(),
 unique(id,"ligaId"), unique("ligaId",codigo), unique("ligaId",slug)
);
create table public."CategoriaConfiguracao" (
 "categoriaCampeonatoId" uuid primary key, "ligaId" integer not null, versao integer not null default 1,
 "quantidadeEquipes" integer, "quantidadeEquipesMinima" integer, "quantidadeEquipesMaxima" integer,
 formato text, "quantidadeGrupos" integer, "turnoReturno" boolean not null default false,
 "setsFormato" text not null default 'MELHOR_DE', "setsPorPartida" integer not null default 3,
 "pontosPorSet" integer not null default 25, "tieBreakUltimoSet" boolean not null default true,
 "pontosUltimoSet" integer not null default 15, "terceiroSetObrigatorio" boolean not null default false,
 "diferencaMinimaSet" integer not null default 2 check("diferencaMinimaSet" = 2),
 "criteriosClassificacao" text not null default '["PONTOS","VITORIAS","SALDO_SETS","SALDO_PONTOS"]',
 "pontuacaoResultado" jsonb, "pontosVencedorMargem1" integer not null default 2,
 "pontosPerdedorMargem1" integer not null default 1, "pontosVencedorMargem2" integer not null default 3,
 "pontosPerdedorMargem2" integer not null default 0,
 "classificadosPorGrupo" integer not null default 0, "melhoresClassificadosGerais" integer not null default 0,
 "nomesGrupos" text, "faseEliminatoria" text not null default 'NENHUMA',
 "metodoChaveamento" text not null default 'MANUAL', "eliminatoriaIdaVolta" boolean not null default false,
 "disputaTerceiroLugar" boolean not null default true, "goldenSet" boolean not null default false,
 "dataInicio" timestamptz, "dataFim" timestamptz, "inscricoesAbertas" boolean not null default true,
 "inscricoesAberturaEm" timestamptz, "inscricoesEncerramentoEm" timestamptz,
 "inscricaoPermiteEdicaoAposEnvio" boolean not null default true, "inscricaoPrazoEdicaoDias" integer,
 "elencoQuantidadeMinima" integer, "elencoQuantidadeMaxima" integer,
 "elencoCadastroDuranteInscricao" boolean not null default true, "prazoAlteracaoElencoDias" integer,
 "formularioInscricaoConfig" jsonb not null default '{}',
 "qrCodeEnabled" boolean not null default false, "sumulaScoutsEnabled" boolean not null default false,
 "criadoEm" timestamptz not null default now(), "atualizadoEm" timestamptz not null default now(),
 unique("categoriaCampeonatoId","ligaId"),
 foreign key("categoriaCampeonatoId","ligaId") references "CategoriaCampeonato"(id,"ligaId"),
 check(formato is null or formato in ('PONTOS_CORRIDOS','GRUPOS_MATA_MATA','MATA_MATA')),
 check("setsFormato" in ('MELHOR_DE','QUANTIDADE_FIXA')),
 check("setsPorPartida" between 1 and 5 and "pontosPorSet">0 and "pontosUltimoSet">0),
 check(not "terceiroSetObrigatorio" or "setsPorPartida"=3),
 check("quantidadeEquipesMinima" is null or "quantidadeEquipesMaxima" is null or "quantidadeEquipesMinima" <= "quantidadeEquipesMaxima"),
 check("elencoQuantidadeMinima" is null or "elencoQuantidadeMaxima" is null or "elencoQuantidadeMinima" <= "elencoQuantidadeMaxima"),
 check("dataInicio" is null or "dataFim" is null or "dataInicio" <= "dataFim"),
 check("inscricoesAberturaEm" is null or "inscricoesEncerramentoEm" is null or "inscricoesAberturaEm" <= "inscricoesEncerramentoEm"),
 check(public.validar_config_formulario_categoria("formularioInscricaoConfig")),
 check("quantidadeEquipes" is null or "quantidadeEquipes">0),
 check("quantidadeEquipesMinima" is null or "quantidadeEquipesMinima">0),
 check("quantidadeEquipesMaxima" is null or "quantidadeEquipesMaxima">0),
 check("quantidadeGrupos" is null or "quantidadeGrupos">0),
 check("classificadosPorGrupo">=0 and "melhoresClassificadosGerais">=0),
 check("faseEliminatoria" in ('NENHUMA','FINAL','SEMIFINAL','QUARTAS','OITAVAS','DEZESSEIS_AVOS')),
 check("metodoChaveamento" in ('RANKING_GERAL','CRUZAMENTO_GRUPOS','SORTEIO','MANUAL')),
 check(jsonb_typeof("criteriosClassificacao"::jsonb)='array' and "criteriosClassificacao"::jsonb <@ '["PONTOS","VITORIAS","DERROTAS","SALDO_SETS","SALDO_PONTOS","SETS_PRO","PONTOS_PRO"]'::jsonb),
 check("nomesGrupos" is null or jsonb_typeof("nomesGrupos"::jsonb)='array'),
 check("pontosVencedorMargem1">=0 and "pontosPerdedorMargem1">=0 and "pontosVencedorMargem2">=0 and "pontosPerdedorMargem2">=0)
);
create table public."CategoriaSetupSecao" (
 "categoriaCampeonatoId" uuid not null, "ligaId" integer not null, secao text not null,
 status text not null default 'not-started', "revisaoConfirmada" integer,
 "atualizadoEm" timestamptz not null default now(), "concluidoEm" timestamptz,
 primary key("categoriaCampeonatoId",secao),
 foreign key("categoriaCampeonatoId","ligaId") references "CategoriaCampeonato"(id,"ligaId"),
 check(secao in ('estrutura','partidas','classificacao','grupos','eliminatorias','calendario','inscricoes','recursos')),
 check(status in ('not-started','in-progress','copied-review','completed','attention-required'))
);
create table public."CategoriaReplicacaoAuditoria" (
 id uuid primary key default gen_random_uuid(), "operacaoId" uuid not null,
 "ligaId" integer not null, "origemCategoriaId" uuid not null, "destinoCategoriaId" uuid not null,
 secoes jsonb not null check(jsonb_typeof(secoes)='array'), "usuarioId" text not null,
 "versaoAnterior" integer not null, "versaoResultante" integer not null, "criadoEm" timestamptz not null default now(),
 foreign key("origemCategoriaId","ligaId") references "CategoriaCampeonato"(id,"ligaId"),
 foreign key("destinoCategoriaId","ligaId") references "CategoriaCampeonato"(id,"ligaId"),
 check("origemCategoriaId"<>"destinoCategoriaId")
);
-- New registrations have no sporting series. Old values remain historical.
do $$ declare t text; begin
 foreach t in array array['Equipe','InscricaoEquipeRascunho','InscricaoCampeonato','GrupoCampeonato','GrupoEquipeCampeonato','Partida','ClassificacaoEntrada','ClassificacaoEliminatoria','Premiacao','VotoMVP','CandidaturaEquipe'] loop
  execute format('alter table %I add column "categoriaCampeonatoId" uuid',t);
  if t='VotoMVP' then execute 'alter table "VotoMVP" add column "ligaId" integer'; end if;
  execute format('alter table %I add constraint %I foreign key ("categoriaCampeonatoId","ligaId") references "CategoriaCampeonato"(id,"ligaId")',t,t||'_categoria_liga_fk');
  execute format('create index %I on %I ("ligaId","categoriaCampeonatoId")',t||'_categoria_idx',t);
 end loop;
 foreach t in array array['Equipe','InscricaoEquipeRascunho','Partida','ClassificacaoEntrada','Premiacao','VotoMVP','CandidaturaEquipe'] loop
  execute format('alter table %I alter column serie drop not null, alter column serie drop default',t);
 end loop;
end $$;
alter table "InscricaoEquipeRascunho" alter column "nomeEquipe" drop not null;
-- Restrict private configuration, progress and audit to the trusted server.
do $$ declare t text; begin
 foreach t in array array['CategoriaCampeonato','CategoriaConfiguracao','CategoriaSetupSecao','CategoriaReplicacaoAuditoria'] loop
  execute format('alter table %I enable row level security',t);
  execute format('revoke all on %I from anon, authenticated',t);
  execute format('grant all on %I to service_role',t);
 end loop;
end $$;
grant select on "CategoriaCampeonato" to anon, authenticated;
create policy categoria_publica on "CategoriaCampeonato" for select using(true);
commit;
