import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { sendEmail, emailRejeicaoCandidatura } from '@/lib/email'

const schema = z.object({ tipo: z.enum(['arbitro', 'quadra', 'organizador']) })
const tables = {
  arbitro: 'CandidaturaArbitro',
  quadra: 'CandidaturaQuadra',
  organizador: 'CandidaturaOrganizador',
} as const

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return error('Equipes devem ser avaliadas pelo organizador do campeonato.', 422)

  const table = tables[parsed.data.tipo]
  const { data: candidatura } = await supabase.from(table).select('*').eq('id', id).single()
  if (!candidatura) return error('Candidatura não encontrada', 404)

  await supabase.from(table).update({ status: 'REJEITADA' }).eq('id', id)

  try {
    await sendEmail({
      to: candidatura.email,
      subject: 'volei.space - Retorno sobre sua candidatura',
      html: emailRejeicaoCandidatura(candidatura.nome),
    })
  } catch (emailErr) {
    console.error('[admin/candidaturas/rejeitar] erro ao enviar e-mail', emailErr)
  }

  return success({ rejeitada: true })
}
