import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ligaId = Number(new URL(req.url).searchParams.get('ligaId'))
  if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Informe o campeonato.', 422)

  const { data, error: falha } = await supabaseAdmin
    .from('Midia')
    .select('id,tipo,url,thumbUrl,titulo')
    .eq('ligaId', ligaId)
    .order('criadoEm', { ascending: false })
    .limit(24)

  if (falha) return error('Não foi possível carregar a galeria.', 500)
  const resposta = success({ midias: data ?? [] })
  resposta.headers.set('Cache-Control', 'no-store')
  return resposta
}
