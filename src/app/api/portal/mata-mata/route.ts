import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { campeonatoDeTeste } from '@/lib/campeonato-teste'
import { categoriaDaUrl } from '@/lib/isolamento-categoria'
import { carregarChavePublica } from '@/lib/portal-chave'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams
  const ligaId = Number(params.get('ligaId'))
  if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Informe o campeonato.', 422)
  const categoria = categoriaDaUrl(params)
  if ('erro' in categoria) return error(categoria.erro, 422)

  const { data: liga, error: falha } = await supabaseAdmin
    .from('Liga')
    .select('id,nome,slug,descricao,simulacao')
    .eq('id', ligaId)
    .maybeSingle()
  if (falha) return error('Não foi possível carregar o mata-mata.', 500)
  if (!liga || campeonatoDeTeste(liga)) return error('Campeonato não encontrado.', 404)

  const chave = await carregarChavePublica(ligaId, categoria.id)
  const resposta = success(chave)
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}
