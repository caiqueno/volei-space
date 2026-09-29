import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { error, success } from '@/lib/api-response'
import { requirePublicRole } from '@/lib/auth'

const STATUS_ARBITRO_APROVADO = ['APROVADA', 'APROVADO', 'ATIVA', 'ATIVO']

export async function GET(req: NextRequest) {
  const auth = await requirePublicRole(req, ['arbitro'])
  if (auth instanceof Response) return auth

  const candidatura = await getCandidaturaArbitro(auth.userId)
  if (!candidatura) return error('Cadastro de árbitro não encontrado.', 404)

  if (!isArbitroAprovado(candidatura.status)) {
    return success({
      arbitro: candidatura,
      elegivel: false,
      motivo: 'Seu cadastro de árbitro precisa ser aprovado pela organização antes de operar uma partida.',
      partidas: [],
      filtros: null,
    })
  }

  if (!candidatura.arbitroId) {
    return success({ arbitro: candidatura, elegivel: true, partidas: [] })
  }

  const { data: escalas, error: escalaErr } = await supabase
    .from('EscalaArbitro')
    .select('partidaId')
    .eq('arbitroId', candidatura.arbitroId)

  if (escalaErr) return error('Erro ao buscar as partidas designadas.', 500)
  const ids = (escalas ?? []).map((item) => item.partidaId)
  if (ids.length === 0) return success({ arbitro: candidatura, elegivel: true, partidas: [] })

  const { data: partidas, error: partidasErr } = await supabase
    .from('Partida')
    .select('id,rodada,status,dataHora,localNome,sumulaToken,setsPorA,setsPorB,pontosPorA,pontosPorB,liga:Liga!Partida_ligaId_fkey(id,nome,simulacao),equipeA:Equipe!Partida_equipeAId_fkey(nome),equipeB:Equipe!Partida_equipeBId_fkey(nome)')
    .in('id', ids)
    .order('dataHora', { ascending: true, nullsFirst: false })

  if (partidasErr) return error('Erro ao buscar as partidas designadas.', 500)
  return success({ arbitro: candidatura, elegivel: true, partidas: partidas ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requirePublicRole(req, ['arbitro'])
  if (auth instanceof Response) return auth

  const candidatura = await getCandidaturaArbitro(auth.userId)
  if (!candidatura) return error('Cadastro de árbitro não encontrado.', 404)
  return error('O organizador designa o árbitro na tabela de jogos. Esta conta não escolhe a própria partida.', 403)
}

async function getCandidaturaArbitro(id: string) {
  const { data } = await supabase
    .from('CandidaturaArbitro')
    .select('id,nome,email,status,arbitroId')
    .eq('id', id)
    .maybeSingle()

  return data
}

function isArbitroAprovado(status?: string | null) {
  return STATUS_ARBITRO_APROVADO.includes(String(status ?? '').trim().toUpperCase())
}
