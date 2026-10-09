/**
 * Leitura e seleção das categorias do campeonato para o organizador dono da liga.
 * O acesso passa por `requireOwnedLigaForSetup`; o corpo dessa função está fora deste lote.
 * O `/brain` não documenta categoria persistida por campeonato (gap).
 * O PUT não remove categoria que a RPC diga ter equipe ou inscrição.
 */
import { NextRequest } from 'next/server'
import { supabaseAdmin as db } from '@/lib/supabase-admin'
import { requireOwnedLigaForSetup } from '@/lib/championship-setup-access'
import { success, error } from '@/lib/api-response'
import { categoriaSelecaoSchema } from '@/lib/schemas'

/**
 * Lista categorias do campeonato, com configuração e seções.
 * Query `incluirRemovidas=1` inclui as desmarcadas, para a tela de seleção.
 * Sem o parâmetro, só as ativas. Efeito: leitura.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{id:string}> }) {
 const ligaId=Number((await params).id)
 const liga=await requireOwnedLigaForSetup(req,ligaId,'id,nome')
 if(liga instanceof Response)return liga
 // A tela de seleção de categorias precisa ver também as desmarcadas
 // (reaparecem em "disponíveis", config preservada) — os demais
 // consumidores deste endpoint (navegação entre categorias, etc.) só
 // querem as ativas, então isso é opt-in via query param.
 const incluirRemovidas = new URL(req.url).searchParams.get('incluirRemovidas') === '1'
 // A seleção e a barra de categorias leem só a categoria. O vínculo com
 // configuração e seções é chave composta; o PostgREST de produção recusa
 // esse aninhamento com 400 e a tela mostra falha de carregamento.
 let query = db.from('CategoriaCampeonato').select('id,codigo,nome,slug,ordem,statusConfiguracao,removidaEm').eq('ligaId',ligaId).order('ordem')
 if (!incluirRemovidas) query = query.is('removidaEm', null)
 const {data,error:err}=await query
 if (err) {
   console.error('Falha ao listar categorias', err.message)
   return error('Não foi possível carregar as categorias.',500)
 }
 return success(data)
}

/**
 * Grava a seleção de categorias do campeonato.
 * @param req body validado por `categoriaSelecaoSchema`
 * Efeito: RPC `selecionar_categorias_campeonato` (corpo não auditado neste lote).
 * As mensagens traduzem erros da RPC: nome entre 2 e 40 caracteres, no máximo 20,
 * sem repetição, sem remover categoria com equipe ou inscrição, categoria desconhecida
 * e nome duplicado.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{id:string}> }) {
 const ligaId=Number((await params).id)
 const liga=await requireOwnedLigaForSetup(req,ligaId,'id,nome')
 if(liga instanceof Response)return liga
 const parsed=categoriaSelecaoSchema.safeParse(await req.json().catch(()=>null))
 if(!parsed.success)return error('Selecione as categorias do campeonato.',422)
 const {data,error:err}=await db.rpc('selecionar_categorias_campeonato',{p_liga_id:ligaId,p_categorias:parsed.data.categorias,p_organizador_id:liga.organizadorId})
 if (err) {
   const message = /category name must be between/i.test(err.message) ? 'O nome da categoria deve ter entre 2 e 40 caracteres.'
     : /too many categories/i.test(err.message) ? 'Selecione no máximo 20 categorias.'
     : /distinct categories/i.test(err.message) ? 'Categorias repetidas na seleção.'
     : /already has registration forms or teams/i.test(err.message) ? 'Uma categoria com equipe ou inscrição vinculada não pode ser removida.'
     : /unknown catalog category|category not found/i.test(err.message) ? 'Categoria inválida para este campeonato.'
     : err.code === '23505' ? 'Já existe uma categoria com esse nome neste campeonato.'
     : 'Não foi possível alterar categorias com dados vinculados. Revise a seleção.'
   return error(message, 409)
 }
 return success(data)
}
