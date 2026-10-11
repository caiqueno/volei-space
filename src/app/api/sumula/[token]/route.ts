import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { success, error } from '@/lib/api-response'
import { sumulaSchema } from '@/lib/schemas'
import { recalculateLeagueClassification, syncLeagueLifecycle } from '@/lib/championship-operations'
import { requireSumulaLeitura, requireSumulaTokenAccess } from '@/lib/sumula-access'
import { requireArbitroPartidaAccess } from '@/lib/arbitro-access'
import { rejectIfCampeonatoFinalizado } from '@/lib/championship-finalization'
import { regrasParaFase, validateCategoryProgress, validateCategoryResult, type CategoryMatchRules } from '@/lib/category-match-rules'
import { carregarFonteDeSets, regrasEfetivasDaPartida } from '@/lib/regras-da-partida'
import { validarLiberoDaSumula } from '@/lib/libero-sumula'
import { validarSaquesIniciais } from '@/lib/saque-inicial'
import { mensagemSancaoInvalida } from '@/lib/sancoes'
import { mensagemDeSuspensao } from '@/lib/sancoes-partida'
import { motivoMinimoAtletas } from '@/lib/presenca-oficial'
import { anexarNumerosHerdados } from '@/lib/numero-herdado-leitura'
import { correcaoPeloLinkPermitida, limiteDeSubstituicoes, validarSubstituicoes } from '@/lib/sumula-regras'
import { AndamentoSuperado, gravarSumulaComRestauracao, liberarAndamento, reservarAndamento } from '@/lib/sumula-gravacao'
import { ocorrenciaOperacional } from '@/lib/sumula-sessao'
import { MENSAGEM_SUMULA_SEM_TIMES, timesDefinidos } from '@/lib/vaga-a-definir'
import { sincronizarVagasDaPartida } from '@/lib/preencher-vagas'

const DEMO_SUMULA_TOKENS = new Set(['token-demo-1-luva2026', 'token-demo-1-luv2026'])

function demoSumulaLiberado(token: string) {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview') return false
  return DEMO_SUMULA_TOKENS.has(token)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (demoSumulaLiberado(token)) {
    return success(makeDemoPartida(token))
  }

  const access = await requireSumulaTokenAccess(token)
  if (access instanceof Response) return access
  await anexarNumerosHerdados(access.partida)
  const fonte = await carregarFonteDeSets(access.partida)
  const liga = Array.isArray(access.partida.liga) ? access.partida.liga[0] ?? {} : access.partida.liga ?? {}
  access.partida.liga = { ...liga, ...fonte }
  // Consulta pública da página /sumula/{token}. A projeção tira documento, telefone e e-mail.
  // O GET sem ?consulta=1 continua passando por requireSumulaLeitura.
  if (new URL(req.url).searchParams.get('consulta') === '1') {
    return success(sumulaParaConsulta(access.partida))
  }
  const leitura = await requireSumulaLeitura(req, access.partida)
  if (leitura) return leitura
  return success(access.partida)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  try {
    if (demoSumulaLiberado(token)) {
      return success({ submetida: true, oficial: false, modoTeste: true, status: 'ENCERRADA', publico: '/partidas/9001/ao-vivo' })
    }

    const access = await requireArbitroPartidaAccess(req, token)
    if (access instanceof Response) return access

    const partida = access.partida
    if (!timesDefinidos(partida)) return error(MENSAGEM_SUMULA_SEM_TIMES, 422)
    const publico = `/partidas/${partida.id}/ao-vivo`
    const agora = new Date()
    if (partida.sumulaAprovadaEm && !correcaoPeloLinkPermitida(partida.sumulaAprovadaEm, agora)) {
      return error('O prazo de 30 minutos para corrigir esta súmula pelo link já encerrou. Depois disso, só o organizador do campeonato pode corrigir.', 403)
    }
    const bloqueio = await rejectIfCampeonatoFinalizado(Number(partida.ligaId))
    if (bloqueio) return bloqueio

    const body = await req.json()
    const parsed = sumulaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    const { presencas, sets, ocorrencias, destaques } = parsed.data
    const fonteOficial = await carregarFonteDeSets(partida)
    const validationError = validateSumulaPayload(partida, parsed.data, {
      requireMinimumPresencas: !campeonatoDeSimulacao(partida),
      limiteSubstituicoes: limiteDeSubstituicoes(fonteOficial.limiteSubstituicoesPorSet),
      substituicaoPorLesao: fonteOficial.substituicaoPorLesao === true,
      setsPorPartida: regrasParaFase(fonteOficial, partida.fase).setsPorPartida,
    })
    if (validationError) return error(validationError, 422)
    const suspenso = await mensagemDeSuspensao(partida, presencas)
    if (suspenso) return error(suspenso, 422)
    if (sets.length === 0) return error('A súmula só pode ser enviada com pelo menos um set registrado.', 422)
    const mvp = (destaques ?? []).find((item) => item.tipo === 'MVP' && item.jogadorId)
    if (!mvp?.jogadorId) return error('Escolha o MVP antes de oficializar a súmula.', 422)
    const setsA = sets.filter((set) => set.pontosA > set.pontosB).length
    const setsB = sets.filter((set) => set.pontosB > set.pontosA).length
    if (setsA === setsB) return error('A partida precisa de uma equipe vencedora antes do MVP.', 422)
    const equipeVencedoraId = setsA > setsB ? Number(partida.equipeAId) : Number(partida.equipeBId)
    const { data: atletaMvp } = await supabase.from('Jogador').select('equipeId').eq('id', mvp.jogadorId).maybeSingle()
    if (!atletaMvp || Number(atletaMvp.equipeId) !== equipeVencedoraId) {
      return error('O MVP precisa ser um atleta da equipe vencedora.', 422)
    }
    const regra = await regrasEfetivasDaPartida(partida)
    const placarInvalido = validateCategoryResult(sets, regra)
    if (placarInvalido) return error(placarInvalido, 422)

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

    const instante = agora.toISOString()
    const correcao = Boolean(partida.sumulaAprovadaEm)
    await gravarSumulaComRestauracao({
      partidaId: partida.id,
      sets,
      presencas,
      ocorrencias,
      destaques,
      arbitroId: access.candidatura.arbitroId,
      partida: {
        status: 'ENCERRADA',
        setsPorA,
        setsPorB,
        pontosPorA,
        pontosPorB,
        vencedorId,
        sumulaSubmetidaEm: partida.sumulaSubmetidaEm ?? instante,
        ...(correcao ? {} : { sumulaAprovadaEm: instante }),
      },
    })
    await concluirPublicacao(partida.ligaId)
    await preencherVagasDaPartida(partida)

    return success({ submetida: true, oficial: true, status: 'ENCERRADA', publico })
  } catch (err) {
    console.error('[sumula] erro ao submeter', err)
    return error('Erro ao submeter súmula', 500)
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let reservaId: number | null = null
  let gravou = false
  try {
    if (demoSumulaLiberado(token)) {
      return success({ salva: true, oficial: false, modoTeste: true, status: 'EM_ANDAMENTO' })
    }

    const access = await requireArbitroPartidaAccess(req, token)
    if (access instanceof Response) return access

    const partida = access.partida
    if (!timesDefinidos(partida)) return error(MENSAGEM_SUMULA_SEM_TIMES, 422)
    if (partida.status === 'ENCERRADA') return error('Partida já encerrada', 400)
    const bloqueio = await rejectIfCampeonatoFinalizado(Number(partida.ligaId))
    if (bloqueio) return bloqueio

    const body = await req.json()
    const parsed = sumulaSchema.safeParse(body)
    if (!parsed.success) return error('Dados inválidos', 422, parsed.error.flatten())

    reservaId = await reservarAndamento(partida.id)
    const { presencas, sets, ocorrencias, destaques, versao } = parsed.data
    const fonteAndamento = await carregarFonteDeSets(partida)
    const validationError = validateSumulaPayload(partida, parsed.data, {
      requireMinimumPresencas: false,
      limiteSubstituicoes: limiteDeSubstituicoes(fonteAndamento.limiteSubstituicoesPorSet),
      substituicaoPorLesao: fonteAndamento.substituicaoPorLesao === true,
      setsPorPartida: regrasParaFase(fonteAndamento, partida.fase).setsPorPartida,
    })
    if (validationError) return error(validationError, 422)
    const suspenso = await mensagemDeSuspensao(partida, presencas)
    if (suspenso) return error(suspenso, 422)
    const regraAndamento = await regrasEfetivasDaPartida(partida)
    const andamentoInvalido = validateCategoryProgress(sets, regraAndamento)
    if (andamentoInvalido) return error(andamentoInvalido, 422)
    const liveSummary = buildLiveSummary(sets, regraAndamento)

    await gravarSumulaComRestauracao({
      partidaId: partida.id,
      sets,
      presencas,
      ocorrencias,
      destaques,
      arbitroId: access.candidatura.arbitroId,
      versao,
      reservaId,
      partida: {
        status: 'EM_ANDAMENTO',
        setsPorA: liveSummary.setsPorA,
        setsPorB: liveSummary.setsPorB,
        pontosPorA: liveSummary.pontosPorA,
        pontosPorB: liveSummary.pontosPorB,
      },
    })
    gravou = true
    await syncLeagueLifecycle(partida.ligaId)
    const setsMudaram = Number(partida.setsPorA ?? 0) !== liveSummary.setsPorA
      || Number(partida.setsPorB ?? 0) !== liveSummary.setsPorB
    const iniciouAgora = String(partida.status ?? '').toUpperCase() !== 'EM_ANDAMENTO'
    if (setsMudaram || iniciouAgora) {
      try {
        await recalculateLeagueClassification(partida.ligaId)
      } catch (err) {
        console.error('[sumula] andamento gravado; classificação não recalculada', err)
      }
    }
    return success({ salva: true, oficial: false, status: 'EM_ANDAMENTO' })
  } catch (err) {
    if (err instanceof AndamentoSuperado) return error(err.message, 409)
    console.error('[sumula] erro ao salvar andamento', err)
    return error('Erro ao salvar andamento da súmula', 500)
  } finally {
    if (reservaId != null && !gravou) {
      await liberarAndamento(reservaId).catch((erro) => {
        console.error('[sumula] falha ao liberar reserva de andamento', erro)
      })
    }
  }
}

async function preencherVagasDaPartida(partida: { id?: number | null; ligaId?: number | null; categoriaCampeonatoId?: string | null }) {
  try {
    await sincronizarVagasDaPartida(partida)
  } catch (err) {
    console.error('[vaga] resultado gravado; vagas não preenchidas', err)
  }
}

async function concluirPublicacao(ligaId: number) {
  try {
    await recalculateLeagueClassification(ligaId)
  } catch (err) {
    console.error('[sumula] súmula gravada; classificação não recalculada', err)
  }
  try {
    await syncLeagueLifecycle(ligaId)
  } catch (err) {
    console.error('[sumula] súmula gravada; ciclo do campeonato não atualizado', err)
  }
}

function valorUnico<T>(valor: T | T[] | null | undefined) {
  return Array.isArray(valor) ? valor[0] ?? null : valor ?? null
}

function jogadorConsulta(jogador: any) {
  const item = valorUnico(jogador)
  if (!item) return null
  return {
    id: item.id,
    nome: item.nome,
    numero: item.numero ?? null,
    posicao: item.posicao ?? null,
    numeroHerdado: item.numeroHerdado ?? null,
  }
}

function equipeConsulta(equipe: any) {
  const item = valorUnico(equipe)
  if (!item) return null
  return {
    id: item.id,
    nome: item.nome,
    logoUrl: item.logoUrl ?? null,
    corHex: item.corHex ?? null,
    jogadores: (item.jogadores ?? []).map(jogadorConsulta).filter(Boolean),
  }
}

function sumulaParaConsulta(partida: any) {
  const liga = valorUnico(partida.liga)
  return {
    id: partida.id,
    ligaId: partida.ligaId,
    rodada: partida.rodada,
    status: partida.status,
    categoria: partida.categoria,
    dataHora: partida.dataHora,
    localNome: partida.localNome,
    setsPorA: partida.setsPorA,
    setsPorB: partida.setsPorB,
    pontosPorA: partida.pontosPorA,
    pontosPorB: partida.pontosPorB,
    vencedorId: partida.vencedorId,
    sumulaAprovadaEm: partida.sumulaAprovadaEm,
    liga: liga ? { id: liga.id, nome: liga.nome } : null,
    equipeA: equipeConsulta(partida.equipeA),
    equipeB: equipeConsulta(partida.equipeB),
    sets: [...(partida.sets ?? [])].sort((a: { numero: number }, b: { numero: number }) => Number(a.numero) - Number(b.numero)),
    presencas: (partida.presencas ?? []).map((item: any) => ({
      id: item.id,
      presente: item.presente,
      equipeId: item.equipeId,
      jogadorId: item.jogadorId,
      numero: item.numero ?? null,
      jogador: jogadorConsulta(item.jogador),
    })),
    ocorrencias: [...(partida.ocorrencias ?? [])]
      .filter((item: { tipo?: string | null; descricao?: string | null }) => !ocorrenciaOperacional(item))
      .map((item: any) => ({ id: item.id, tipo: item.tipo, descricao: item.descricao, set: item.set, jogadorId: item.jogadorId ?? null }))
      .sort((a: { id: number }, b: { id: number }) => Number(a.id) - Number(b.id)),
    destaques: (partida.destaques ?? []).map((item: any) => ({ id: item.id, tipo: item.tipo, jogador: jogadorConsulta(item.jogador) })),
    escala: (partida.escala ?? []).map((item: any) => {
      const arbitro = valorUnico(item.arbitro)
      return { id: item.id, cargo: item.cargo, arbitro: arbitro ? { nome: arbitro.nome } : null }
    }),
  }
}

function campeonatoDeSimulacao(partida: any) {
  const liga = Array.isArray(partida?.liga) ? partida.liga[0] : partida?.liga
  return liga?.simulacao === true
}

function validateSumulaPayload(partida: any, payload: any, options: { requireMinimumPresencas: boolean; limiteSubstituicoes?: number; substituicaoPorLesao?: boolean; setsPorPartida?: number }) {
  const equipeAId = Number(partida.equipeAId)
  const equipeBId = Number(partida.equipeBId)
  const jogadoresA = Array.isArray(partida.equipeA?.jogadores) ? partida.equipeA.jogadores : []
  const jogadoresB = Array.isArray(partida.equipeB?.jogadores) ? partida.equipeB.jogadores : []
  const jogadoresPorId = new Map<number, number>()

  jogadoresA.forEach((jogador: any) => jogadoresPorId.set(Number(jogador.id), equipeAId))
  jogadoresB.forEach((jogador: any) => jogadoresPorId.set(Number(jogador.id), equipeBId))

  const presencas = Array.isArray(payload.presencas) ? payload.presencas : []

  for (const presenca of presencas) {
    const jogadorId = Number(presenca.jogadorId)
    const equipeId = Number(presenca.equipeId)
    const equipeDoJogador = jogadoresPorId.get(jogadorId)
    if (!equipeDoJogador || ![equipeAId, equipeBId].includes(equipeId) || equipeDoJogador !== equipeId) {
      return 'A súmula possui atleta fora das equipes da partida.'
    }
  }

  if (options.requireMinimumPresencas) {
    const equipeA = valorUnico(partida.equipeA)
    const equipeB = valorUnico(partida.equipeB)
    const motivo = motivoMinimoAtletas({
      equipeAId,
      equipeBId,
      equipes: [
        { id: equipeAId, nome: equipeA?.nome },
        { id: equipeBId, nome: equipeB?.nome },
      ],
      atletas: [
        ...jogadoresA.map((jogador: { id: number; numero?: unknown }) => ({ id: Number(jogador.id), equipeId: equipeAId, numero: jogador.numero })),
        ...jogadoresB.map((jogador: { id: number; numero?: unknown }) => ({ id: Number(jogador.id), equipeId: equipeBId, numero: jogador.numero })),
      ],
      presencas,
      ocorrencias: payload.ocorrencias,
    })
    if (motivo) return motivo
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

  const sancaoInvalida = mensagemSancaoInvalida(payload.ocorrencias)
  if (sancaoInvalida) return sancaoInvalida

  const equipeA = valorUnico(partida.equipeA)
  const equipeB = valorUnico(partida.equipeB)
  const substituicoesInvalidas = validarSubstituicoes({
    ocorrencias: payload.ocorrencias,
    equipes: [
      { id: equipeAId, nome: equipeA?.nome },
      { id: equipeBId, nome: equipeB?.nome },
    ],
    jogadorEquipe: jogadoresPorId,
    limite: options.limiteSubstituicoes,
    substituicaoPorLesao: options.substituicaoPorLesao === true,
  })
  if (substituicoesInvalidas) return substituicoesInvalidas

  const liberoAusente = validarLiberoDaSumula()
  if (liberoAusente) return liberoAusente

  return validarSaquesIniciais(payload.ocorrencias, {
    teamA: String(equipeA?.nome ?? ''),
    teamB: String(equipeB?.nome ?? ''),
  }, options.setsPorPartida)
}

function buildLiveSummary(sets: Array<{ numero: number; pontosA: number; pontosB: number }>, rules: CategoryMatchRules) {
  const sortedSets = [...sets].sort((a, b) => Number(a.numero) - Number(b.numero))
  const latestSet = sortedSets[sortedSets.length - 1]
  let setsPorA = 0
  let setsPorB = 0

  for (const set of sortedSets) {
    const maxScore = Math.max(set.pontosA, set.pontosB)
    const diff = Math.abs(set.pontosA - set.pontosB)
    const threshold = Number(set.numero) === rules.setsPorPartida && rules.tieBreakUltimoSet ? Number(rules.pontosUltimoSet) : Number(rules.pontosPorSet)
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

function makeDemoPartida(token: string) {
  const jogadoresA = Array.from({ length: 11 }, (_, index) => ({
    id: 100 + index + 1,
    nome: `Jogador ${index + 1} - Set Point`,
    numero: index + 1,
    posicao: index === 7 ? 'LB' : null,
    fotoRostoUrl: null,
    qrToken: `demo-setpoint-${index + 1}`,
  }))
  const jogadoresB = Array.from({ length: 11 }, (_, index) => ({
    id: 200 + index + 1,
    nome: `Jogador ${index + 1} - Libero FC`,
    numero: index + 1,
    posicao: index === 7 ? 'LB' : null,
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
      logoUrl: '/images/equipes/rs.webp',
      corHex: '#1d4ed8',
      jogadores: jogadoresA,
    },
    equipeB: {
      id: 102,
      nome: 'Líbero FC',
      slug: 'libero-fc',
      logoUrl: null,
      corHex: '#b45309',
      jogadores: jogadoresB,
    },
    sets: [],
    presencas: [],
    ocorrencias: [],
    destaques: [],
    escala: [],
  }
}
