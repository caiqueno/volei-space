import { NextRequest } from 'next/server'
import { z } from 'zod'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { isSupabaseServiceConfigured, supabaseAdmin } from '@/lib/supabase-admin'

const updateSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['APROVAR', 'REMOVER']),
})

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  if (!isSupabaseServiceConfigured) {
    return error('SUPABASE_SERVICE_ROLE_KEY nao configurada.', 500)
  }

  const { data, error: err } = await supabaseAdmin
    .from('CandidaturaQuadra')
    .select('id,nome,responsavel,email,telefone,instagram,status,endereco,bairro,estrutura,fotosUrls,criadoEm')
    .order('criadoEm', { ascending: false })

  if (err) return error('Erro ao buscar quadras.', 500, err.message)
  return success(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth

  if (!isSupabaseServiceConfigured) {
    return error('SUPABASE_SERVICE_ROLE_KEY nao configurada.', 500)
  }

  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Dados invalidos.', 422, parsed.error.flatten())

  const status = parsed.data.action === 'APROVAR' ? 'APROVADA' : 'REJEITADA'
  const { data, error: err } = await supabaseAdmin
    .from('CandidaturaQuadra')
    .update({ status })
    .eq('id', parsed.data.id)
    .select('id,nome,responsavel,email,telefone,instagram,status,endereco,bairro,estrutura,fotosUrls')
    .single()

  if (err) return error('Erro ao atualizar quadra.', 500, err.message)
  return success(data)
}
