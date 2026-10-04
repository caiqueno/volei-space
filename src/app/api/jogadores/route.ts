import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { success, error } from '@/lib/api-response'
import { jogadorSchema } from '@/lib/schemas'
import { exigirOrganizadorDaEquipe } from '@/lib/organizador-isolamento'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const equipeId = searchParams.get('equipeId')
    const busca = searchParams.get('q')?.trim()

    let q = supabase.from('Jogador').select('*, equipe:Equipe(id, nome)').order('nome', { ascending: true })
    if (equipeId) q = q.eq('equipeId', Number(equipeId))
    if (busca) q = q.ilike('nome', `%${busca.replace(/[%_]/g, '')}%`)

    const { data, error: err } = await q
    if (err) throw err
    return success(data)
  } catch {
    return error('Erro ao buscar jogadores', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = jogadorSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())
    const acesso = await exigirOrganizadorDaEquipe(req, parsed.data.equipeId)
    if (acesso instanceof NextResponse) return acesso

    const { data, error: err } = await supabase
      .from('Jogador')
      .insert(parsed.data)
      .select()
      .single()
    if (err) throw err
    return success(data, 201)
  } catch {
    return error('Erro ao criar jogador', 500)
  }
}
