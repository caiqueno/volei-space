import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { sumulaSchema } from '@/lib/schemas'
import { recalculateLeagueClassification, syncLeagueLifecycle } from '@/lib/championship-operations'
import { requireSumulaTokenAccess } from '@/lib/sumula-access'

const DEMO_SUMULA_TOKENS = new Set(['token-demo-1-luva2026', 'token-demo-1-luv2026'])

async function assertDb<T extends { error: any }>(operation: PromiseLike<T>) {
  const result = await operation
  if (result.error) throw result.error
  return result
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (DEMO_SUMULA_TOKENS.has(token)) {
    return success(makeDemoPartida(token))
  }

  const access = await requireSumulaTokenAccess(token)
  if (access instanceof Response) return access
  return success(access.partida)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    if (DEMO_SUMULA_TOKENS.has(token)) {
      return success({ submetida: true, oficial: false, modoTeste: true, status: 'ENCERRADA' })
    }

    const access = await requireSumulaTokenAccess(token)
    if (access instanceof Response) return access

    const partida = access.partida
    if (partida.status === 'ENCERRADA') return error('Partida já encerrada', 400)

    const body = await req.json()
    const parsed = sumulaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { presencas, sets, ocorrencias, destaques } = parsed.data
    const validationError = validateSumulaPayload(partida, parsed.data, { requireMinimumPresencas: true })
    if (validationError) return error(validationError, 422)
    if (sets.length === 0) return error('A súmula só pode ser enviada com pelo menos um set registrado.', 422)

    let setsPorA = 0
    let setsPorB = 0
    let pontosPorA = 0
    let pontosPorB = 0

    for (const set of sets) {
      if (set.pontosA > set.pontosB) setsPorA += 1
      if (set.pontosB > set.pontosA) setsPorB += 1
      pontosPorA += set.pontosA
      pontosPorB += set.pontosB
    }

    const vencedorId = setsPorA > setsPorB ? partida.equipeAId : setsPorB > setsPorA ? partida.equipeBId : null
    if (!vencedorId) return error('A partida precisa ter um vencedor antes de enviar a súmula.', 422)

    await assertDb(supabase.from('SetPartida').delete().eq('partidaId', partida.id))
    await assertDb(supabase.from('SetPartida').insert(sets.map((set) => ({ ...set, partidaId: partida.id }))))

    await assertDb(supabase.from('SumulaPresenca').delete().eq('partidaId', partida.id))
    if (presencas.length > 0) {
      await assertDb(supabase.from('SumulaPresenca').insert(presencas.map((presenca) => ({ ...presenca, partidaId: partida.id }))))
    }

    await assertDb(supabase.from('OcorrenciaPartida').delete().eq('partidaId', partida.id))
    if (ocorrencias?.length) {
      await assertDb(supabase.from('OcorrenciaPartida').insert(ocorrencias.map((ocorrencia) => ({ ...ocorrencia, partidaId: partida.id }))))
    }

    await assertDb(supabase.from('DestaquesPartida').delete().eq('partidaId', partida.id))
    if (destaques?.length) {
      await assertDb(supabase.from('DestaquesPartida').insert(destaques.map((destaque) => ({ ...destaque, partidaId: partida.id }))))
    }

    const { error: updateErr } = await supabase
      .from('Partida')
      .update({
        status: 'ENCERRADA',
        setsPorA,
        setsPorB,
        pontosPorA,
        pontosPorB,
        vencedorId,
        sumulaSubmetidaEm: new Date().toISOString(),
        sumulaAprovadaEm: new Date().toISOString(),
      })
      .eq('id', partida.id)

    if (updateErr) throw updateErr
    await recalculateLeagueClassification(partida.ligaId)
    await syncLeagueLifecycle(partida.ligaId)

    return success({ submetida: true, oficial: true, status: 'ENCERRADA' })
  } catch (err) {
    console.error('[sumula] erro ao submeter', err)
    return error('Erro ao submeter súmula', 500)
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    if (DEMO_SUMULA_TOKENS.has(token)) {
      return success({ salva: true, oficial: false, modoTeste: true, status: 'EM_ANDAMENTO' })
    }

    const access = await requireSumulaTokenAccess(token)
    if (access instanceof Response) return access

    const partida = access.partida
    if (partida.status === 'ENCERRADA') return error('Partida já encerrada', 400)

    const body = await req.json()
    const parsed = sumulaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { presencas, sets, ocorrencias, destaques } = parsed.data
    const validationError = validateSumulaPayload(partida, parsed.data, { requireMinimumPresencas: false })
    if (validationError) return error(validationError, 422)
    const liveSummary = buildLiveSummary(sets, partida.liga)

    await assertDb(supabase.from('SetPartida').delete().eq('partidaId', partida.id))
    if (sets.length > 0) {
      await assertDb(supabase.from('SetPartida').insert(sets.map((set) => ({ ...set, partidaId: partida.id }))))
    }

    await assertDb(supabase.from('SumulaPresenca').delete().eq('partidaId', partida.id))
    if (presencas.length > 0) {
      await assertDb(supabase
        .from('SumulaPresenca')
        .insert(presencas.map((presenca) => ({ ...presenca, partidaId: partida.id }))))
    }

    await assertDb(supabase.from('OcorrenciaPartida').delete().eq('partidaId', partida.id))
    if (ocorrencias?.length) {
      await assertDb(supabase.from('OcorrenciaPartida').insert(ocorrencias.map((ocorrencia) => ({ ...ocorrencia, partidaId: partida.id }))))
    }

    await assertDb(supabase.from('DestaquesPartida').delete().eq('partidaId', partida.id))
    if (destaques?.length) {
      await assertDb(supabase.from('DestaquesPartida').insert(destaques.map((destaque) => ({ ...destaque, partidaId: partida.id }))))
    }

    const { error: updateErr } = await supabase
      .from('Partida')
      .update({
        status: 'EM_ANDAMENTO',
        setsPorA: liveSummary.setsPorA,
        setsPorB: liveSummary.setsPorB,
        pontosPorA: liveSummary.pontosPorA,
        pontosPorB: liveSummary.pontosPorB,
      })
      .eq('id', partida.id)

    if (updateErr) throw updateErr
    await syncLeagueLifecycle(partida.ligaId)
    return success({ salva: true, oficial: false, status: 'EM_ANDAMENTO' })
  } catch (err) {
    console.error('[sumula] erro ao salvar andamento', err)
    return error('Erro ao salvar andamento da súmula', 500)
  }
}

function validateSumulaPayload(partida: any, payload: any, options: { requireMinimumPresencas: boolean }) {
  const equipeAId = Number(partida.equipeAId)
  const equipeBId = Number(partida.equipeBId)
  const jogadoresA = Array.isArray(partida.equipeA?.jogadores) ? partida.equipeA.jogadores : []
  const jogadoresB = Array.isArray(partida.equipeB?.jogadores) ? partida.equipeB.jogadores : []
  const jogadoresPorId = new Map<number, number>()

  jogadoresA.forEach((jogador: any) => jogadoresPorId.set(Number(jogador.id), equipeAId))
  jogadoresB.forEach((jogador: any) => jogadoresPorId.set(Number(jogador.id), equipeBId))

  const presencas = Array.isArray(payload.presencas) ? payload.presencas : []
  const presentesPorEquipe = new Map<number, Set<number>>([
    [equipeAId, new Set<number>()],
    [equipeBId, new Set<number>()],
  ])

  for (const presenca of presencas) {
    const jogadorId = Number(presenca.jogadorId)
    const equipeId = Number(presenca.equipeId)
    const equipeDoJogador = jogadoresPorId.get(jogadorId)
    if (!equipeDoJogador || ![equipeAId, equipeBId].includes(equipeId) || equipeDoJogador !== equipeId) {
      return 'A súmula possui atleta fora das equipes da partida.'
    }
    if (presenca.presente) presentesPorEquipe.get(equipeId)?.add(jogadorId)
  }

  if (options.requireMinimumPresencas) {
    if ((presentesPorEquipe.get(equipeAId)?.size ?? 0) < 6 || (presentesPorEquipe.get(equipeBId)?.size ?? 0) < 6) {
      return 'A súmula oficial exige pelo menos 6 atletas validados por equipe.'
    }
  }

  const numerosSet = new Set<number>()
  for (const set of payload.sets ?? []) {
    if (set.numero <= 0 || set.pontosA < 0 || set.pontosB < 0) return 'A súmula possui set com pontuação inválida.'
    if (numerosSet.has(set.numero)) return 'A súmula possui set duplicado.'
    numerosSet.add(set.numero)
  }

  for (const destaque of payload.destaques ?? []) {
    if (!jogadoresPorId.has(Number(destaque.jogadorId))) return 'A súmula possui destaque para atleta fora da partida.'
  }

  for (const ocorrencia of payload.ocorrencias ?? []) {
    if (ocorrencia.jogadorId != null && !jogadoresPorId.has(Number(ocorrencia.jogadorId))) {
      return 'A súmula possui ocorrência para atleta fora da partida.'
    }
  }

  return null
}

function buildLiveSummary(sets: Array<{ numero: number; pontosA: number; pontosB: number }>, liga: any) {
  const rules = getLiveRules(liga)
  const sortedSets = [...sets].sort((a, b) => Number(a.numero) - Number(b.numero))
  const latestSet = sortedSets[sortedSets.length - 1]
  const completedSets = sortedSets.slice(0, -1)
  let setsPorA = 0
  let setsPorB = 0

  for (const set of completedSets) {
    const maxScore = Math.max(set.pontosA, set.pontosB)
    const diff = Math.abs(set.pontosA - set.pontosB)
    const threshold = Number(set.numero) === rules.setsPerMatch ? rules.lastSetPoints : rules.pointsPerSet
    const isConfirmedByRule = maxScore >= threshold && diff >= 2
    if (!isConfirmedByRule) continue
    if (set.pontosA > set.pontosB) setsPorA += 1
    if (set.pontosB > set.pontosA) setsPorB += 1
  }

  return {
    setsPorA,
    setsPorB,
    pontosPorA: latestSet?.pontosA ?? 0,
    pontosPorB: latestSet?.pontosB ?? 0,
  }
}

function getLiveRules(liga: any) {
  const source = Array.isArray(liga) ? liga[0] : liga
  const pointsPerSet = readPositiveNumber(source, ['pontosPorSet', 'pontos_por_set', 'pontuacaoSet'], 21)
  const setsPerMatch = readPositiveNumber(source, ['setsPorPartida', 'sets_por_partida', 'sets'], 3)
  const tieBreakEnabled = readBoolean(source, ['tieBreakUltimoSet', 'tie_break_ultimo_set'], false)
  const lastSetPoints = tieBreakEnabled
    ? readPositiveNumber(source, ['pontosUltimoSet', 'pontos_ultimo_set'], 15)
    : pointsPerSet
  return { pointsPerSet, setsPerMatch, lastSetPoints }
}

function readPositiveNumber(source: any, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = Number(source?.[key])
    if (Number.isFinite(value) && value > 0) return Math.trunc(value)
  }
  return fallback
}

function readBoolean(source: any, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'boolean') return value
  }
  return fallback
}

function makeDemoPartida(token: string) {
  const jogadoresA = Array.from({ length: 8 }, (_, index) => ({
    id: 100 + index + 1,
    nome: `Jogador ${index + 1} - Set Point`,
    numero: index + 1,
    fotoRostoUrl: null,
    qrToken: `demo-setpoint-${index + 1}`,
  }))
  const jogadoresB = Array.from({ length: 8 }, (_, index) => ({
    id: 200 + index + 1,
    nome: `Jogador ${index + 1} - Libero FC`,
    numero: index + 1,
    fotoRostoUrl: null,
    qrToken: `demo-libero-${index + 1}`,
  }))

  return {
    id: 9001,
    rodada: 6,
    dataHora: '2026-08-15T14:00:00.000Z',
    localNome: 'Ginásio Municipal',
    status: 'AGENDADA',
    sumulaToken: token,
    sumulaTokenExpira: null,
    ligaId: 1,
    equipeAId: 101,
    equipeBId: 102,
    liga: {
      id: 1,
      nome: 'volei.space',
      slug: 'luv-2026',
      status: 'ATIVA',
    },
    equipeA: {
      id: 101,
      nome: 'Set Point',
      slug: 'set-point',
      jogadores: jogadoresA,
    },
    equipeB: {
      id: 102,
      nome: 'Líbero FC',
      slug: 'libero-fc',
      jogadores: jogadoresB,
    },
    sets: [],
    presencas: [],
    ocorrencias: [],
    destaques: [],
    escala: [],
  }
}
