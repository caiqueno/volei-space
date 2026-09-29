/**
 * Lê `CategoriaConfiguracao` do campeonato e delega o cálculo a `calculateCategoriesPrice`.
 * A fórmula desse módulo não foi auditada neste lote.
 * `brain/08 - Financeiro e Premiação/Taxa de Inscrição.md` fala da taxa da equipe;
 * este arquivo não mostra essa conta. Preço do organizador é gap no `/brain`.
 */
import { supabaseAdmin as db } from '@/lib/supabase-admin'
import { calculateCategoriesPrice } from '@/lib/pricing/calculateCategoriesPrice'

/**
 * @param ligaId campeonato cujas configurações entram no cálculo
 * @param coupon cupom opcional, repassado sem interpretação aqui
 * @returns o valor devolvido por `calculateCategoriesPrice`
 * Efeito: leitura de todas as configurações do `ligaId`. Não filtra organizador nem categoria removida.
 */
export async function getCategoriesPricing(ligaId:number,coupon?:string|null){
 const {data:ativas,error:listaErr}=await db.from('CategoriaCampeonato').select('id').eq('ligaId',ligaId).is('removidaEm',null)
 if(listaErr)throw new Error('Não foi possível calcular o preço das categorias.')
 const ids=new Set((ativas??[]).map(row=>row.id))
 const {data,error}=await db.from('CategoriaConfiguracao').select('*').eq('ligaId',ligaId).order('categoriaCampeonatoId')
 if(error)throw new Error('Não foi possível calcular o preço das categorias.')
 return calculateCategoriesPrice((data??[]).filter(config=>ids.has(config.categoriaCampeonatoId)).map(config=>({categoriaCampeonatoId:config.categoriaCampeonatoId,config})),coupon)
}

export async function categoriesCheckoutGate(ligaId:number){
 const {data,error}=await db.from('CategoriaCampeonato').select('nome,statusConfiguracao').eq('ligaId',ligaId).is('removidaEm',null).order('ordem')
 if(error)return {ok:false as const,message:'Não foi possível verificar as categorias.'}
 if(!data?.length)return {ok:false as const,message:'Selecione as categorias do campeonato antes de pagar.'}
 const pendentes=data.filter(row=>row.statusConfiguracao!=='CONCLUIDA')
 if(pendentes.length)return {ok:false as const,message:`Conclua a parametrização de: ${pendentes.map(row=>row.nome).join(', ')}.`}
 return {ok:true as const,message:''}
}
