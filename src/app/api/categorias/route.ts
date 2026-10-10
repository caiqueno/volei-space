/**
 * Lista, por `ligaId`, as categorias não removidas.
 * Sem sessão neste arquivo. O `/brain` não documenta esta lista (gap).
 * Não é o seletor de cinco cards de `brain/04 - Plataforma e AppWeb/Seletor de Categoria.md`.
 */
import { NextRequest } from 'next/server'
import { supabaseAdmin as db } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { categoriaDaUrl } from '@/lib/isolamento-categoria'

/**
 * @param req query `ligaId`, inteiro positivo
 * @returns `id`, `nome`, `codigo` e `ordem` das categorias com `removidaEm` nulo
 * Efeito: leitura. Não filtra organizador.
 */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const ligaId = Number(params.get('ligaId'))
  if (!Number.isSafeInteger(ligaId) || ligaId <= 0) return error('Selecione o campeonato.', 422)
  const categoria = categoriaDaUrl(params)
  if ('erro' in categoria) return error(categoria.erro, 422)
  const result = await db.from('CategoriaCampeonato').select('id,nome,codigo,ordem').eq('ligaId', ligaId).is('removidaEm', null).order('ordem')
  return result.error ? error('Não foi possível consultar as categorias.', 503) : success(result.data)
}
