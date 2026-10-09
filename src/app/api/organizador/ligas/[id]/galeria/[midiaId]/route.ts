import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { exigirOrganizadorDaLiga } from '@/lib/organizador-isolamento'

function caminhoDaFoto(url: string | null | undefined, ligaId: number) {
  if (!url) return null
  const marcador = `/galeria-campeonato/ligas/${ligaId}/`
  const indice = url.indexOf(marcador)
  if (indice < 0) return null
  return decodeURIComponent(url.slice(indice + '/galeria-campeonato/'.length).split('?')[0])
}

async function lerMidia(ligaId: number, midiaId: number) {
  const { data, error: falha } = await supabaseAdmin
    .from('Midia')
    .select('id,ligaId,url,thumbUrl')
    .eq('id', midiaId)
    .eq('ligaId', ligaId)
    .maybeSingle()
  if (falha || !data) return null
  return data
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; midiaId: string }> }) {
  const { id, midiaId: midiaParam } = await params
  const ligaId = Number(id)
  const midiaId = Number(midiaParam)
  const acesso = await exigirOrganizadorDaLiga(req, ligaId)
  if (acesso instanceof Response) return acesso
  const midia = await lerMidia(ligaId, midiaId)
  if (!midia) return error('Foto não encontrada neste campeonato.', 404)

  const { error: falha } = await supabaseAdmin.from('Liga').update({ capaUrl: midia.url }).eq('id', ligaId)
  if (falha) return error('Não foi possível definir a foto principal.', 500)
  return success({ capaUrl: midia.url })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; midiaId: string }> }) {
  const { id, midiaId: midiaParam } = await params
  const ligaId = Number(id)
  const midiaId = Number(midiaParam)
  const acesso = await exigirOrganizadorDaLiga(req, ligaId)
  if (acesso instanceof Response) return acesso
  const midia = await lerMidia(ligaId, midiaId)
  if (!midia) return error('Foto não encontrada neste campeonato.', 404)

  const caminhos = [caminhoDaFoto(midia.url, ligaId), caminhoDaFoto(midia.thumbUrl, ligaId)].filter((item): item is string => Boolean(item))
  if (caminhos.length > 0) {
    await supabaseAdmin.storage.from('galeria-campeonato').remove(caminhos)
  }

  const { data: liga } = await supabaseAdmin.from('Liga').select('capaUrl').eq('id', ligaId).maybeSingle()
  if (liga?.capaUrl && liga.capaUrl === midia.url) {
    await supabaseAdmin.from('Liga').update({ capaUrl: null }).eq('id', ligaId)
  }

  const { error: falha } = await supabaseAdmin.from('Midia').delete().eq('id', midiaId).eq('ligaId', ligaId)
  if (falha) return error('Não foi possível excluir a foto.', 500)
  return success({ id: midiaId })
}
