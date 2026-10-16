-- ============================================================================================
-- EXPERIMENTAL. NÃO É MIGRATION. NÃO APLICAR EM PRODUÇÃO. NÃO ENTRA NA SEQUÊNCIA 2026101700NN.
-- ============================================================================================
-- registrar_inscricao_meu_time(p_payload jsonb)   (Rodada 3, rascunho)
--
-- OBJETIVO
--   Criar "Inscricao" + "InscricaoAtleta" + "InscricaoComissao" numa só transação (a função inteira
--   é atômica: qualquer erro desfaz tudo). Hoje o backend grava em três passos e compensa na falha.
--
-- O QUE A FUNÇÃO NÃO FAZ
--   Não revalida regras de negócio (idade, naipe, mínimo de atletas, prazo, limites de comissão):
--   isso continua no servidor, que já montou o payload validado e calculou "status" e "avisos".
--   O banco garante apenas o que seus índices garantem: número único, 1 capitão, atleta em um só
--   time por categoria (23505), FKs. Violações sobem como exceção; o backend as converte em
--   409 CONFLITO_DE_ELENCO / JA_INSCRITA.
--
-- CONTRATO DO PAYLOAD (jsonb)
--   {
--     "ligaId": int, "categoriaCampeonatoId": uuid, "timeId": uuid,
--     "status": "CONFIRMADA" | "CONFIRMADA_COM_PENDENCIAS",
--     "avisos": [ ... ],                       -- opcional, array
--     "criadoPor": text,                       -- opcional
--     "aceiteRegulamentoEm": timestamptz, "aceiteRegulamentoVersao": text,   -- opcionais, juntos
--     "inscricaoCampeonatoLegadoId": text,     -- opcional
--     "atletas": [ { "atletaId": uuid, "nome": text, "dataNascimento": date|null, "numero": 0..99,
--                    "posicao": text|null, "capitao": bool, "libero": bool, "documentosOk": bool } ],
--     "comissao": [ { "comissaoTimeId": uuid|null, "nome": text, "funcao": text,
--                     "noBanco": bool, "documentoRef": text|null } ]
--   }
--   Retorno: jsonb { "inscricaoId": uuid, "atletas": int, "comissao": int }.
--
-- SEGURANÇA
--   security invoker + search_path fixo; EXECUTE só para service_role (revoke de public/anon/authenticated).
--   Não loga nem devolve dados pessoais (só ids e contagens).
--
-- PRÉ-REQUISITOS: 202610170024 a 202610170028 aplicadas.
-- Nunca executado em banco algum (a verificar em preview).
-- ============================================================================================

create or replace function public.registrar_inscricao_meu_time(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inscricao_id uuid;
  v_status       text;
  v_qtd_atletas  integer := 0;
  v_qtd_comissao integer := 0;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload deve ser um objeto' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload -> 'atletas') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'atletas') = 0 then
    raise exception 'atletas obrigatorio (array nao vazio)' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_payload -> 'comissao', '[]'::jsonb)) <> 'array' then
    raise exception 'comissao deve ser array' using errcode = '22023';
  end if;

  v_status := coalesce(p_payload ->> 'status', 'CONFIRMADA');
  if v_status not in ('CONFIRMADA', 'CONFIRMADA_COM_PENDENCIAS') then
    raise exception 'status invalido para criacao: %', v_status using errcode = '22023';
  end if;

  insert into public."Inscricao" (
    "ligaId", "categoriaCampeonatoId", "timeId", status, avisos,
    "enviadaEm", "aceiteRegulamentoEm", "aceiteRegulamentoVersao",
    "inscricaoCampeonatoLegadoId", "criadoPor"
  ) values (
    (p_payload ->> 'ligaId')::integer,
    (p_payload ->> 'categoriaCampeonatoId')::uuid,
    (p_payload ->> 'timeId')::uuid,
    v_status,
    coalesce(p_payload -> 'avisos', '[]'::jsonb),
    now(),
    (p_payload ->> 'aceiteRegulamentoEm')::timestamptz,
    p_payload ->> 'aceiteRegulamentoVersao',
    p_payload ->> 'inscricaoCampeonatoLegadoId',
    p_payload ->> 'criadoPor'
  )
  returning id into v_inscricao_id;

  -- "inscricaoAtiva" é preenchida pelo trigger BEFORE INSERT (herda o estado da inscrição).
  insert into public."InscricaoAtleta" (
    "inscricaoId", "ligaId", "categoriaCampeonatoId", "atletaId",
    "nomeSnapshot", "dataNascimentoSnapshot", numero, posicao, capitao, libero, "documentosOk"
  )
  select
    v_inscricao_id,
    (p_payload ->> 'ligaId')::integer,
    (p_payload ->> 'categoriaCampeonatoId')::uuid,
    (a ->> 'atletaId')::uuid,
    a ->> 'nome',
    nullif(a ->> 'dataNascimento', '')::date,
    nullif(a ->> 'numero', '')::smallint,
    nullif(a ->> 'posicao', ''),
    coalesce((a ->> 'capitao')::boolean, false),
    coalesce((a ->> 'libero')::boolean, false),
    coalesce((a ->> 'documentosOk')::boolean, false)
  from jsonb_array_elements(p_payload -> 'atletas') as a;
  get diagnostics v_qtd_atletas = row_count;

  insert into public."InscricaoComissao" (
    "inscricaoId", "comissaoTimeId", "nomeSnapshot", funcao, "noBanco", "documentoRef"
  )
  select
    v_inscricao_id,
    nullif(c ->> 'comissaoTimeId', '')::uuid,
    c ->> 'nome',
    c ->> 'funcao',
    coalesce((c ->> 'noBanco')::boolean, true),
    nullif(c ->> 'documentoRef', '')
  from jsonb_array_elements(coalesce(p_payload -> 'comissao', '[]'::jsonb)) as c;
  get diagnostics v_qtd_comissao = row_count;

  return jsonb_build_object(
    'inscricaoId', v_inscricao_id,
    'atletas', v_qtd_atletas,
    'comissao', v_qtd_comissao
  );
end;
$$;

revoke all on function public.registrar_inscricao_meu_time(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_inscricao_meu_time(jsonb) to service_role;

-- REVERSÃO: drop function if exists public.registrar_inscricao_meu_time(jsonb);
