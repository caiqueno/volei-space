import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { candidaturaOrganizadorSchema } from '@/lib/schemas'
import { emailAtivarConta, sendEmail } from '@/lib/email'
import { signAccountActivationToken } from '@/lib/auth'
import { duplicateDatabaseMessage, duplicateMessage, findCadastroDuplicate, formatCadastroPhone, normalizeCadastroEmail } from '@/lib/candidatura-duplicates'
import { errorDetail } from '@/lib/error-detail'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = candidaturaOrganizadorSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { senha, ...dados } = parsed.data
    const cadastro = {
      ...dados,
      email: normalizeCadastroEmail(dados.email),
      telefone: formatCadastroPhone(dados.telefone) || null,
    }

    const duplicate = await findCadastroDuplicate(cadastro.email)
    if (duplicate) return error(duplicateMessage(duplicate), 409)

    const { data: existing } = await supabase
      .from('CandidaturaOrganizador')
      .select('id')
      .eq('email', cadastro.email)
      .maybeSingle()

    if (existing) return error('Já existe uma candidatura com este e-mail', 409)

    const senhaHash = await bcrypt.hash(senha, 10)

    const { data, error: err } = await supabase
      .from('CandidaturaOrganizador')
      .insert({ id: randomUUID(), ...cadastro, senhaHash, status: 'ATIVA' })
      .select()
      .single()

    if (err) throw err

    const activationToken = await signAccountActivationToken({ candidaturaId: data.id, email: cadastro.email })
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const activationUrl = `${baseUrl.replace(/\/$/, '')}/ativar-conta?token=${encodeURIComponent(activationToken)}`

    try {
      await sendEmail({
        to: cadastro.email,
        subject: 'Confirme seu e-mail - volei.space',
        html: emailAtivarConta(cadastro.nome, activationUrl),
      })
    } catch (emailErr) {
      console.error('[candidaturas/organizadores] erro ao enviar e-mail de ativação', emailErr)
    }

    return success({
      id: data.id,
      requerVerificacao: true,
      mensagem: 'Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta.',
    }, 201)
  } catch (err) {
    const detail = errorDetail(err)
    const duplicateError = duplicateDatabaseMessage(detail)
    if (duplicateError) return error(duplicateError, 409)
    console.error('[candidaturas/organizadores] erro ao registrar candidatura', err)
    return error(`Erro ao registrar candidatura: ${detail}`, 500)
  }
}
