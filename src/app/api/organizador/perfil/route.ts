import { NextRequest } from 'next/server'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { isSupabaseServiceConfigured, supabaseAdmin } from '@/lib/supabase-admin'
import { organizadorPerfilSchema } from '@/lib/schemas'

// Único endpoint para ler/editar os dados de organização do próprio
// organizador logado — usado tanto pelo onboarding pós-login (primeira vez,
// organizacao ainda vazia) quanto por Configurações (edição depois). Não há
// distinção de "criar" no banco: a linha CandidaturaOrganizador já existe
// desde o cadastro, aqui só é atualizada (PATCH), nunca inserida.
export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'])
  if (auth instanceof Response) return auth

  if (!isSupabaseServiceConfigured) {
    return error('SUPABASE_SERVICE_ROLE_KEY nao configurada.', 500)
  }

  const { data, error: err } = await supabaseAdmin
    .from('CandidaturaOrganizador')
    .select('nome,organizacao,cidade,logoUrl')
    .eq('id', auth.userId)
    .maybeSingle()

  if (err) return error('Erro ao buscar perfil da organização.', 500, err.message)
  if (!data) return error('Organizador não encontrado.', 404)
  return success(data)
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'])
  if (auth instanceof Response) return auth

  if (!isSupabaseServiceConfigured) {
    return error('SUPABASE_SERVICE_ROLE_KEY nao configurada.', 500)
  }

  const parsed = organizadorPerfilSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Dados inválidos.', 422, parsed.error.flatten())

  const { data, error: err } = await supabaseAdmin
    .from('CandidaturaOrganizador')
    .update(parsed.data)
    .eq('id', auth.userId)
    .select('nome,organizacao,cidade,logoUrl')
    .single()

  if (err) return error('Erro ao atualizar perfil da organização.', 500, err.message)
  return success(data)
}
