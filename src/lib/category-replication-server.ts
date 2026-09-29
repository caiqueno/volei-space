/**
 * Lê categoria, configuração e contagens para o plano de cópia.
 * O `/brain` não descreve cópia de configuração entre categorias (gap).
 * Efeito: várias leituras. `startedScoresheets` e `inProgress` saem fixos em 0 e `false`,
 * então a trava de súmula de `getReplicationBlockReasons` não dispara por aqui.
 * `organizadorId` é o argumento recebido, não um campo relido da categoria.
 */
import { supabaseAdmin as db } from '@/lib/supabase-admin'
import type { CategoryReplicationState } from './category-replication'

/**
 * @param ligaId campeonato
 * @param id categoria de origem ou de destino
 * @param organizadorId repassado ao estado; esta função não o confere na linha da categoria
 * @returns `CategoryReplicationState` para o plano puro
 * Lança se categoria, configuração ou alguma contagem falhar.
 */
export async function readReplicationState(ligaId:number,id:string,organizadorId:string):Promise<CategoryReplicationState>{
 const [{data:category,error:ce},{data:configuration,error:fe},...counts]=await Promise.all([
  db.from('CategoriaCampeonato').select('*').eq('id',id).eq('ligaId',ligaId).is('removidaEm',null).single(),
  db.from('CategoriaConfiguracao').select('*').eq('categoriaCampeonatoId',id).eq('ligaId',ligaId).single(),
  db.from('InscricaoEquipeRascunho').select('id',{count:'exact',head:true}).eq('ligaId',ligaId).eq('categoriaCampeonatoId',id),
  db.from('Equipe').select('id',{count:'exact',head:true}).eq('ligaId',ligaId).eq('categoriaCampeonatoId',id),
  db.from('GrupoEquipeCampeonato').select('equipeId',{count:'exact',head:true}).eq('ligaId',ligaId).eq('categoriaCampeonatoId',id),
  db.from('Partida').select('id',{count:'exact',head:true}).eq('ligaId',ligaId).eq('categoriaCampeonatoId',id),
  db.from('CategoriaSetupSecao').select('secao',{count:'exact',head:true}).eq('ligaId',ligaId).eq('categoriaCampeonatoId',id).neq('status','not-started'),
 ])
 if(ce||fe||counts.some(c=>c.error))throw new Error('Não foi possível consultar o estado das categorias.')
 return {id,ligaId,organizadorId,configuration,configVersion:configuration.versao,operationVersion:category.revisaoOperacional,
 hasSavedConfiguration:category.statusConfiguracao!=='NAO_INICIADA'||configuration.versao>1||(counts[4].count??0)>0,operations:{publishedForms:counts[0].count??0,teams:counts[1].count??0,occupiedGroups:counts[2].count??0,matches:counts[3].count??0,startedScoresheets:0,inProgress:false}}
}
