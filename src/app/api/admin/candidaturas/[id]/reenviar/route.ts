import { randomBytes } from 'crypto'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'

const STATUS_COM_ACESSO = new Set(['ATIVA', 'ATIVO', 'APROVADA', 'APROVADO', 'LIBERADA', 'LIBERADO'])

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const { id } = await params

  try {
    const { data: candidatura, error: fetchErr } = await supabase
      .from('CandidaturaOrganizador')
      .select('id,status,email')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr || !candidatura) return error('Organizador não encontrado.', 404)
    if (!STATUS_COM_ACESSO.has(String(candidatura.status))) {
      return error('Este cadastro ainda não foi liberado. Aprove a solicitação antes de reenviar o acesso.', 400)
    }

    const senhaTemporaria = randomBytes(9).toString('base64url')
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10)
    const { error: acessoErr } = await supabase.from('CandidaturaOrganizador').update({
      senhaHash,
      trocarSenha: true,
    }).eq('id', id)
    if (acessoErr) return error('Não foi possível reenviar o acesso.', 500)

    return success({
      senhaTemporaria,
      mensagem: 'Nova senha temporária gerada. Entregue uma única vez. No próximo acesso o organizador precisa trocá-la.',
    })
  } catch (err) {
    console.error('[admin/candidaturas/reenviar] erro', err)
    return error('Não foi possível reenviar o acesso.', 500)
  }
}
