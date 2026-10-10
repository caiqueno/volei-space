import { NextRequest } from 'next/server'
import { z } from 'zod'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { isSupabaseServiceConfigured, supabaseAdmin } from '@/lib/supabase-admin'

const updateSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['APROVAR', 'REMOVER']),
})

async function ligasDoOrganizador(organizadorId: string) {
  const { data, error: err } = await supabaseAdmin.from('Liga').select('id').eq('organizadorId', organizadorId)
  if (err) return null
  return (data ?? []).map((liga) => Number(liga.id))
}

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  if (!isSupabaseServiceConfigured) {
    return error('Não foi possível consultar as quadras.', 500)
  }

  const ligaIds = await ligasDoOrganizador(auth.userId)
  if (!ligaIds) return error('Não foi possível consultar as quadras.', 500)
  if (ligaIds.length === 0) return success([])

  const { data, error: err } = await supabaseAdmin
    .from('CandidaturaQuadra')
    .select('id,nome,responsavel,email,telefone,instagram,status,endereco,bairro,estrutura,fotosUrls,criadoEm')
    .in('ligaId', ligaIds)
    .order('criadoEm', { ascending: false })

  if (err) return error('Erro ao buscar quadras.', 500)
  return success(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  if (!isSupabaseServiceConfigured) {
    return error('Não foi possível atualizar a quadra.', 500)
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Dados invalidos.', 422, parsed.error.flatten())

  const ligaIds = await ligasDoOrganizador(auth.userId)
  if (!ligaIds) return error('Não foi possível atualizar a quadra.', 500)
  if (ligaIds.length === 0) return error('Quadra não encontrada.', 404)

  const status = parsed.data.action === 'APROVAR' ? 'APROVADA' : 'REJEITADA'
  const { data, error: err } = await supabaseAdmin
    .from('CandidaturaQuadra')
    .update({ status })
    .eq('id', parsed.data.id)
    .in('ligaId', ligaIds)
    .select('id,nome,responsavel,email,telefone,instagram,status,endereco,bairro,estrutura,fotosUrls')
    .maybeSingle()

  if (err) return error('Erro ao atualizar quadra.', 500)
  if (!data) return error('Quadra não encontrada.', 404)
  return success(data)
}
