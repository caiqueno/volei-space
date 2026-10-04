import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { error, success } from '@/lib/api-response'
import { findCadastroDuplicate, formatCadastroPhone, normalizeCadastroEmail } from '@/lib/candidatura-duplicates'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'

const interesseSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  telefone: z.string().trim().min(10).max(20),
})

export async function POST(req: NextRequest) {
  const parsed = interesseSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error('Informe nome, e-mail e telefone.', 422)

  const email = normalizeCadastroEmail(parsed.data.email)
  const telefone = formatCadastroPhone(parsed.data.telefone)
  if (telefone.replace(/\D/g, '').length < 10) return error('Informe um telefone com DDD.', 422)

  const duplicado = await findCadastroDuplicate(email)
  if (duplicado && duplicado.table !== 'CandidaturaOrganizador') {
    return error('Este e-mail já está em uso.', 409)
  }

  const { data: existente, error: leitura } = await supabase
    .from('CandidaturaOrganizador')
    .select('id,status')
    .ilike('email', email)
    .maybeSingle()
  if (leitura) return error('Não foi possível registrar a solicitação.', 500)
  if (existente && existente.status !== 'PENDENTE' && existente.status !== 'REJEITADA') {
    return error('Este e-mail já possui acesso de organizador.', 409)
  }

  if (existente) {
    const { error: atualizacao } = await supabase
      .from('CandidaturaOrganizador')
      .update({ nome: parsed.data.nome.trim(), telefone, status: 'PENDENTE' })
      .eq('id', existente.id)
    if (atualizacao) return error('Não foi possível registrar a solicitação.', 500)
    return success({ id: existente.id, status: 'PENDENTE' })
  }

  const id = randomUUID()
  const { error: gravacao } = await supabase.from('CandidaturaOrganizador').insert({
    id,
    nome: parsed.data.nome.trim(),
    email,
    telefone,
    status: 'PENDENTE',
    plano: 'PADRAO',
    trocarSenha: false,
  })
  if (gravacao) return error('Não foi possível registrar a solicitação.', 500)
  return success({ id, status: 'PENDENTE' }, 201)
}
