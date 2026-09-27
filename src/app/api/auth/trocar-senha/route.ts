import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { setTokenCookie, signPublicToken, verifyPublicToken, type PublicUserRole } from '@/lib/auth'

const schema = z.object({
  senha: z.string().min(8),
  confirmarSenha: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const session = await verifyPublicToken(req)
  if (!session || (session.tipo !== 'organizador' && session.tipo !== 'arbitro')) {
    return error('Entre com a senha recebida antes de substituir.', 401)
  }
  const table = session.tipo === 'arbitro' ? 'CandidaturaArbitro' : 'CandidaturaOrganizador'

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('A senha nova precisa ter pelo menos 8 caracteres.', 422)
  if (parsed.data.senha !== parsed.data.confirmarSenha) return error('As senhas não coincidem.', 422)

  const { data, error: lookupError } = await supabase
    .from(table)
    .select('id,email,nome,status,senhaHash,trocarSenha')
    .eq('id', session.userId)
    .maybeSingle()

  if (lookupError) return error('Não foi possível consultar a conta.', 500)
  if (!data?.senhaHash) return error('Conta não encontrada.', 404)
  if (data.trocarSenha !== true) return error('Esta senha já foi substituída.', 409)

  const igual = await bcrypt.compare(parsed.data.senha, data.senhaHash)
  if (igual) return error('Escolha uma senha diferente da que você recebeu.', 422)

  const senhaHash = await bcrypt.hash(parsed.data.senha, 10)
  const { error: updateError } = await supabase
    .from(table)
    .update({ senhaHash, trocarSenha: false })
    .eq('id', data.id)

  if (updateError) return error('Não foi possível substituir a senha.', 500)

  const token = await signPublicToken({
    userId: String(data.id),
    email: String(data.email),
    nome: String(data.nome || ''),
    tipo: session.tipo as PublicUserRole,
    status: String(data.status || 'ATIVA'),
    trocarSenha: false,
  })
  const cookie = setTokenCookie(token)
  const res = success({ redirectTo: '/painel' })
  res.cookies.set(cookie.name, cookie.value, cookie.options as Parameters<typeof res.cookies.set>[2])
  return res
}
