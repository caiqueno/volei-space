/**
 * Preço das categorias para o organizador da liga.
 * Delega a `getCategoriesPricing`. O cupom vem da query `cupom`.
 * `brain/08 - Financeiro e Premiação/Taxa de Inscrição.md` fala da taxa da equipe;
 * esta rota não mostra essa conta. Preço do organizador é gap no `/brain`.
 */
import { NextRequest } from 'next/server'
import { requireOwnedLigaForSetup } from '@/lib/championship-setup-access'
import { getCategoriesPricing } from '@/lib/category-pricing-server'
import { success,error } from '@/lib/api-response'

/** Exige a liga do organizador. Qualquer falha do cálculo responde 503 com a mesma frase. */
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const ligaId=Number((await params).id),liga=await requireOwnedLigaForSetup(req,ligaId,'id,nome')
 if(liga instanceof Response)return liga
 try{return success(await getCategoriesPricing(ligaId,new URL(req.url).searchParams.get('cupom')))}
 catch{return error('Não foi possível calcular o preço.',503)}
}
