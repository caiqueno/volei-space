import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { midiaSchema } from '@/lib/schemas'
import { exigirOrganizadorDaLiga } from '@/lib/organizador-isolamento'

export const dynamic = 'force-dynamic'

function caminhoDaFoto(url: string, ligaId: number) {
  const marcador = `/galeria-campeonato/ligas/${ligaId}/`
  const indice = url.indexOf(marcador)
  if (indice < 0) return null
  return decodeURIComponent(url.slice(indice + '/galeria-campeonato/'.length).split('?')[0])
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const ligaId = Number(searchParams.get('ligaId'))
    if (!Number.isInteger(ligaId) || ligaId <= 0) return error('Escolha um campeonato.', 422)
    const limite = Math.min(24, Math.max(1, Number(searchParams.get('limite') ?? 12) || 12))
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0) || 0)

    const { data, error: err } = await supabaseAdmin
      .from('Midia')
      .select('id,ligaId,tipo,url,thumbUrl,titulo,tag,criadoEm')
      .eq('ligaId', ligaId)
      .order('criadoEm', { ascending: false })
      .range(offset, offset + limite)
    if (err) throw err
    const linhas = data ?? []
    return success({ midias: linhas.slice(0, limite), temMais: linhas.length > limite })
  } catch {
    return error('Erro ao buscar galeria', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = midiaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    const acesso = await exigirOrganizadorDaLiga(req, parsed.data.ligaId)
    if (acesso instanceof Response) return acesso
    if (!caminhoDaFoto(parsed.data.url, parsed.data.ligaId)) return error('A foto precisa ser enviada para a galeria deste campeonato.', 422)
    if (parsed.data.thumbUrl && !caminhoDaFoto(parsed.data.thumbUrl, parsed.data.ligaId)) return error('A miniatura não pertence a este campeonato.', 422)

    const { data, error: err } = await supabaseAdmin.from('Midia').insert(parsed.data).select('id,ligaId,tipo,url,thumbUrl,titulo,tag,criadoEm').single()
    if (err) throw err
    return success(data, 201)
  } catch {
    return error('Erro ao adicionar mídia', 500)
  }
}
