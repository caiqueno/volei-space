-- Categoria personalizada, além do catálogo fixo de 5 (FEMININO,
-- FEMININO_MASTER, MASCULINO, MASCULINO_MASTER, MISTO).
--
-- 1) A CHECK CONSTRAINT que restringia "codigo" a esses 5 valores fixos é
--    trocada por uma regra de formato (não vazio, tamanho razoável) — sem
--    mais restringir a um enum fechado.
-- 2) Nova coluna "removidaEm": desmarcar uma categoria sem dado
--    operacional vinculado passa a só marcar essa coluna (soft-remove),
--    nunca apagar a linha — preserva CategoriaConfiguracao/CategoriaSetupSecao
--    intactas pra reaparecer em "disponíveis" e ser reselecionada depois
--    com a configuração de onde parou.
-- 3) Índice único PARCIAL (só entre ativas) numa expressão normalizada de
--    nome (lower+trim) — permite reaproveitar um nome depois que a
--    categoria antiga com esse nome foi desmarcada, mas nunca duas
--    categorias ATIVAS com o mesmo nome normalizado ao mesmo tempo.
-- 4) selecionar_categorias_campeonato ganha nova assinatura: em vez de
--    array de códigos, recebe um array jsonb onde cada item é
--    {"codigo":"FEMININO"} (catálogo), {"id":"<uuid>"} (categoria já
--    existente sendo mantida — identidade preservada, nunca recriada a
--    partir do nome) ou {"nome":"..."} (personalizada nova — só aqui o
--    servidor gera id/codigo, uma única vez).

alter table "CategoriaCampeonato" drop constraint if exists "CategoriaCampeonato_codigo_check";
alter table "CategoriaCampeonato" add constraint "categoria_campeonato_codigo_formato"
  check (char_length(codigo) between 1 and 40);

alter table "CategoriaCampeonato" add column if not exists "removidaEm" timestamptz;

create unique index if not exists "categoria_campeonato_nome_normalizado_unique"
  on "CategoriaCampeonato" ("ligaId", lower(btrim(nome)))
  where "removidaEm" is null;

create or replace function public.selecionar_categorias_campeonato(
  p_liga_id integer, p_categorias jsonb, p_organizador_id text
) returns setof "CategoriaCampeonato" language plpgsql security definer set search_path=public as $$
declare
  catalog_names jsonb := '{"FEMININO":"Feminino","FEMININO_MASTER":"Feminino Master","MASCULINO":"Masculino","MASCULINO_MASTER":"Masculino Master","MISTO":"Misto"}'::jsonb;
  item jsonb;
  ord integer;
  entry_id uuid;
  entry_codigo text;
  entry_nome text;
  slug_base text;
  slug_candidate text;
  suffix integer;
  kept_ids uuid[] := array[]::uuid[];
  c record;
begin
  perform 1 from "Liga" where id=p_liga_id and "organizadorId"=p_organizador_id for update;
  if not found then raise exception 'Championship not found or unauthorized'; end if;

  if p_categorias is null or jsonb_typeof(p_categorias) <> 'array' or jsonb_array_length(p_categorias) = 0 then
    raise exception 'Select at least one category' using errcode = '23514';
  end if;
  if jsonb_array_length(p_categorias) > 20 then
    raise exception 'Too many categories selected (max 20)' using errcode = '23514';
  end if;

  -- Primeira passada: resolve cada item pra um id concreto (existente,
  -- catálogo reativado, ou personalizada recém-criada) e já grava
  -- removidaEm=null + a ordem de exibição enviada.
  ord := 0;
  for item in select value from jsonb_array_elements(p_categorias) as value
  loop
    entry_id := nullif(item->>'id','')::uuid;
    entry_codigo := nullif(item->>'codigo','');
    entry_nome := nullif(btrim(item->>'nome'),'');

    if entry_id is not null then
      perform 1 from "CategoriaCampeonato" where id=entry_id and "ligaId"=p_liga_id for update;
      if not found then raise exception 'Category not found in this championship' using errcode = '23514'; end if;
      update "CategoriaCampeonato" set "removidaEm"=null, ordem=ord, "atualizadoEm"=now() where id=entry_id;
    elsif entry_codigo is not null then
      if not (catalog_names ? entry_codigo) then raise exception 'Unknown catalog category' using errcode = '23514'; end if;
      insert into "CategoriaCampeonato"("ligaId",codigo,nome,slug,ordem)
        values(p_liga_id, entry_codigo, catalog_names->>entry_codigo, lower(replace(entry_codigo,'_','-')), ord)
        on conflict("ligaId",codigo) do update set "removidaEm"=null, ordem=excluded.ordem, "atualizadoEm"=now()
        returning id into entry_id;
    elsif entry_nome is not null then
      if char_length(entry_nome) < 2 or char_length(entry_nome) > 40 then
        raise exception 'Category name must be between 2 and 40 characters' using errcode = '23514';
      end if;
      slug_base := trim(both '-' from regexp_replace(lower(entry_nome), '[^a-z0-9]+', '-', 'g'));
      if slug_base = '' then slug_base := 'categoria'; end if;
      slug_candidate := slug_base;
      suffix := 1;
      while exists(select 1 from "CategoriaCampeonato" where "ligaId"=p_liga_id and codigo=upper(slug_candidate)) loop
        suffix := suffix + 1;
        slug_candidate := slug_base || '-' || suffix;
      end loop;
      insert into "CategoriaCampeonato"("ligaId",codigo,nome,slug,ordem)
        values(p_liga_id, upper(slug_candidate), entry_nome, slug_candidate, ord)
        returning id into entry_id;
    else
      raise exception 'Each category must have id, codigo or nome' using errcode = '23514';
    end if;

    kept_ids := array_append(kept_ids, entry_id);
    ord := ord + 1;
  end loop;

  if cardinality(kept_ids) <> (select count(distinct x) from unnest(kept_ids) x) then
    raise exception 'Select distinct categories' using errcode = '23514';
  end if;

  -- Segunda passada: o que saiu da seleção. Bloqueia se tiver dado
  -- operacional (regra já existente, preservada); senão, soft-remove —
  -- nunca apaga a linha, preserva configuração pra reaparecer depois.
  for c in select * from "CategoriaCampeonato"
    where "ligaId"=p_liga_id and "removidaEm" is null and not (id = any(kept_ids)) for update
  loop
    if exists(select 1 from "InscricaoEquipeRascunho" where "categoriaCampeonatoId"=c.id)
      or exists(select 1 from "Equipe" where "categoriaCampeonatoId"=c.id) then
      raise exception 'Category already has registration forms or teams' using errcode = '23514';
    end if;
    update "CategoriaCampeonato" set "removidaEm"=now() where id=c.id;
  end loop;

  insert into "CategoriaConfiguracao"("categoriaCampeonatoId","ligaId")
    select id,"ligaId" from "CategoriaCampeonato" where id = any(kept_ids) on conflict do nothing;

  return query select * from "CategoriaCampeonato" where "ligaId"=p_liga_id and "removidaEm" is null order by ordem;
end $$;
revoke all on function public.selecionar_categorias_campeonato(integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.selecionar_categorias_campeonato(integer,jsonb,text) to service_role;

-- Assinatura antiga (text[]) não existe mais — dropar explicitamente pra
-- não deixar as duas sobrecargas coexistindo e confundindo o PostgREST.
drop function if exists public.selecionar_categorias_campeonato(integer,text[],text);

-- PostgREST mantém cache do schema; sem isso, ele continua resolvendo a
-- assinatura antiga (ou nenhuma) até reiniciar, mesmo com a função já
-- trocada no banco — confirmado localmente (RPC via SQL direto funciona,
-- via PostgREST retorna PGRST202 até este notify rodar).
notify pgrst, 'reload schema';
