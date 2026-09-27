import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { generateAccessCode } from '@/lib/organizer-access-code'
import { normalizeCadastroEmail } from '@/lib/candidatura-duplicates'

export async function GET(req: NextRequest) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr

  const { data, error: listError } = await supabase
    .from('CodigoAcessoOrganizador')
    .select('id,codigo,organizadorId,criadoEm,usadoEm')
    .order('criadoEm', { ascending: false })

  if (listError) return error('Não foi possível listar os IDs de acesso.', 500)

  const ids = (data ?? []).map((item) => item.organizadorId).filter(Boolean)
  const organizers = ids.length
    ? await supabase.from('CandidaturaOrganizador').select('id,nome,email').in('id', ids)
    : { data: [] }
  const byId = new Map((organizers.data ?? []).map((item) => [item.id, item]))

  return success((data ?? []).map((item) => ({
    ...item,
    organizador: item.organizadorId ? byId.get(item.organizadorId) ?? null : null,
  })))
}

export async function POST(req: NextRequest) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr

  const body = await req.json().catch(() => ({}))
  const email = normalizeCadastroEmail(body?.email)

  if (email) return bindExistingOrganizer(email)
  return createFreeCode()
}

async function createFreeCode() {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const codigo = generateAccessCode()
    const { data, error: insertError } = await supabase
      .from('CodigoAcessoOrganizador')
      .insert({ id: randomUUID(), codigo })
      .select('id,codigo,organizadorId,criadoEm,usadoEm')
      .single()
    if (!insertError && data) return success(data, 201)
    if (insertError && !String(insertError.message).includes('duplicate')) {
      return error('Não foi possível gerar o ID de acesso.', 500)
    }
  }
  return error('Não foi possível gerar o ID de acesso.', 500)
}

async function bindExistingOrganizer(email: string) {
  const { data: organizer, error: organizerError } = await supabase
    .from('CandidaturaOrganizador')
    .select('id,nome,email')
    .ilike('email', email)
    .maybeSingle()

  if (organizerError) return error('Não foi possível consultar o organizador.', 500)
  if (!organizer) return error('Não há organizador com esse e-mail.', 404)

  const { data: current } = await supabase
    .from('CodigoAcessoOrganizador')
    .select('id,codigo,organizadorId,criadoEm,usadoEm')
    .eq('organizadorId', organizer.id)
    .maybeSingle()

  if (current) return success({ ...current, organizador: organizer, jaExistia: true })

  const codigo = generateAccessCode()
  const { data, error: insertError } = await supabase
    .from('CodigoAcessoOrganizador')
    .insert({
      id: randomUUID(),
      codigo,
      organizadorId: organizer.id,
      usadoEm: new Date().toISOString(),
    })
    .select('id,codigo,organizadorId,criadoEm,usadoEm')
    .single()

  if (insertError || !data) return error('Não foi possível vincular o ID a este organizador.', 500)
  return success({ ...data, organizador: organizer, jaExistia: false }, 201)
}
