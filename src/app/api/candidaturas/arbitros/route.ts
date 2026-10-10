import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { candidaturaArbitroSchema } from '@/lib/schemas'
import { emailCadastroRecebido, sendEmail } from '@/lib/email'
import { setTokenCookie, signPublicToken } from '@/lib/auth'
import { duplicateDatabaseMessage, duplicateMessage, findCadastroDuplicate, formatCadastroPhone, normalizeCadastroEmail } from '@/lib/candidatura-duplicates'
import { errorDetail } from '@/lib/error-detail'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = candidaturaArbitroSchema.safeParse(body)
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
      .from('CandidaturaArbitro')
      .select('id')
      .eq('email', cadastro.email)
      .maybeSingle()

    if (existing) return error('Já existe uma candidatura com este e-mail', 409)

    const senhaHash = await bcrypt.hash(senha, 10)

    const { data, error: err } = await supabase
      .from('CandidaturaArbitro')
      .insert({ id: randomUUID(), ...cadastro, senhaHash })
      .select()
      .single()

    if (err) throw err
    try {
      await sendEmail({
        to: cadastro.email,
        subject: 'Cadastro recebido - volei.space',
        html: emailCadastroRecebido(cadastro.nome, 'arbitro'),
      })
    } catch (emailErr) {
      console.error('[candidaturas/arbitros] erro ao enviar e-mail de cadastro', emailErr)
    }
    const token = await signPublicToken({ userId: data.id, email: cadastro.email, nome: cadastro.nome, tipo: 'arbitro', status: data.status || 'PENDENTE' })
    const cookie = setTokenCookie(token)
    const res = success({ id: data.id, mensagem: 'Candidatura recebida! Em breve você receberá um retorno.' }, 201)
    res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2])
    return res
  } catch (err) {
    const detail = errorDetail(err)
    const duplicateError = duplicateDatabaseMessage(detail)
    if (duplicateError) return error(duplicateError, 409)
    console.error('[candidaturas/arbitros] erro ao registrar candidatura', err)
    return error('Erro ao registrar candidatura.', 500)
  }
}
