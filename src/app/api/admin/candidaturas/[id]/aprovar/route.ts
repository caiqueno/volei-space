import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { emailAprovacaoSemPagamento, sendEmail } from '@/lib/email'

const schema = z.object({
  tipo: z.enum(['arbitro', 'quadra', 'organizador']),
})

const tables = {
  arbitro: 'CandidaturaArbitro',
  quadra: 'CandidaturaQuadra',
  organizador: 'CandidaturaOrganizador',
} as const

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr
  const { id } = await params

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return error('Equipes devem ser avaliadas pelo organizador do campeonato.', 422, parsed.error.flatten())
    }

    const { tipo } = parsed.data
    const table = tables[tipo]

    const { data: candidatura, error: fetchErr } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !candidatura) return error('Candidatura não encontrada', 404)
    if (candidatura.status !== 'PENDENTE') return error('Candidatura não está mais pendente', 400)

    if (tipo === 'arbitro') {
      const arbitroId = await ensureArbitroForCandidatura(candidatura)
      await supabase.from(table).update({ status: 'APROVADA', arbitroId }).eq('id', id)
      await notifyApproval(candidatura.email, candidatura.nome, 'árbitro')
      return success({ aprovada: true, arbitroId, mensagem: 'Árbitro aprovado, perfil operacional criado e e-mail enviado.' })
    }

    await supabase.from(table).update({ status: 'APROVADA' }).eq('id', id)
    await notifyApproval(
      candidatura.email,
      candidatura.nome,
      tipo === 'quadra' ? 'fornecedor de quadra' : 'criador de campeonatos',
    )

    return success({ aprovada: true, mensagem: 'Cadastro aprovado e e-mail enviado.' })
  } catch (err) {
    console.error('[admin/candidaturas/aprovar] erro', err)
    return error('Erro ao aprovar candidatura', 500)
  }
}

async function ensureArbitroForCandidatura(candidatura: any) {
  if (candidatura.arbitroId) return candidatura.arbitroId

  const { data: existente } = await supabase
    .from('Arbitro')
    .select('id')
    .eq('email', candidatura.email)
    .maybeSingle()

  if (existente?.id) return existente.id

  const { data, error: insertErr } = await supabase
    .from('Arbitro')
    .insert({
      nome: candidatura.nome,
      email: candidatura.email,
      telefone: candidatura.telefone,
      cref: candidatura.cref,
      diplomaUrl: candidatura.diplomaUrl,
      aprovado: true,
    })
    .select('id')
    .single()

  if (insertErr || !data?.id) {
    console.error('[admin/candidaturas/aprovar] erro ao criar árbitro', insertErr)
    throw new Error('Não foi possível criar o perfil operacional do árbitro.')
  }

  return data.id
}

async function notifyApproval(email: string, nome: string, tipo: string) {
  try {
    await sendEmail({
      to: email,
      subject: 'Candidatura aprovada - volei.space',
      html: emailAprovacaoSemPagamento(nome, tipo),
    })
  } catch (emailErr) {
    console.error('[admin/candidaturas/aprovar] erro ao enviar e-mail', emailErr)
  }
}
