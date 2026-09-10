import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'

const tables = {
  arbitro: 'CandidaturaArbitro',
  quadra: 'CandidaturaQuadra',
  organizador: 'CandidaturaOrganizador',
} as const

export async function GET(req: NextRequest) {
  const authErr = await requireAuth(req)
  if (authErr) return authErr

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') ?? 'arbitro'
  const status = searchParams.get('status') ?? 'PENDENTE'
  if (tipo === 'equipe') return success([])
  const table = tables[tipo as keyof typeof tables]
  if (!table) return error('Tipo de candidatura inválido', 422)

  let q = supabase.from(table).select('*').order('criadaEm', { ascending: false })
  if (status !== 'TODAS') q = q.eq('status', status)

  const { data, error: err } = await q
  if (err) return error('Erro ao buscar candidaturas', 500)
  return success(data)
}
