import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { verifyPublicToken } from '@/lib/auth'
import { lerSessaoAcesso } from '@/lib/acesso-arbitro-jogo'
import { consultarComVaga } from '@/lib/consulta-vaga'
import { ladoExposto } from '@/lib/vaga-a-definir'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const partidaId = Number(id)
  if (!Number.isFinite(partidaId)) return error('Partida inválida', 400)

  try {
    const selectPartida = 'id,ligaId,rodada,fase,dataHora,localNome,status,setsPorA,setsPorB,pontosPorA,pontosPorB,sumulaAprovadaEm,equipeA:Equipe!Partida_equipeAId_fkey(id,nome,jogadores:Jogador(id,nome,numero,fotoRostoUrl,fotoUrl)),equipeB:Equipe!Partida_equipeBId_fkey(id,nome,jogadores:Jogador(id,nome,numero,fotoRostoUrl,fotoUrl))'
    const { data, error: partidaErr } = await consultarComVaga(selectPartida, (colunas) => (
      supabase.from('Partida').select(colunas).eq('id', partidaId).single()
    ))

    if ((partidaErr || !data) && partidaId === 9001) {
      return noStore(success(makeDemoLivePartida()))
    }

    if (partidaErr) return error('Não foi possível abrir o acompanhamento ao vivo.', 500)
    if (!data) return error('Partida não encontrada', 404)
    const { data: liga } = await supabase.from('Liga').select('nome,slug,descricao,simulacao').eq('id', data.ligaId).maybeSingle()
    // Quem chega aqui já tem o id da partida, vindo da agenda do campeonato.
    // Só a simulação fica fora do público; o resto seguiria link quebrado.
    if (liga?.simulacao && !(await operadorDestaPartida(_req, partidaId, data.ligaId))) {
      return error('Partida não encontrada', 404)
    }
    data.equipeA = ladoExposto(primeiro(data.equipeA), data.origemVagaA) ?? { id: 0, nome: 'A definir', vaga: true, jogadores: [] }
    data.equipeB = ladoExposto(primeiro(data.equipeB), data.origemVagaB) ?? { id: 0, nome: 'A definir', vaga: true, jogadores: [] }

    const [setsRes, presencasRes, ocorrenciasRes, destaquesRes] = await Promise.all([
      supabase.from('SetPartida').select('id,numero,pontosA,pontosB').eq('partidaId', partidaId),
      supabase
        .from('SumulaPresenca')
        .select('id,presente,equipeId,jogadorId,numero,jogador:Jogador(id,nome,numero,fotoRostoUrl,fotoUrl)')
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
      oficial: Boolean(data.sumulaAprovadaEm),
      atualizadoEm: new Date().toISOString(),
    }))
  } catch (err) {
    console.error('[partidas/ao-vivo] erro ao carregar', err)
    if (partidaId === 9001) return noStore(success(makeDemoLivePartida()))
    return error('Erro ao carregar acompanhamento ao vivo', 500)
  }
}

async function operadorDestaPartida(req: NextRequest, partidaId: number, ligaId: number) {
  const acesso = await lerSessaoAcesso(req)
  if (acesso && Number(acesso.partidaId) === partidaId) return true

  const sessao = await verifyPublicToken(req)
  if (!sessao) return false
  if (sessao.tipo === 'organizador') {
    const { data } = await supabase.from('Liga').select('id').eq('id', ligaId).eq('organizadorId', sessao.userId).maybeSingle()
    return Boolean(data)
  }
  if (sessao.tipo === 'arbitro') {
    const { data: conta } = await supabase.from('CandidaturaArbitro').select('arbitroId').eq('id', sessao.userId).maybeSingle()
    if (!conta?.arbitroId) return false
    const { data: escala } = await supabase.from('EscalaArbitro').select('id').eq('partidaId', partidaId).eq('arbitroId', conta.arbitroId).maybeSingle()
    return Boolean(escala)
  }
  return false
}

function primeiro(valor: unknown) {
  return Array.isArray(valor) ? valor[0] ?? null : valor
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
