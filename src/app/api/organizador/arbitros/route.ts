import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'
import { findCadastroDuplicate, normalizeCadastroEmail } from '@/lib/candidatura-duplicates'

const contaSchema = z.object({
  nome: z.string().trim().min(1),
  email: z.string().trim().email(),
  senha: z.string().min(8),
})

const resetSchema = z.object({
  id: z.string().trim().min(1),
  senha: z.string().min(8),
})

async function requireOrganizer(req: NextRequest) {
  const auth = await requirePublicRole(req, ['organizador'], { releasedOnly: true })
  if (auth instanceof Response) return auth
  return auth
}

export async function GET(req: NextRequest) {
  const auth = await requireOrganizer(req)
  if (auth instanceof Response) return auth

  const { data, error: listError } = await supabase
    .from('CandidaturaArbitro')
    .select('id,nome,email,status,criadaEm')
    .eq('organizadorId', auth.userId)
    .order('criadaEm', { ascending: false })

  if (listError) return error('Não foi possível listar os árbitros.', 500)
  return success(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await requireOrganizer(req)
  if (auth instanceof Response) return auth

  const parsed = contaSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Informe nome, usuário e uma senha com pelo menos 8 caracteres.', 422)

  const email = normalizeCadastroEmail(parsed.data.email)
  const nome = parsed.data.nome.trim()
  const senhaHash = await bcrypt.hash(parsed.data.senha, 10)

  const duplicate = await findCadastroDuplicate(email)
  if (duplicate && duplicate.table !== 'CandidaturaArbitro' && duplicate.table !== 'Arbitro') {
    return error('Este usuário já existe em outro acesso.', 409)
  }

  const { data: existing, error: lookupError } = await supabase
    .from('CandidaturaArbitro')
    .select('id,organizadorId')
    .ilike('email', email)
    .maybeSingle()

  if (lookupError) return error('Não foi possível consultar o árbitro.', 500)
  if (existing && existing.organizadorId && existing.organizadorId !== auth.userId) {
    return error('Este árbitro já pertence a outra organização.', 409)
  }

  const arbitroId = await ensureArbitro(nome, email)
  if (!arbitroId) return error('Não foi possível criar o cadastro do árbitro.', 500)

  if (existing) {
    const { error: updateError } = await supabase
      .from('CandidaturaArbitro')
      .update({
        nome,
        senhaHash,
        status: 'ATIVA',
        trocarSenha: true,
        organizadorId: auth.userId,
        arbitroId,
      })
      .eq('id', existing.id)
    if (updateError) return error('Não foi possível atualizar o acesso do árbitro.', 500)
    return success({ id: existing.id, email, nome, atualizado: true })
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  const { error: insertError } = await supabase.from('CandidaturaArbitro').insert({
    id,
    nome,
    email,
    senhaHash,
    status: 'ATIVA',
    trocarSenha: true,
    organizadorId: auth.userId,
    arbitroId,
    criadaEm: now,
    atualizadaEm: now,
  })
  if (insertError) {
    console.error('[organizador/arbitros] insert', insertError)
    return error('Não foi possível criar o acesso do árbitro.', 500)
  }
  return success({ id, email, nome, atualizado: false }, 201)
}

export async function PATCH(req: NextRequest) {
  const auth = await requireOrganizer(req)
  if (auth instanceof Response) return auth

  const parsed = resetSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Informe uma senha com pelo menos 8 caracteres.', 422)

  const senhaHash = await bcrypt.hash(parsed.data.senha, 10)
  const { data, error: updateError } = await supabase
    .from('CandidaturaArbitro')
    .update({ senhaHash, status: 'ATIVA', trocarSenha: true })
    .eq('id', parsed.data.id)
    .eq('organizadorId', auth.userId)
    .select('id,email,nome')
    .maybeSingle()

  if (updateError) return error('Não foi possível resetar a senha do árbitro.', 500)
  if (!data) return error('Árbitro não encontrado.', 404)
  return success({ id: data.id, email: data.email, nome: data.nome })
}

async function ensureArbitro(nome: string, email: string) {
  const { data: existing, error: lookupError } = await supabase
    .from('Arbitro')
    .select('id')
    .ilike('email', email)
    .maybeSingle()

  if (lookupError) {
    console.error('[organizador/arbitros] lookup Arbitro', lookupError)
    return null
  }

  if (existing?.id) {
    await supabase.from('Arbitro').update({ nome, aprovado: true }).eq('id', existing.id)
    return existing.id as number
  }

  const { data, error: insertError } = await supabase
    .from('Arbitro')
    .insert({ nome, email, aprovado: true, criadoEm: new Date().toISOString() })
    .select('id')
    .single()

  if (insertError || !data) {
    console.error('[organizador/arbitros] insert Arbitro', insertError)
    return null
  }
  return data.id as number
}
