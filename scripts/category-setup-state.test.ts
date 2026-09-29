import { migration, sql } from './category-test-database'
if (process.argv.includes('--refresh')) migration('202609230001_category_setup.sql')
sql(`begin;
insert into "Liga"(id,slug,nome,"organizadorId","atualizadoEm") values(96001,'setup-state-test','Setup test','setup-owner',now());
select selecionar_categorias_campeonato(96001,'[{"codigo":"FEMININO"}]'::jsonb,'setup-owner');
do $$ declare cid uuid; v integer; section text; begin
 select id into cid from "CategoriaCampeonato" where "ligaId"=96001;
 perform salvar_configuracao_categoria(96001,cid,'setup-owner',1,'estrutura','{"formato":"PONTOS_CORRIDOS","quantidadeEquipes":4}',true);
 select versao into v from "CategoriaConfiguracao" where "categoriaCampeonatoId"=cid;
 perform salvar_configuracao_categoria(96001,cid,'setup-owner',v,'calendario','{"dataInicio":"2026-10-01","dataFim":"2026-10-31"}',true);
 select versao into v from "CategoriaConfiguracao" where "categoriaCampeonatoId"=cid;
 foreach section in array array['classificacao','eliminatorias','inscricoes'] loop perform salvar_configuracao_categoria(96001,cid,'setup-owner',v,section,'{}',true); end loop;
 if (select "statusConfiguracao" from "CategoriaCampeonato" where id=cid)<>'CONCLUIDA' then raise exception 'Five completed sections failed'; end if;
 perform salvar_configuracao_categoria(96001,cid,'setup-owner',v,'estrutura','{"quantidadeEquipes":6}',true);
 select versao into v from "CategoriaConfiguracao" where "categoriaCampeonatoId"=cid;
 if (select "statusConfiguracao" from "CategoriaCampeonato" where id=cid)<>'ATENCAO_NECESSARIA' or (select count(*) from "CategoriaSetupSecao" where "categoriaCampeonatoId"=cid and status='attention-required')<>4 then raise exception 'Dependencies not invalidated'; end if;
 foreach section in array array['classificacao','eliminatorias','calendario','inscricoes'] loop perform salvar_configuracao_categoria(96001,cid,'setup-owner',v,section,'{}',true); end loop;
 if (select versao from "CategoriaConfiguracao" where "categoriaCampeonatoId"=cid)<>v then raise exception 'No-op changed version'; end if;
 if (select "statusConfiguracao" from "CategoriaCampeonato" where id=cid)<>'CONCLUIDA' then raise exception 'Reconfirmation failed'; end if;
end $$;
rollback;`)
console.log('Setup state integration passed: dependency invalidation, no-op version stability and explicit reconfirmation.')
