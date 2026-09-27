import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { normalizeCadastroEmail } from '@/lib/candidatura-duplicates'

const contaSchema = z.object({
  nome: z.string().trim().min(1),
  email: z.string().trim().email(),
  senha: z.string().min(8),
})

const resetSchema = z.object({
  id: z.string().trim().min(1),
  senha: z.string().min(8),
})

export async function GET(req: NextRequest) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr

  const { data, error: listError } = await supabase
    .from('CandidaturaOrganizador')
    .select('id,nome,email,status,criadaEm,trocarSenha')
    .order('criadaEm', { ascending: false })

  if (listError) return error('Não foi possível listar os organizadores.', 500)
  return success(data ?? [])
}

export async function POST(req: NextRequest) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr

  const parsed = contaSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Informe nome, usuário e uma senha com pelo menos 8 caracteres.', 422)

  const email = normalizeCadastroEmail(parsed.data.email)
  const senhaHash = await bcrypt.hash(parsed.data.senha, 10)
  const nome = parsed.data.nome.trim()

  const { data: existing, error: lookupError } = await supabase
    .from('CandidaturaOrganizador')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (lookupError) return error('Não foi possível consultar o organizador.', 500)

  if (existing) {
    const { error: updateError } = await supabase
      .from('CandidaturaOrganizador')
      .update({ nome, senhaHash, status: 'ATIVA', trocarSenha: true })
      .eq('id', existing.id)
    if (updateError) return error('Não foi possível atualizar o acesso do organizador.', 500)
    return success({ id: existing.id, email, nome, atualizado: true })
  }

  const id = randomUUID()
  const { error: insertError } = await supabase.from('CandidaturaOrganizador').insert({
    id,
    nome,
    email,
    senhaHash,
    status: 'ATIVA',
    plano: 'PADRAO',
    trocarSenha: true,
  })
  if (insertError) return error('Não foi possível criar a conta do organizador.', 500)
  return success({ id, email, nome, atualizado: false }, 201)
}

export async function PATCH(req: NextRequest) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr

  const parsed = resetSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Informe uma senha com pelo menos 8 caracteres.', 422)

  const senhaHash = await bcrypt.hash(parsed.data.senha, 10)
  const { data, error: updateError } = await supabase
    .from('CandidaturaOrganizador')
    .update({ senhaHash, status: 'ATIVA', trocarSenha: true })
    .eq('id', parsed.data.id)
    .select('id,email,nome')
    .maybeSingle()

  if (updateError) return error('Não foi possível resetar a senha do organizador.', 500)
  if (!data) return error('Organizador não encontrado.', 404)
  return success({ id: data.id, email: data.email, nome: data.nome })
}
