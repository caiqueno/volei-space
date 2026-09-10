import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const partidaId = Number(id)
  if (!Number.isFinite(partidaId)) return error('Partida inválida', 400)

  try {
    const { data, error: partidaErr } = await supabase
      .from('Partida')
      .select(`
        id,
        rodada,
        dataHora,
        localNome,
        status,
        setsPorA,
        setsPorB,
        pontosPorA,
        pontosPorB,
        equipeA:Equipe!equipeAId(id,nome,jogadores:Jogador(id,nome,numero,fotoRostoUrl,fotoUrl)),
        equipeB:Equipe!equipeBId(id,nome,jogadores:Jogador(id,nome,numero,fotoRostoUrl,fotoUrl))
      `)
      .eq('id', partidaId)
      .single()

    if ((partidaErr || !data) && partidaId === 9001) {
      return noStore(success(makeDemoLivePartida()))
    }

    if (partidaErr || !data) return error('Partida não encontrada', 404)

    const [setsRes, presencasRes, ocorrenciasRes, destaquesRes] = await Promise.all([
      supabase.from('SetPartida').select('id,numero,pontosA,pontosB').eq('partidaId', partidaId),
      supabase
        .from('SumulaPresenca')
        .select('id,presente,equipeId,jogadorId,jogador:Jogador(id,nome,numero,fotoRostoUrl,fotoUrl)')
        .eq('partidaId', partidaId),
      supabase.from('OcorrenciaPartida').select('id,tipo,descricao,set,jogadorId').eq('partidaId', partidaId),
      supabase
        .from('DestaquesPartida')
        .select('id,tipo,jogador:Jogador(id,nome,numero,fotoRostoUrl,fotoUrl)')
        .eq('partidaId', partidaId),
    ])

    const sets = [...(setsRes.data ?? [])].sort((a: any, b: any) => Number(a.numero) - Number(b.numero))
    const ocorrencias = [...(ocorrenciasRes.data ?? [])].sort((a: any, b: any) => Number(a.id) - Number(b.id))

    return noStore(success({
      ...data,
      sets,
      presencas: presencasRes.data ?? [],
      ocorrencias,
      destaques: destaquesRes.data ?? [],
      atualizadoEm: new Date().toISOString(),
    }))
  } catch (err) {
    console.error('[partidas/ao-vivo] erro ao carregar', err)
    if (partidaId === 9001) return noStore(success(makeDemoLivePartida()))
    return error('Erro ao carregar acompanhamento ao vivo', 500)
  }
}

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')
  return response
}

function makeDemoLivePartida() {
  const jogadoresA = Array.from({ length: 8 }, (_, index) => ({
    id: 100 + index + 1,
    nome: `Jogador ${index + 1} - Set Point`,
    numero: index + 1,
    fotoRostoUrl: null,
    fotoUrl: null,
  }))
  const jogadoresB = Array.from({ length: 8 }, (_, index) => ({
    id: 200 + index + 1,
    nome: `Jogador ${index + 1} - Líbero FC`,
    numero: index + 1,
    fotoRostoUrl: null,
    fotoUrl: null,
  }))

  return {
    id: 9001,
    rodada: 6,
    dataHora: '2026-08-15T14:00:00.000Z',
    localNome: 'Ginásio Municipal',
    status: 'EM_ANDAMENTO',
    setsPorA: 0,
    setsPorB: 0,
    pontosPorA: 0,
    pontosPorB: 0,
    equipeA: { id: 101, nome: 'Set Point', jogadores: jogadoresA },
    equipeB: { id: 102, nome: 'Líbero FC', jogadores: jogadoresB },
    sets: [{ id: 1, numero: 1, pontosA: 0, pontosB: 0 }],
    presencas: [...jogadoresA, ...jogadoresB].map((jogador) => ({
      id: jogador.id,
      presente: true,
      equipeId: jogador.id < 200 ? 101 : 102,
      jogadorId: jogador.id,
      jogador,
    })),
    ocorrencias: [
      { id: 1, tipo: 'system', descricao: 'Partida liberada para acompanhamento ao vivo.', set: 1 },
    ],
    destaques: [],
    atualizadoEm: new Date().toISOString(),
  }
}
