'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { QuadraVolei } from '@/components/sumula/QuadraVolei'
import { escalacaoParaJogo } from '@/lib/escalacao-inicial'
import { numeroMvpDaLista } from '@/lib/numero-camisa-partida'
import { ladosInvertidosNoPonto, placarNaOrientacao } from '@/lib/placar-orientacao'
import { agendaDaPartida } from '@/lib/format-partida'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'
import { reconstruirHistoricoPontos } from '@/lib/desfazer-ponto-sumula'
import { ehPontoSemJogador, lerJogadorPonto, lerRotuloPonto, resumirPontos, ROTULO_PONTO, textoPonto, textoPontoSemJogador, textoResumoScout, type OrigemPonto } from '@/lib/ponto-sumula'
import { regrasVisiveis } from '@/lib/category-match-rules'
import { LIMITE_SUBSTITUICOES_POR_SET, aplicarSubstituicao, controleVazio, limiteDeSubstituicoes, mensagemFalhaSubstituicao, numerosDaTroca, reservasElegiveis, textoAvisoSubstituicao, type ControleSubstituicao } from '@/lib/sumula-regras'
import { mensagemRodizioIlegal } from '@/lib/rodizio-sumula'
import { ehTempoDeEquipe, limiteDeTempos, textoTempoEquipe, textoTempoTecnico } from '@/lib/tempos-sumula'
import { textoSubstituicaoLesao, textoTempoMedico } from '@/lib/lesao-sumula'
import { quantidadeDeLiberos } from '@/lib/libero-sumula'
import { ladoOposto, marcarSaqueInicial, modoSaqueInicial, saqueObrigatorio, sortearLado } from '@/lib/saque-inicial'
import { transicaoAoEncerrarSet } from '@/lib/troca-set'
import {
  AlertCircle,
  Award,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileCheck2,
  HelpCircle,
  Menu,
  MessageSquare,
  QrCode,
  Pencil,
  RefreshCw,
  Repeat2,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Trophy,
  Users,
} from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'
import { AvisosSumula, useAvisosSumula } from '@/components/sumula/AvisosSumula'
import { AVISO_INICIO_SEM_SINCRONISMO, tokenDeDemonstracao } from '@/lib/sumula-toasts'
import { TEXTO_AGUARDANDO_OFICIALIZACAO, confirmarPapeletas, partidaEncerradaNaSessao } from '@/lib/sumula-sessao'
import { SumulaSubShell } from '@/components/sumula/SumulaSubShell'
import { VolleyballBurst } from '@/components/ui/VolleyballBurst'
import './sumula-micro.css'

type TeamId = 'teamA' | 'teamB'
type TabId = 'pre' | 'resumo' | 'pontuacao' | 'escalacao' | 'tempos' | 'anotacoes'
type EventType = 'point' | 'attack' | 'block' | 'ace' | 'timeout' | 'substitution' | 'injury_substitution' | 'libero_exchange' | 'anotacao' | 'set_start' | 'set_end' | 'system'

type Player = {
  id: number
  number: string
  name: string
  status: string
  position?: string | null
  isLibero?: boolean
  photoUrl?: string | null
}

type Team = {
  id: TeamId
  dbId: number
  name: string
  players: Player[]
  reserves: Player[]
}

type MatchEvent = {
  id: string
  type: EventType
  text: string
  time: string
  set: number
  score: string
  teamId?: TeamId
  jogadorId?: number
}

type PendingQrValidation = {
  teamId: TeamId
  teamName: string
  number: string
  name: string
  photoUrl?: string | null
}

type SetScore = {
  teamA: number
  teamB: number
  winner?: TeamId
  confirmed: boolean
}

type MatchRules = {
  pointsPerSet: number
  setsPerMatch: number
  setsToWin: number
  lastSetPoints: number
  exigeTodosOsSets: boolean
  substitutionLimit: number
  alertaRodizio: boolean
  timeoutLimit: number
  temposSeparados: boolean
  tempoMedico: boolean
  substituicaoPorLesao: boolean
  exigirLiberoInicial: boolean
  quantidadeLiberos: 1 | 2 | null
}

type SetEndPrompt = {
  winner: TeamId
  score: { teamA: number; teamB: number }
  matchPoint: boolean
}

type Anotacao = {
  id: string
  tipo: string
  equipeRelacionada: string
  pessoaRelacionada: string
  set: number
  placar: string
  descricao: string
  timestamp: string
}

const tabs: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: 'pre', label: 'Pré-partida', icon: <QrCode size={16} /> },
  { id: 'resumo', label: 'Resumo', icon: <ClipboardList size={16} /> },
  { id: 'pontuacao', label: 'Pontuação', icon: <Trophy size={16} /> },
  { id: 'escalacao', label: 'Escalação', icon: <Users size={16} /> },
  { id: 'tempos', label: 'Tempos', icon: <Clock size={16} /> },
  { id: 'anotacoes', label: 'Anotações', icon: <MessageSquare size={16} /> },
]

const noteTypes = ['Observação', 'Cartão vermelho', 'Cartão amarelo', 'Sanção', 'Lesão', 'Atraso', 'Correção', 'W.O.', 'Conduta irregular', 'Problema de quadra', 'Outro']

export default function SumulaPage() {
  const { token } = useParams<{ token: string }>()
  const [partida, setPartida] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [falha, setFalha] = useState('Não foi possível abrir a súmula.')
  const [tentativa, setTentativa] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [linkPublico, setLinkPublico] = useState('')
  const [erroOficial, setErroOficial] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [vistaQuadra, setVistaQuadra] = useState<'2d' | '3d'>('3d')
  const [activeTab, setActiveTab] = useState<TabId>('pre')
  const [matchStatus, setMatchStatus] = useState<'pre-game' | 'live' | 'finished'>('pre-game')
  const [currentSet, setCurrentSet] = useState(1)
  const [currentScore, setCurrentScore] = useState({ teamA: 0, teamB: 0 })
  const [setsWon, setSetsWon] = useState({ teamA: 0, teamB: 0 })
  const [setScores, setSetScores] = useState<SetScore[]>([
    { teamA: 0, teamB: 0, confirmed: false },
    { teamA: 0, teamB: 0, confirmed: false },
    { teamA: 0, teamB: 0, confirmed: false },
  ])
  const [servingTeamId, setServingTeamId] = useState<TeamId>('teamA')
  const [serverIndexA, setServerIndexA] = useState(5)
  const [serverIndexB, setServerIndexB] = useState(5)
  const [lineupA, setLineupA] = useState<string[]>([])
  const [lineupB, setLineupB] = useState<string[]>([])
  const [benchA, setBenchA] = useState<string[]>([])
  const [benchB, setBenchB] = useState<string[]>([])
  const [validatedA, setValidatedA] = useState<string[]>([])
  const [validatedB, setValidatedB] = useState<string[]>([])
  const [captA, setCaptA] = useState('')
  const [captB, setCaptB] = useState('')
  const [tossWinnerTeamId, setTossWinnerTeamId] = useState<TeamId | null>(null)
  const [tossDecision, setTossDecision] = useState<'SAQUE' | 'RECEPCAO' | ''>('')
  const [initialServerBySet, setInitialServerBySet] = useState<Record<number, TeamId | null>>({})
  const [showStartMatchConfirm, setShowStartMatchConfirm] = useState(false)
  const [lineupConfirmedA, setLineupConfirmedA] = useState(false)
  const [lineupConfirmedB, setLineupConfirmedB] = useState(false)
  const lineupConfirmed = lineupConfirmedA && lineupConfirmedB
  const [startingLiberos, setStartingLiberos] = useState<Record<number, Record<TeamId, string>>>({})
  const [timeoutsUsedA, setTimeoutsUsedA] = useState(0)
  const [timeoutsUsedB, setTimeoutsUsedB] = useState(0)
  const [temposEquipeA, setTemposEquipeA] = useState(0)
  const [temposEquipeB, setTemposEquipeB] = useState(0)
  const [events, setEvents] = useState<MatchEvent[]>([])
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([])
  const [scoreHistory, setScoreHistory] = useState<Array<{ score: { teamA: number; teamB: number }; servingTeamId: TeamId; serverIndexA: number; serverIndexB: number; lineupA: string[]; lineupB: string[]; eventIds: string[] }>>([])
  const [matchNumberOverrides, setMatchNumberOverrides] = useState<Record<TeamId, Record<number, string>>>({ teamA: {}, teamB: {} })
  const { avisos, addToast } = useAvisosSumula()
  const [pointFlash, setPointFlash] = useState<{ teamId: TeamId; number: string; id: number } | null>(null)
  const [setEndPrompt, setSetEndPrompt] = useState<SetEndPrompt | null>(null)
  const [mvpId, setMvpId] = useState('')
  const [editingSlot, setEditingSlot] = useState<{ teamId: TeamId; index: number } | null>(null)
  const [subModal, setSubModal] = useState<{ teamId: TeamId; index: number; outNumber: string } | null>(null)
  const [controleSubstituicao, setControleSubstituicao] = useState<Record<number, Record<TeamId, ControleSubstituicao>>>({})
  const [sidesInverted, setSidesInverted] = useState(false)
  const [falhaSalvamento, setFalhaSalvamento] = useState<string | null>(null)
  const [confirmarOficial, setConfirmarOficial] = useState(false)
  const liveSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [formacaoVersao, setFormacaoVersao] = useState(0)
  const finalSubmitRef = useRef(false)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setNotFound(false)
    fetch(`/api/sumula/${token}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'Não foi possível abrir a súmula.')
        return json
      })
      .then((json) => {
        if (!ativo) return
        const data = json.data
        if (!data?.equipeA?.id || !data?.equipeB?.id) {
          const vagaA = String(data?.origemVagaA ?? data?.equipeA?.nome ?? 'A definir')
          const vagaB = String(data?.origemVagaB ?? data?.equipeB?.nome ?? 'A definir')
          throw new Error(`A súmula não pode iniciar enquanto os times não estiverem definidos. ${vagaA} × ${vagaB}.`)
        }
        const teamA = makeTeam('teamA', data.equipeA)
        const teamB = makeTeam('teamB', data.equipeB)
        const loadedRules = getMatchRules(data.liga, data.fase)
        const savedSets = [...(data.sets ?? [])].sort((a: any, b: any) => a.numero - b.numero)
        const savedOccurrences = data.ocorrencias ?? []
        const savedPresence = data.presencas ?? []
        const restored = restoreSavedMatchState(data, savedSets, savedOccurrences, savedPresence, loadedRules)
        const restoredPreMatch = parseSavedPreMatchRecords(savedOccurrences, teamA, teamB)

        setPartida(data)
        const savedRotation = parseSavedRotationState(savedOccurrences, restored.currentSet)
        const preJogo = restored.matchStatus === 'pre-game'
        const initialLineupA = escalacaoParaJogo(savedRotation?.lineupA, getDefaultLineupNumbers(teamA), preJogo)
        const initialLineupB = escalacaoParaJogo(savedRotation?.lineupB, getDefaultLineupNumbers(teamB), preJogo)
        setLineupA(initialLineupA)
        setLineupB(initialLineupB)
        setBenchA(getBenchNumbers(teamA, initialLineupA, restored.startingLiberos[restored.currentSet]?.teamA))
        setBenchB(getBenchNumbers(teamB, initialLineupB, restored.startingLiberos[restored.currentSet]?.teamB))
        setCaptA(restoredPreMatch.captA)
        setCaptB(restoredPreMatch.captB)
        setTossWinnerTeamId(restoredPreMatch.tossWinnerTeamId)
        setTossDecision(restoredPreMatch.tossDecision)
        const restoredInitialServerBySet = parseSavedInitialServerBySet(savedOccurrences, teamA, teamB)
        setInitialServerBySet(restoredInitialServerBySet)
        if (restored.matchStatus !== 'pre-game') {
          setServingTeamId(savedRotation?.servingTeamId ?? restoredInitialServerBySet[restored.currentSet] ?? 'teamA')
          setServerIndexA(5)
          setServerIndexB(5)
        }

        setSetScores(restored.setScores)
        setCurrentSet(restored.currentSet)
        setCurrentScore(restored.currentScore)
        setSetsWon(restored.setsWon)
        setMatchStatus(restored.matchStatus)
        setActiveTab(restored.activeTab)
        setStartingLiberos(restored.startingLiberos)
        const restoredLineupConfirmations = restoreLineupConfirmations(savedOccurrences, teamA, teamB, restored.currentSet)
        setLineupConfirmedA(restored.lineupConfirmed || restoredLineupConfirmations.teamA)
        setLineupConfirmedB(restored.lineupConfirmed || restoredLineupConfirmations.teamB)
        const restoredTimeouts = countSavedTimeouts(savedOccurrences, teamA, teamB, restored.currentSet)
        setTimeoutsUsedA(restoredTimeouts.teamA)
        setTimeoutsUsedB(restoredTimeouts.teamB)
        const restoredEquipe = countSavedTemposEquipe(savedOccurrences, teamA, teamB, restored.currentSet)
        setTemposEquipeA(restoredEquipe.teamA)
        setTemposEquipeB(restoredEquipe.teamB)
        const numerosDaPartida = restoreMatchNumberOverrides(teamA, teamB, savedPresence)
        setControleSubstituicao(restoreControleSubstituicao(savedOccurrences, teamA, teamB, numerosDaPartida, loadedRules.substitutionLimit))
        const destaqueMvp = (data.destaques ?? []).find((item: { tipo?: string; jogadorId?: number | null }) => item.tipo === 'MVP' && item.jogadorId)
        if (destaqueMvp?.jogadorId) setMvpId(String(destaqueMvp.jogadorId))
        setSidesInverted(countSavedSideInversions(savedOccurrences) % 2 === 1)

        setValidatedA(teamA.players.concat(teamA.reserves).filter((player) => savedPresence.some((p: any) => p.jogadorId === player.id && p.presente)).map((p) => p.number))
        setValidatedB(teamB.players.concat(teamB.reserves).filter((player) => savedPresence.some((p: any) => p.jogadorId === player.id && p.presente)).map((p) => p.number))
        setMatchNumberOverrides(numerosDaPartida)
        const eventosRestaurados = savedOccurrences.filter((o: any) => !String(o.descricao ?? '').startsWith('Registro de ')).map((o: any) => {
          const salvo = partirDescricaoSalva(String(o.descricao ?? 'Ocorrência registrada'))
          const jogadorId = o.jogadorId ?? undefined
          return {
            id: `saved-${o.id}`,
            type: normalizeSavedEventType(o.tipo),
            text: salvo.text,
            time: salvo.time,
            set: o.set ?? 1,
            score: salvo.score,
            teamId: equipeDoJogador(teamA, teamB, jogadorId) ?? equipeMencionada(salvo.text, teamA, teamB),
            jogadorId,
          }
        })
        setEvents(eventosRestaurados)
        setScoreHistory(reconstruirHistoricoPontos({
          eventos: eventosRestaurados,
          setAtual: restored.currentSet,
          saqueAtual: savedRotation?.servingTeamId ?? restoredInitialServerBySet[restored.currentSet] ?? 'teamA',
          escalacaoA: initialLineupA,
          escalacaoB: initialLineupB,
          nomeA: teamA.name,
          nomeB: teamB.name,
        }))
        if (!ativo) return
        setLoading(false)
      })
      .catch((err) => {
        if (!ativo) return
        const rede = err instanceof TypeError
        setFalha(rede ? 'Falha de conexão. Tente novamente.' : (err instanceof Error && err.message ? err.message : 'Não foi possível abrir a súmula.'))
        setNotFound(true)
        setLoading(false)
      })
    return () => { ativo = false }
  }, [token, tentativa])

  const teamA = useMemo(() => partida ? makeTeam('teamA', partida.equipeA) : null, [partida])
  const teamB = useMemo(() => partida ? makeTeam('teamB', partida.equipeB) : null, [partida])
  const jogadoresVencedores = useMemo(() => {
    if (!teamA || !teamB || setsWon.teamA === setsWon.teamB) return []
    const vencedora = setsWon.teamA > setsWon.teamB ? teamA : teamB
    return [...vencedora.players, ...vencedora.reserves]
  }, [teamA, teamB, setsWon])
  const matchRules = useMemo(() => getMatchRules(partida?.liga, partida?.fase), [partida?.liga, partida?.fase])

  function getMatchNumber(teamId: TeamId, number: string) {
    const team = teamId === 'teamA' ? teamA : teamB
    const player = team ? getAnyPlayer(team, number) : null
    if (!player) return number
    return matchNumberOverrides[teamId]?.[player.id] || player.number
  }

  function updateMatchNumber(teamId: TeamId, rosterNumber: string, value: string) {
    const team = teamId === 'teamA' ? teamA : teamB
    const player = team ? getAnyPlayer(team, rosterNumber) : null
    if (!team || !player) return
    const sanitized = value.replace(/[^\dA-Za-z-]/g, '').slice(0, 4)
    const effectiveNumber = sanitized || player.number
    const isDuplicate = [...team.players, ...team.reserves].some((other) => (
      other.id !== player.id && getMatchNumber(teamId, other.number) === effectiveNumber
    ))
    if (isDuplicate) {
      addToast(`Já existe um atleta com o número ${effectiveNumber} nesta equipe.`)
      return
    }
    setMatchNumberOverrides((current) => {
      const teamOverrides = { ...(current[teamId] ?? {}) }
      if (sanitized) teamOverrides[player.id] = sanitized
      else delete teamOverrides[player.id]
      return { ...current, [teamId]: teamOverrides }
    })
  }

  const preGameValidated = Boolean(teamA && teamB && validatedA.length >= 6 && validatedB.length >= 6)
  const stepChecklist = {
    loaded: true,
    conferido: preGameValidated,
    capitaes: Boolean(captA && captB),
    sorteio: Boolean(initialServerBySet[currentSet]),
    saque: Boolean(initialServerBySet[currentSet]),
    escalacao: lineupConfirmed,
  }

  function scoreString(score = currentScore) {
    return `${score.teamA.toString().padStart(2, '0')} x ${score.teamB.toString().padStart(2, '0')}`
  }

  function addMatchEvent(type: EventType, text: string, teamId?: TeamId, scoreOverride?: { teamA: number; teamB: number }, jogadorId?: number) {
    const item: MatchEvent = {
      id: `ev-${Date.now()}-${Math.random()}`,
      type,
      text,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      set: currentSet,
      score: scoreString(scoreOverride),
      teamId,
      jogadorId,
    }
    setEvents((current) => [item, ...current])
    return item.id
  }

  useEffect(() => {
    const salva = window.localStorage.getItem('volei-quadra-vista')
    if (salva === '2d' || salva === '3d') setVistaQuadra(salva)
  }, [])

  function escolherVista(vista: '2d' | '3d') {
    setVistaQuadra(vista)
    window.localStorage.setItem('volei-quadra-vista', vista)
  }

  function toggleSidesInverted() {
    setSidesInverted((current) => !current)
    addMatchEvent('anotacao', 'Equipes inverteram os lados da quadra.')
  }

  function preencherEscalacaoSeVazia() {
    if (!teamA || !teamB) return
    if (!lineupA.some((item) => item)) {
      const numeros = getDefaultLineupNumbers(teamA)
      setLineupA(numeros)
      setBenchA(getBenchNumbers(teamA, numeros, startingLiberos[currentSet]?.teamA))
    }
    if (!lineupB.some((item) => item)) {
      const numeros = getDefaultLineupNumbers(teamB)
      setLineupB(numeros)
      setBenchB(getBenchNumbers(teamB, numeros, startingLiberos[currentSet]?.teamB))
    }
  }

  function handleSkipSetup() {
    if (!teamA || !teamB) return
    preencherEscalacaoSeVazia()
    const starter = initialServerBySet[currentSet] ?? 'teamA'
    setCaptA(teamA.players[0]?.number ?? '')
    setCaptB(teamB.players[0]?.number ?? '')
    setTossWinnerTeamId(starter)
    setTossDecision('SAQUE')
    setValidatedA([...teamA.players, ...teamA.reserves].map((p) => p.number))
    setValidatedB([...teamB.players, ...teamB.reserves].map((p) => p.number))
    setInitialServerBySet((current) => ({ ...current, [currentSet]: starter }))
    setServingTeamId(starter)
    setLineupConfirmedA(false)
    setLineupConfirmedB(false)
    setMatchStatus('live')
    setActiveTab('escalacao')
    addMatchEvent('system', 'Pré-jogo liberado para operação da súmula oficial.')
    addToast('Ambiente de jogo liberado.')
  }

  async function handleConfirmSetup() {
    if (!teamA || !teamB) return
    preencherEscalacaoSeVazia()
    if (!stepChecklist.conferido || !stepChecklist.capitaes || !stepChecklist.saque) {
      addToast('Confirme os capitães, o saque inicial e pelo menos 6 atletas validados por equipe.')
      return
    }
    setServingTeamId(initialServerBySet[currentSet] ?? 'teamA')
    setServerIndexA(5)
    setServerIndexB(5)
    setLineupConfirmedA(false)
    setLineupConfirmedB(false)
    setMatchStatus('live')
    setActiveTab('escalacao')
    const captainA = getPlayer(teamA, captA)
    const captainB = getPlayer(teamB, captB)
    const starter = initialServerBySet[currentSet] === 'teamA' ? teamA : teamB
    addMatchEvent('anotacao', `Capitães da partida: ${teamA.name} #${captA} ${displayPlayerName(captainA?.name ?? 'Atleta', teamA.name)} e ${teamB.name} #${captB} ${displayPlayerName(captainB?.name ?? 'Atleta', teamB.name)}.`)
    addMatchEvent('anotacao', `Saque inicial: ${starter?.name ?? 'Equipe'} começa sacando.`)
    addMatchEvent('system', 'Pré-jogo concluído. Conferência da escalação liberada para os dois times.')
    addToast('Pré-jogo salvo. Monte as escalações para iniciar a partida.')
    return
  }

  function getPlayer(team: Team, number: string) {
    return [...team.players, ...team.reserves].find((player) => player.number === number)
  }

  function logPoint(teamId: TeamId, number = '', options: { ace?: boolean; kind?: 'attack' | 'block' | 'team' } = {}) {
    if (matchStatus === 'finished') return
    if (!teamA || !teamB) return
    const isA = teamId === 'teamA'
    const previous = { ...currentScore }
    const next = { teamA: currentScore.teamA + (isA ? 1 : 0), teamB: currentScore.teamB + (isA ? 0 : 1) }
    const team = isA ? teamA : teamB
    const player = number ? getPlayer(team, number) : undefined
    const isSideOut = servingTeamId !== teamId

    setCurrentScore(next)
    const playerName = displayPlayerName(player?.name ?? 'Atleta', team.name)
    const matchNumber = number ? getMatchNumber(teamId, number) : ''
    const origem: OrigemPonto | null = options.ace ? 'ace' : options.kind === 'block' ? 'block' : options.kind === 'attack' ? 'attack' : null
    const eventId = addMatchEvent(
      origem ?? 'point',
      origem
        ? textoPonto(origem, team.name, matchNumber, playerName)
        : textoPontoSemJogador(team.name),
      teamId,
      next,
      player?.id,
    )
    if (origem) addToast(`${ROTULO_PONTO[origem]} — ${playerName}`)
    else addToast('+1 — Sem jogador')
    const eventIds = [eventId]
    if (number) {
      const flash = { teamId, number, id: Date.now() }
      setPointFlash(flash)
      setTimeout(() => setPointFlash((current) => current?.id === flash.id ? null : current), 950)
    }

    if (isSideOut && matchRules.alertaRodizio && scoreHistory.length > 0) {
      const anterior = isA ? scoreHistory[scoreHistory.length - 1].lineupA : scoreHistory[scoreHistory.length - 1].lineupB
      const atual = isA ? lineupA : lineupB
      const aviso = mensagemRodizioIlegal(anterior, atual)
      if (aviso) addToast(aviso)
    }

    if (isSideOut) {
      setServingTeamId(teamId)
      const rotatedLineup = rotateVolleyballLineup(isA ? lineupA : lineupB)
      if (isA) {
        setLineupA(rotatedLineup)
        setServerIndexA(5)
      } else {
        setLineupB(rotatedLineup)
        setServerIndexB(5)
      }
      const finalLineupA = isA ? rotatedLineup : lineupA
      const finalLineupB = isA ? lineupB : rotatedLineup
      const sideOutEventId = addMatchEvent('anotacao', `Troca de saque para ${team.name}.${encodeRotationMarker(teamId, finalLineupA, finalLineupB)}`, teamId, next)
      eventIds.push(sideOutEventId)
    }

    setScoreHistory((current) => [...current, { score: previous, servingTeamId, serverIndexA, serverIndexB, lineupA, lineupB, eventIds }])

    const winner = getSetWinner(next)
    if (winner && canCloseSetByRules(next, pointsForSet(matchRules, currentSet))) {
      setSetEndPrompt({
        winner,
        score: next,
        matchPoint: setsWon[winner] + 1 >= matchRules.setsToWin,
      })
      addToast(`Confirme o encerramento do set ${currentSet}.`)
    }
  }

  function logAce() {
    const lineup = servingTeamId === 'teamA' ? lineupA : lineupB
    const serverIndex = servingTeamId === 'teamA' ? serverIndexA : serverIndexB
    const serverNumber = lineup[serverIndex]
    if (!serverNumber) {
      addToast('Defina o sacador antes de registrar ACE.')
      return
    }
    logPoint(servingTeamId, serverNumber, { ace: true })
  }

  function undoLastPoint() {
    const last = scoreHistory[scoreHistory.length - 1]
    if (!last) return
    setCurrentScore(last.score)
    setServingTeamId(last.servingTeamId)
    setServerIndexA(last.serverIndexA)
    setServerIndexB(last.serverIndexB)
    setLineupA(last.lineupA)
    setLineupB(last.lineupB)
    setEvents((current) => current.filter((event) => !last.eventIds.includes(event.id)))
    setScoreHistory((current) => current.slice(0, -1))
    setSetEndPrompt(null)
    addToast('Último ponto corrigido.')
  }

  function undoLastPointForTeam(teamId: TeamId) {
    if (scoreHistory.length === 0) {
      addToast('Nenhum ponto para corrigir.')
      return
    }
    const teamName = teamId === 'teamA' ? teamA?.name : teamB?.name
    // Cada entrada de scoreHistory guarda o estado (placar, saque, rodízio) de
    // ANTES daquele ponto. Para achar o último ponto desta equipe, comparamos
    // o placar de cada entrada com o placar seguinte (ou o placar atual, na
    // última) — se o placar da equipe aumentou ali, foi ponto dela.
    let targetIndex = -1
    for (let i = scoreHistory.length - 1; i >= 0; i--) {
      const before = scoreHistory[i].score
      const after = i === scoreHistory.length - 1 ? currentScore : scoreHistory[i + 1].score
      if (after[teamId] > before[teamId]) {
        targetIndex = i
        break
      }
    }
    if (targetIndex === -1) {
      addToast(`Nenhum ponto do ${teamName ?? 'time selecionado'} para corrigir.`)
      return
    }
    const target = scoreHistory[targetIndex]
    const collateral = scoreHistory.length - 1 - targetIndex
    const removedEventIds = scoreHistory.slice(targetIndex).flatMap((entry) => entry.eventIds)
    setCurrentScore(target.score)
    setServingTeamId(target.servingTeamId)
    setServerIndexA(target.serverIndexA)
    setServerIndexB(target.serverIndexB)
    setLineupA(target.lineupA)
    setLineupB(target.lineupB)
    setEvents((current) => current.filter((event) => !removedEventIds.includes(event.id)))
    setScoreHistory((current) => current.slice(0, targetIndex))
    setSetEndPrompt(null)
    if (collateral > 0) {
      const otherTeamName = teamId === 'teamA' ? teamB?.name : teamA?.name
      addToast(`Último ponto do ${teamName ?? 'time'} corrigido (também foi necessário desfazer ${collateral} ponto(s) do ${otherTeamName ?? 'outro time'} para isso).`)
    } else {
      addToast('Último ponto corrigido.')
    }
  }

  function requestCloseCurrentSet() {
    const winner = getSetWinner(currentScore)
    const requiredPoints = pointsForSet(matchRules, currentSet)
    if (!winner || !canCloseSetByRules(currentScore, requiredPoints)) {
      addToast(`Para encerrar o set, uma equipe precisa chegar a ${requiredPoints} pontos com 2 de diferença.`)
      return
    }
    setSetEndPrompt({
      winner,
      score: currentScore,
      matchPoint: setsWon[winner] + 1 >= matchRules.setsToWin,
    })
  }

  function confirmSetEndPrompt() {
    if (!setEndPrompt) return
    const score = setEndPrompt.score
    setSetEndPrompt(null)
    closeCurrentSet(score)
  }

  function closeCurrentSet(score = currentScore) {
    const winner = getSetWinner(score)
    const next = [...setScores]
    next[currentSet - 1] = { ...score, winner, confirmed: true }
    setSetScores(next)
    const nextSetsWon = countSets(next)
    setSetsWon(nextSetsWon)
    addMatchEvent('set_end', `Set ${currentSet} finalizado: ${score.teamA} x ${score.teamB}.`, undefined, score)
    const saqueInicial = initialServerBySet[currentSet]
    const transicao = transicaoAoEncerrarSet({
      setAtual: currentSet,
      setsPorPartida: matchRules.setsPerMatch,
      setsParaVencer: matchRules.setsToWin,
      setsA: nextSetsWon.teamA,
      setsB: nextSetsWon.teamB,
      ladosInvertidos: sidesInverted,
      saqueInicialDoSet: saqueInicial === 'teamA' || saqueInicial === 'teamB' ? saqueInicial : null,
    })
    if (transicao.segue && transicao.proximoSet) {
      setSidesInverted(transicao.ladosInvertidos)
      addMatchEvent('anotacao', 'Equipes inverteram os lados da quadra.')
      setCurrentSet(transicao.proximoSet)
      setCurrentScore({ teamA: 0, teamB: 0 })
      setTimeoutsUsedA(0)
      setTimeoutsUsedB(0)
      if (matchRules.temposSeparados) {
        setTemposEquipeA(0)
        setTemposEquipeB(0)
      }
      setLineupConfirmedA(false)
      setLineupConfirmedB(false)
      setStartingLiberos((current) => ({ ...current, [currentSet + 1]: { teamA: '', teamB: '' } }))
      setActiveTab('escalacao')
    } else {
      addMatchEvent('system', TEXTO_AGUARDANDO_OFICIALIZACAO)
      setMatchStatus('finished')
      addToast('Partida pronta para envio final.')
    }
  }

  function confirmLineup(teamId: TeamId) {
    const lineup = teamId === 'teamA' ? lineupA : lineupB
    const team = teamId === 'teamA' ? teamA : teamB
    const selectedLibero = startingLiberos[currentSet]?.[teamId]
    if (!team || lineup.filter(Boolean).length < 6 || new Set(lineup.filter(Boolean)).size < 6) {
      addToast('Confira os 6 atletas em quadra antes de confirmar a escalação.')
      return
    }

    if (!selectedLibero && matchRules.exigirLiberoInicial) {
      addToast(`Defina o líbero inicial do ${team.name} para o set ${currentSet}.`)
      return
    }

    if (lineup.includes(selectedLibero)) {
      addToast('O libero inicial deve ser escolhido fora dos atletas titulares em quadra.')
      return
    }

    const setConfirmed = teamId === 'teamA' ? setLineupConfirmedA : setLineupConfirmedB
    setConfirmed(true)
    addMatchEvent('system', selectedLibero
      ? `Escalação do ${team.name} conferida para o set ${currentSet}. Líbero inicial: #${selectedLibero}.`
      : `Escalação do ${team.name} conferida para o set ${currentSet}.`)

    const otherTeamConfirmed = teamId === 'teamA' ? lineupConfirmedB : lineupConfirmedA
    if (!otherTeamConfirmed) {
      const otherTeam = teamId === 'teamA' ? teamB : teamA
      addToast(`Escalação do ${team.name} confirmada. Revise o ${otherTeam?.name ?? 'outro time'} quando quiser.`)
      return
    }

    const resolvido = resolverSaqueInicial(currentSet)
    if (!resolvido.lado) {
      addToast(resolvido.erro ?? `Defina quem começa sacando no set ${currentSet} antes de liberar a pontuação.`)
      return
    }
    if (initialServerBySet[currentSet] !== resolvido.lado) {
      setInitialServerBySet((current) => ({ ...current, [currentSet]: resolvido.lado }))
    }

    const isFirstMatchStart = currentSet === 1 && String(partida?.status || '').toUpperCase() !== 'EM_ANDAMENTO'
    if (isFirstMatchStart) {
      setShowStartMatchConfirm(true)
      addToast('Escalação confirmada. Confira quem saca antes de iniciar a partida.')
      return
    }

    unlockPontuacao()
  }

  function unlockPontuacao() {
    const resolvido = resolverSaqueInicial(currentSet)
    const chosenServer = resolvido.lado
    if (!chosenServer) {
      addToast(resolvido.erro ?? 'Defina o saque inicial antes de liberar a pontuação.')
      return
    }
    setServingTeamId(chosenServer)
    setServerIndexA(5)
    setServerIndexB(5)
    setActiveTab('pontuacao')
    const starterName = chosenServer === 'teamA' ? teamA?.name : teamB?.name
    const anterior = initialServerBySet[currentSet - 1]
    const motivo = modoSaqueInicial(currentSet) === 'alternancia' && (anterior === 'teamA' || anterior === 'teamB')
      ? ` Alternância: ${starterName ?? 'A equipe'} não sacou no set ${currentSet - 1}.`
      : modoSaqueInicial(currentSet) === 'sorteio'
        ? ' Sorteio do tie-break definiu o saque deste set.'
        : ''
    addMatchEvent('set_start', `Papeleta do set ${currentSet} confirmada para os dois times. Líberos iniciais: ${teamA?.name ?? 'Equipe A'} #${startingLiberos[currentSet]?.teamA || '--'} e ${teamB?.name ?? 'Equipe B'} #${startingLiberos[currentSet]?.teamB || '--'}. Saque inicial: ${starterName ?? 'Equipe'} começa sacando.${motivo} ${marcarSaqueInicial(chosenServer)}${encodeRotationMarker(chosenServer, lineupA, lineupB)}`)
    if (currentSet === 1 && String(partida?.status || '').toUpperCase() !== 'EM_ANDAMENTO') {
      if (tokenDeDemonstracao(String(token))) {
        setPartida((current: any) => current ? { ...current, status: 'EM_ANDAMENTO' } : current)
      } else {
        fetch('/api/arbitro/partidas/' + token + '/iniciar', { method: 'POST' })
          .then((res) => {
            if (!res.ok) throw new Error()
            setPartida((current: any) => current ? { ...current, status: 'EM_ANDAMENTO' } : current)
            addMatchEvent('system', 'Partida iniciada apos conferencia das escalações.')
            return saveLiveSnapshot(true)
          })
          .catch(() => addToast(AVISO_INICIO_SEM_SINCRONISMO))
      }
    }
    setShowStartMatchConfirm(false)
    addToast('Partida iniciada. Pontuação liberada.')
  }

  function setInitialServerForCurrentSet(teamId: TeamId) {
    if (modoSaqueInicial(currentSet) === 'alternancia') return
    setInitialServerBySet((current) => ({ ...current, [currentSet]: teamId }))
  }

  function registrarSorteioTieBreak(teamId: TeamId, origem: 'aplicativo' | 'mesa') {
    if (modoSaqueInicial(currentSet) !== 'sorteio' || !teamA || !teamB) return
    setInitialServerBySet((current) => ({ ...current, [currentSet]: teamId }))
    const nome = teamId === 'teamA' ? teamA.name : teamB.name
    const frase = origem === 'aplicativo'
      ? `Sorteio do set ${currentSet}: o aplicativo sorteou ${nome}, que começa sacando. ${marcarSaqueInicial(teamId)}`
      : `Sorteio do set ${currentSet}: a mesa registrou que ${nome} começa sacando. ${marcarSaqueInicial(teamId)}`
    addMatchEvent('anotacao', frase)
  }

  function resolverSaqueInicial(setNumero: number) {
    const anterior = initialServerBySet[setNumero - 1] ?? null
    if (modoSaqueInicial(setNumero) === 'alternancia') {
      const obrigatorio = saqueObrigatorio(setNumero, anterior)
      if (!obrigatorio) return { lado: null as TeamId | null, erro: `O saque do set ${setNumero} depende de quem sacou no set ${setNumero - 1}.` }
      return { lado: obrigatorio, erro: null as string | null }
    }
    const escolhido = initialServerBySet[setNumero] ?? null
    if (!escolhido) {
      return {
        lado: null as TeamId | null,
        erro: modoSaqueInicial(setNumero) === 'sorteio'
          ? 'Registre o sorteio do 5º set antes de liberar a pontuação.'
          : `Defina quem começa sacando no set ${setNumero} antes de liberar a pontuação.`,
      }
    }
    return { lado: escolhido, erro: null as string | null }
  }

  useEffect(() => {
    if (currentSet < 2 || currentSet > 4 || !teamA || !teamB) return
    const anterior = initialServerBySet[currentSet - 1]
    if (anterior !== 'teamA' && anterior !== 'teamB') return
    const obrigatorio = ladoOposto(anterior)
    if (initialServerBySet[currentSet] !== obrigatorio) {
      setInitialServerBySet((current) => ({ ...current, [currentSet]: obrigatorio }))
    }
    if (matchStatus !== 'live') return
    const jaMarcado = events.some((event) => event.set === currentSet && event.text.includes('[[SAQUE:') && event.text.includes(`:${obrigatorio}]]`))
    if (jaMarcado) return
    const nome = obrigatorio === 'teamA' ? teamA.name : teamB.name
    addMatchEvent('anotacao', `Alternância do set ${currentSet}: ${nome} começa sacando. ${marcarSaqueInicial(obrigatorio)}`)
  }, [currentSet, initialServerBySet, matchStatus, teamA, teamB, events])

  function setStartingLibero(teamId: TeamId, number: string) {
    if (teamId === 'teamA') setLineupConfirmedA(false)
    else setLineupConfirmedB(false)
    setStartingLiberos((current) => ({
      ...current,
      [currentSet]: {
        teamA: current[currentSet]?.teamA ?? '',
        teamB: current[currentSet]?.teamB ?? '',
        [teamId]: number,
      },
    }))
    if (!teamA || !teamB) return
    const team = teamId === 'teamA' ? teamA : teamB
    const lineup = teamId === 'teamA' ? lineupA : lineupB
    const setBench = teamId === 'teamA' ? setBenchA : setBenchB
    setBench(getBenchNumbers(team, lineup, number))
  }

  function changeSlot(teamId: TeamId, index: number, number: string) {
    if (!teamA || !teamB) return
    if (teamId === 'teamA') setLineupConfirmedA(false)
    else setLineupConfirmedB(false)
    const currentLineup = teamId === 'teamA' ? lineupA : lineupB
    const setLineup = teamId === 'teamA' ? setLineupA : setLineupB
    const setBench = teamId === 'teamA' ? setBenchA : setBenchB
    const team = teamId === 'teamA' ? teamA : teamB
    const selectedLibero = startingLiberos[currentSet]?.[teamId] ?? ''
    const nextLineup = [...currentLineup]
    const outgoing = nextLineup[index]
    const existingCourtIndex = nextLineup.findIndex((item) => item === number)

    if (existingCourtIndex === index) {
      setEditingSlot(null)
      return
    }

    if (existingCourtIndex >= 0) {
      nextLineup[index] = number
      nextLineup[existingCourtIndex] = outgoing
    } else {
      nextLineup[index] = number
    }

    setLineup(nextLineup)
    setBench(getBenchNumbers(team, nextLineup, selectedLibero))
    setEditingSlot(null)
    const formacaoA = teamId === 'teamA' ? nextLineup : lineupA
    const formacaoB = teamId === 'teamB' ? nextLineup : lineupB
    setEvents((current) => {
      const item: MatchEvent = {
        id: `ev-formacao-${currentSet}`,
        type: 'anotacao',
        text: `Formação da quadra atualizada.${encodeRotationMarker(servingTeamId, formacaoA, formacaoB)}`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        set: currentSet,
        score: scoreString(),
      }
      return [item, ...current.filter((event) => !event.text.startsWith('Formação da quadra atualizada.'))]
    })
    setFormacaoVersao((atual) => atual + 1)
  }

  function askSubstitution(teamId: TeamId, index: number) {
    if (matchStatus === 'finished') return
    const number = teamId === 'teamA' ? lineupA[index] : lineupB[index]
    if (!number) return
    setSubModal({ teamId, index, outNumber: number })
  }

  function listaDeSubstituicao(teamId: TeamId, outNumber: string) {
    const currentBench = teamId === 'teamA' ? benchA : benchB
    const controle = controleSubstituicao[currentSet]?.[teamId] ?? controleVazio()
    return reservasElegiveis(controle, outNumber, currentBench, matchRules.substitutionLimit)
  }

  function avisoDoModal() {
    if (!subModal) return null
    const lista = listaDeSubstituicao(subModal.teamId, subModal.outNumber)
    if (!lista.aviso) return null
    const teamId = subModal.teamId
    return textoAvisoSubstituicao(lista.aviso, (numero) => getMatchNumber(teamId, numero), matchRules.substitutionLimit)
  }

  function executeSubstitution(inNumber: string, porLesao = false) {
    if (!subModal || !teamA || !teamB) return
    const porLesaoAtiva = porLesao === true && matchRules.substituicaoPorLesao
    const isA = subModal.teamId === 'teamA'
    const lineupSetter = isA ? setLineupA : setLineupB
    const benchSetter = isA ? setBenchA : setBenchB
    const team = isA ? teamA : teamB
    const outPlayer = getPlayer(team, subModal.outNumber)
    const inPlayer = getPlayer(team, inNumber)
    const currentBench = isA ? benchA : benchB
    const isLiberoExchange = Boolean(outPlayer?.isLibero || inPlayer?.isLibero)

    if (!currentBench.includes(inNumber)) {
      addToast('Escolha um atleta do banco de reservas.')
      return
    }
    const controleAtual = controleSubstituicao[currentSet]?.[subModal.teamId] ?? controleVazio()
    const proximoControle = isLiberoExchange || porLesaoAtiva ? null : aplicarSubstituicao(controleAtual, subModal.outNumber, inNumber, matchRules.substitutionLimit)
    if (proximoControle?.falha) {
      addToast(mensagemFalhaSubstituicao(proximoControle.falha, currentSet, matchRules.substitutionLimit))
      return
    }

    const nextLineup = (isA ? lineupA : lineupB).map((item, index) => (index === subModal.index ? inNumber : item))
    lineupSetter(nextLineup)
    benchSetter(getBenchNumbers(team, nextLineup, startingLiberos[currentSet]?.[subModal.teamId]))

    const outName = outPlayer ? displayPlayerName(outPlayer.name, team.name) : ''
    const inName = inPlayer ? displayPlayerName(inPlayer.name, team.name) : ''
    const outMatchNumber = getMatchNumber(subModal.teamId, subModal.outNumber)
    const inMatchNumber = getMatchNumber(subModal.teamId, inNumber)
    const formacaoA = isA ? nextLineup : lineupA
    const formacaoB = isA ? lineupB : nextLineup
    addMatchEvent(
      porLesaoAtiva ? 'injury_substitution' : isLiberoExchange ? 'libero_exchange' : 'substitution',
      `${porLesaoAtiva
        ? textoSubstituicaoLesao(team.name, outMatchNumber, outName, inMatchNumber, inName)
        : isLiberoExchange
          ? `Troca de líbero ${team.name}: sai #${outMatchNumber} ${outName}, entra #${inMatchNumber} ${inName}.`
          : `Substituição ${team.name}: sai #${outMatchNumber} ${outName}, entra #${inMatchNumber} ${inName}.`}${encodeRotationMarker(servingTeamId, formacaoA, formacaoB)}`,
      subModal.teamId,
    )
    if (proximoControle) {
      const gravado = proximoControle.controle
      setControleSubstituicao((current) => {
        const doSet = current[currentSet] ?? { teamA: controleVazio(), teamB: controleVazio() }
        return {
          ...current,
          [currentSet]: {
            teamA: doSet.teamA ?? controleVazio(),
            teamB: doSet.teamB ?? controleVazio(),
            [subModal.teamId]: gravado,
          },
        }
      })
    }
    setSubModal(null)
    addToast(porLesaoAtiva ? 'Substituição por lesão registrada.' : isLiberoExchange ? 'Troca de líbero registrada.' : 'Substituição registrada.')
  }

  function requestTimeout(teamId: TeamId) {
    if (!teamA || !teamB) return
    const isA = teamId === 'teamA'
    const used = isA ? timeoutsUsedA : timeoutsUsedB
    const limite = matchRules.timeoutLimit
    if (used >= limite) return addToast('Limite de tempos atingido neste set.')
    const team = isA ? teamA : teamB
    if (isA) setTimeoutsUsedA(used + 1)
    else setTimeoutsUsedB(used + 1)
    addMatchEvent('timeout', textoTempoTecnico(team.name, used + 1, currentSet, limite), teamId)
  }

  function requestTempoEquipe(teamId: TeamId) {
    if (!matchRules.temposSeparados || !teamA || !teamB) return
    const isA = teamId === 'teamA'
    const used = isA ? temposEquipeA : temposEquipeB
    const limite = matchRules.timeoutLimit
    if (used >= limite) return addToast('Limite de tempos de equipe atingido neste set.')
    const team = isA ? teamA : teamB
    if (isA) setTemposEquipeA(used + 1)
    else setTemposEquipeB(used + 1)
    addMatchEvent('timeout', textoTempoEquipe(team.name, used + 1, currentSet, limite), teamId)
  }

  function requestTempoMedico(teamId: TeamId) {
    if (!matchRules.tempoMedico || !teamA || !teamB) return
    const team = teamId === 'teamA' ? teamA : teamB
    addMatchEvent('anotacao', textoTempoMedico(team.name), teamId)
  }

  function saveNote(payload: Omit<Anotacao, 'id' | 'set' | 'placar' | 'timestamp'>) {
    if (!teamA || !teamB) return
    const redCard = normalizeName(payload.tipo) === 'cartao vermelho'
    const penalizedTeamId = payload.equipeRelacionada === teamA.name
      ? 'teamA'
      : payload.equipeRelacionada === teamB.name
        ? 'teamB'
        : undefined
    const benefitingTeamId = penalizedTeamId === 'teamA' ? 'teamB' : penalizedTeamId === 'teamB' ? 'teamA' : undefined
    const nextScore = redCard && benefitingTeamId
      ? {
        teamA: currentScore.teamA + (benefitingTeamId === 'teamA' ? 1 : 0),
        teamB: currentScore.teamB + (benefitingTeamId === 'teamB' ? 1 : 0),
      }
      : currentScore
    const item: Anotacao = {
      ...payload,
      id: `note-${Date.now()}`,
      set: currentSet,
      placar: scoreString(nextScore),
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
    setAnotacoes((current) => [item, ...current])
    const noteEventId = addMatchEvent('anotacao', `[${item.tipo}] ${item.equipeRelacionada} - ${item.pessoaRelacionada}: ${item.descricao}`, penalizedTeamId, nextScore)
    if (redCard && benefitingTeamId && penalizedTeamId) {
      const benefitingTeam = benefitingTeamId === 'teamA' ? teamA : teamB
      setCurrentScore(nextScore)
      const pointEventId = addMatchEvent(
        'point',
        `Ponto automático para ${benefitingTeam.name} por cartão vermelho aplicado a ${item.pessoaRelacionada || item.equipeRelacionada}.`,
        benefitingTeamId,
        nextScore,
      )
      setScoreHistory((current) => [...current, {
        score: currentScore,
        servingTeamId,
        serverIndexA,
        serverIndexB,
        lineupA,
        lineupB,
        eventIds: [noteEventId, pointEventId],
      }])
      addToast(`Cartão vermelho registrado. Ponto automático para ${benefitingTeam.name}.`)
    } else if (redCard) {
      addToast('Selecione uma equipe ou atleta para aplicar o cartão vermelho com ponto automático.')
    }
  }

  function buildSumulaPayload(finalOnly = false) {
    if (!teamA || !teamB) return { presencas: [], sets: [], ocorrencias: [], destaques: [] }
    const sets = setScores
      .map((set, index) => {
        if (index === currentSet - 1 && !set.confirmed) return { numero: index + 1, pontosA: currentScore.teamA, pontosB: currentScore.teamB }
        return { numero: index + 1, pontosA: set.teamA, pontosB: set.teamB }
      })
      .filter((set) => set.pontosA > 0 || set.pontosB > 0 || (!finalOnly && set.numero === currentSet))

    const presentNumbersA = new Set(validatedA.length ? validatedA : [...teamA.players, ...teamA.reserves].map((p) => p.number))
    const presentNumbersB = new Set(validatedB.length ? validatedB : [...teamB.players, ...teamB.reserves].map((p) => p.number))
    const presencas = [
      ...[...teamA.players, ...teamA.reserves].map((player) => ({
        jogadorId: player.id,
        equipeId: teamA.dbId,
        presente: presentNumbersA.has(player.number),
        numero: parseMatchNumberOverride(matchNumberOverrides.teamA?.[player.id]),
      })),
      ...[...teamB.players, ...teamB.reserves].map((player) => ({
        jogadorId: player.id,
        equipeId: teamB.dbId,
        presente: presentNumbersB.has(player.number),
        numero: parseMatchNumberOverride(matchNumberOverrides.teamB?.[player.id]),
      })),
    ]
    const ocorrencias = [...events, ...anotacoes.map((note) => ({
      id: note.id,
      type: 'anotacao' as EventType,
      text: `[${note.tipo}] ${note.equipeRelacionada} - ${note.pessoaRelacionada}: ${note.descricao}`,
      time: note.timestamp,
      set: note.set,
      score: note.placar,
      jogadorId: undefined as number | undefined,
    }))]
      .map((event) => ({
        tipo: normalizeOccurrenceType(event),
        descricao: `${event.time} | ${event.score} | ${event.text}`,
        set: event.set,
        jogadorId: event.jogadorId ?? null,
      }))
    const destaques = mvpId ? [{ jogadorId: Number(mvpId), tipo: 'MVP' }] : []
    return { presencas, sets, ocorrencias, destaques }
  }

  async function saveLiveSnapshot(force = false) {
    if (!teamA || !teamB) return
    if (!force && matchStatus !== 'live' && matchStatus !== 'finished') return
    if (partida?.sumulaAprovadaEm) return
    const payload = buildSumulaPayload(false)
    if (String(token).includes('demo')) {
      window.localStorage.setItem(`luv-live-match-${partida.id}`, JSON.stringify(buildDemoLiveSnapshot(payload)))
    }
    const resposta = await fetch(`/api/sumula/${token}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => ({}))
      const mensagem = corpo?.error || 'Não foi possível salvar o andamento da súmula.'
      if (/encerrada/i.test(mensagem)) return
      throw new Error(mensagem)
    }
  }

  function buildDemoLiveSnapshot(payload: ReturnType<typeof buildSumulaPayload>, statusOverride?: 'EM_ANDAMENTO' | 'ENCERRADA') {
    const officialSets = payload.sets.map((set, index) => ({ id: index + 1, ...set }))
    const officialSetsWon = officialSets.reduce((acc, set) => {
      if (set.pontosA > set.pontosB) acc.teamA += 1
      if (set.pontosB > set.pontosA) acc.teamB += 1
      return acc
    }, { teamA: 0, teamB: 0 })
    const hasOfficialSets = officialSets.length > 0
    const latestSet = [...officialSets].sort((a, b) => b.numero - a.numero)[0]
    return {
      id: partida.id,
      rodada: partida.rodada,
      dataHora: partida.dataHora,
      localNome: partida.localNome,
      status: statusOverride ?? (matchStatus === 'finished' ? 'ENCERRADA' : 'EM_ANDAMENTO'),
      setsPorA: hasOfficialSets ? officialSetsWon.teamA : setsWon.teamA,
      setsPorB: hasOfficialSets ? officialSetsWon.teamB : setsWon.teamB,
      pontosPorA: latestSet?.pontosA ?? currentScore.teamA,
      pontosPorB: latestSet?.pontosB ?? currentScore.teamB,
      equipeA: partida.equipeA,
      equipeB: partida.equipeB,
      sets: officialSets,
      ocorrencias: [...events].map((event, index) => ({
        id: index + 1,
        tipo: event.type,
        descricao: `${event.time} | ${event.score} | ${event.text}`,
        set: event.set,
      })),
      destaques: [],
      atualizadoEm: new Date().toISOString(),
    }
  }

  useEffect(() => {
    if (!teamA || !teamB) return
    if (matchStatus !== 'live' && matchStatus !== 'finished') return
    if (submitted || submitting || partida?.sumulaAprovadaEm) return
    if (liveSaveRef.current) clearTimeout(liveSaveRef.current)
    const espera = matchStatus === 'finished' ? 0 : 700
    liveSaveRef.current = setTimeout(() => {
      saveLiveSnapshot(matchStatus === 'finished')
        .then(() => setFalhaSalvamento(null))
        .catch((err) => setFalhaSalvamento(err instanceof Error ? err.message : 'Não foi possível salvar o andamento da súmula.'))
    }, espera)
    return () => {
      if (liveSaveRef.current) clearTimeout(liveSaveRef.current)
    }
  }, [matchStatus, currentScore.teamA, currentScore.teamB, currentSet, setsWon.teamA, setsWon.teamB, events.length, anotacoes.length, validatedA.length, validatedB.length, matchNumberOverrides, formacaoVersao, submitted, submitting, partida?.sumulaAprovadaEm])

  function pedirOficializacao() {
    if (matchStatus !== 'finished') return
    if (!mvpId || !jogadoresVencedores.some((player) => String(player.id) === String(mvpId))) {
      setActiveTab('anotacoes')
      setSidebarOpen(false)
      setErroOficial('Escolha o MVP da equipe vencedora antes de oficializar a súmula.')
      addToast('Escolha o MVP da equipe vencedora na aba Anotações.')
      return
    }
    setConfirmarOficial(true)
  }

  async function submitSumula(automatic = false) {
    if (!teamA || !teamB) return false
    if (matchStatus !== 'finished') {
      addToast('A súmula só pode ser enviada depois que a partida for encerrada.')
      return false
    }
    if (!mvpId || !jogadoresVencedores.some((player) => String(player.id) === String(mvpId))) {
      setErroOficial('Escolha o MVP da equipe vencedora antes de oficializar a súmula.')
      if (!automatic) addToast('Escolha o MVP da equipe vencedora antes de oficializar a súmula.')
      return false
    }
    if (submitting) return false
    if (liveSaveRef.current) {
      clearTimeout(liveSaveRef.current)
      liveSaveRef.current = null
    }
    setSubmitting(true)
    setErroOficial('')
    if (automatic) addToast('Partida encerrada. Enviando súmula final...')
    const payload = buildSumulaPayload(true)
    let res: Response
    try {
      res = await fetch(`/api/sumula/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      setSubmitting(false)
      setErroOficial('Não foi possível enviar a súmula. Verifique sua conexão.')
      if (!automatic) addToast('Não foi possível enviar a súmula. Verifique sua conexão.')
      return false
    }
    setSubmitting(false)
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      const publico = json.data?.publico || `/partidas/${partida.id}/ao-vivo`
      if (String(token).includes('demo')) {
        window.localStorage.setItem(`luv-live-match-${partida.id}`, JSON.stringify(buildDemoLiveSnapshot(payload, 'ENCERRADA')))
      }
      setPartida((current: any) => current ? { ...current, status: 'ENCERRADA', sumulaAprovadaEm: current.sumulaAprovadaEm || new Date().toISOString() } : current)
      setLinkPublico(publico)
      addToast('Súmula oficializada. O resultado público já pode ser visto.')
      setSubmitted(true)
      return true
    }

    const message = json.error || 'Não foi possível enviar a súmula.'
    setErroOficial(message)
    if (!automatic) addToast(message)
    return false
  }

  if (loading) return <Status icon={<ClipboardList size={26} />} title="Carregando súmula" description="Buscando dados oficiais da partida..." />
  if (notFound || !partida || !teamA || !teamB) return <Status icon={<ShieldAlert size={26} />} title={notFound ? tituloFalhaSumula(falha) : 'Súmula incompleta'} description={notFound ? falha : 'A partida não tem as duas equipes cadastradas.'} onRetry={() => setTentativa((atual) => atual + 1)} />
  if (submitted) {
    const publico = linkPublico || `/partidas/${partida.id}/ao-vivo`
    return (
      <Status
        icon={<CheckCircle2 size={28} />}
        title="Súmula oficializada"
        description="O resultado ficou público. Qualquer pessoa com o endereço abaixo vê o placar, os sets e os lances."
        success
        action={<a className="official-public-sumula" href={publico} target="_blank" rel="noreferrer">Abrir súmula pública</a>}
      />
    )
  }

  if (matchStatus === 'pre-game') {
    return (
      <main className="official-sumula official-preflow">
        <PreMatchFlow
          token={token}
          teamA={teamA}
          teamB={teamB}
          partida={partida}
          stepChecklist={stepChecklist}
          validatedA={validatedA}
          validatedB={validatedB}
          captA={captA}
          captB={captB}
          setCaptA={setCaptA}
          setCaptB={setCaptB}
          tossWinnerTeamId={tossWinnerTeamId}
          setTossWinnerTeamId={setTossWinnerTeamId}
          tossDecision={tossDecision}
          setTossDecision={setTossDecision}
          setValidatedA={setValidatedA}
          setValidatedB={setValidatedB}
          preGameValidated={preGameValidated}
          set1ServingTeamId={setInitialServerForCurrentSet}
          servingChoice={initialServerBySet[currentSet] ?? null}
          onConfirmSetup={handleConfirmSetup}
          addMatchEvent={addMatchEvent}
          onQuickRelease={handleSkipSetup}
        />
        <AvisosSumula avisos={avisos} />
      </main>
    )
  }

  const leftTeamId: TeamId = sidesInverted ? 'teamB' : 'teamA'
  const rightTeamId: TeamId = sidesInverted ? 'teamA' : 'teamB'
  const leftTeam = leftTeamId === 'teamA' ? teamA : teamB
  const rightTeam = rightTeamId === 'teamA' ? teamA : teamB
  const podeEncerrarSet = matchStatus === 'live' && Boolean(getSetWinner(currentScore)) && canCloseSetByRules(currentScore, pointsForSet(matchRules, currentSet))

  return (
    <main className={`official-sumula ${activeTab === 'pontuacao' ? 'has-floating-score' : ''}`}>
      <div className="official-mobilebar">
        <div>
          <strong>volei.space</strong>
          <span>Súmula digital</span>
        </div>
        <button type="button" onClick={() => setSidebarOpen((current) => !current)}><Menu size={18} /></button>
      </div>

      {sidebarOpen && <button type="button" className="official-mobile-menu-backdrop" aria-label="Fechar menu da súmula" onClick={() => setSidebarOpen(false)} />}

      <aside className={`official-sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div>
          <div className="official-brand">
            <div className="official-brand-logo">
              <img src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" />
            </div>
            <div>
              <strong>volei.space</strong>
            </div>
          </div>

          <div className="official-live-card">
            <div className="official-live-status">
              <span><i /> Partida ao vivo</span>
              <em key={currentSet} className="sumula-micro-set">Set {currentSet}{currentSet === matchRules.setsPerMatch && matchRules.lastSetPoints !== matchRules.pointsPerSet ? ' · tie-break' : ''}</em>
            </div>
            <strong>{leftTeam.name} <small>vs</small> {rightTeam.name}</strong>
            <div className="official-live-score">
              <b>{currentScore[leftTeamId]}</b>
              <span>placar</span>
              <b>{currentScore[rightTeamId]}</b>
            </div>
            <div className="official-live-sets">
              <span>{matchRules.exigeTodosOsSets ? `Sets · ${matchRules.setsPerMatch} obrigatórios` : `Sets · melhor de ${matchRules.setsPerMatch}`}</span>
              <strong>{setsWon[leftTeamId]} x {setsWon[rightTeamId]}</strong>
            </div>
            <div className="official-live-captains">
              <span>Capitães</span>
              <strong>{leftTeam.name} #{(leftTeamId === 'teamA' ? captA : captB) || '--'}</strong>
              <strong>{rightTeam.name} #{(rightTeamId === 'teamA' ? captA : captB) || '--'}</strong>
            </div>
            <div className="official-live-progress">
              <span>{matchStatus === 'live' ? 'Em disputa' : 'Encerrada'}</span>
              <i style={{ width: matchStatus === 'live' ? '66%' : '100%' }} />
            </div>
          </div>

          <nav>
            {tabs.filter((tab) => tab.id !== 'pre').map((tab) => {
              const locked = matchStatus !== 'finished' && !lineupConfirmed
              return (
              <button key={tab.id} type="button" disabled={locked} onClick={() => { if (!locked) { setActiveTab(tab.id); setSidebarOpen(false) } }} className={activeTab === tab.id ? 'is-active' : ''}>
                <span>{tab.icon}{tab.label}</span>
                <span>{locked ? 'bloq.' : activeTab === tab.id ? '>' : ''}</span>
              </button>
              )
            })}
          </nav>
        </div>

        <div className="official-sidebar-footer">
          <span>Status</span>
          <strong>{matchStatus === 'live' ? 'Em jogo' : 'Finalizada'}</strong>
          {partida.sumulaAprovadaEm ? (
            <a className="official-public-sumula" href={`/partidas/${partida.id}/ao-vivo`} target="_blank" rel="noreferrer">Ver súmula pública</a>
          ) : (
            <ActionBar type="button" onClick={pedirOficializacao} loading={submitting} loadingLabel="Enviando" disabled={matchStatus !== 'finished'} title={matchStatus !== 'finished' ? 'Disponível somente após encerrar a partida' : 'Escolhe o MVP na aba Anotações quando ele ainda não foi definido'}>
              <Send size={14} />
              {matchStatus === 'finished' ? 'Oficializar súmula' : 'Aguardando fim'}
            </ActionBar>
          )}
          {erroOficial && <p className="official-submit-error" role="alert">{erroOficial}</p>}
        </div>
      </aside>

      <section className="official-content">
        <header className="official-header">
          <div>
            <span>{agendaDaPartida(partida).rotulo}</span>
            <h1>{leftTeam.name} <small>vs</small> {rightTeam.name}</h1>
            <AgendaPartidaLinha partida={partida} />
          </div>
          <div className="flex items-center gap-3">
            <div className="official-court-switch" role="group" aria-label="Versão da quadra">
              <button type="button" aria-pressed={vistaQuadra === '2d'} className={vistaQuadra === '2d' ? 'is-active' : ''} onClick={() => escolherVista('2d')}>2D</button>
              <button type="button" aria-pressed={vistaQuadra === '3d'} className={vistaQuadra === '3d' ? 'is-active' : ''} onClick={() => escolherVista('3d')}>3D</button>
            </div>
            {activeTab === 'pontuacao' && podeEncerrarSet && (
              <button
                type="button"
                onClick={requestCloseCurrentSet}
                className="official-close-set-alert"
                aria-label="Encerrar set atual"
                title="O placar já bateu a regra deste set"
              >
                <CheckCircle2 size={16} />
                Encerrar set
              </button>
            )}
            <button
              type="button"
              onClick={toggleSidesInverted}
              className="group/refresh"
              aria-label="Inverter lados da quadra"
              title="Inverter lados da quadra"
            >
              <RefreshCw size={16} strokeWidth={2} className="transition-transform duration-500 group-hover/refresh:rotate-180" />
              Inverter
            </button>
          </div>
        </header>

        {activeTab === 'pre' && (
          <PrePartidaTab
            teamA={teamA}
            teamB={teamB}
            currentSet={currentSet}
            currentScore={currentScore}
            setsWon={setsWon}
            events={events}
            stepChecklist={stepChecklist}
            validatedA={validatedA}
            validatedB={validatedB}
            captA={captA}
            captB={captB}
            setCaptA={setCaptA}
            setCaptB={setCaptB}
            setValidatedA={setValidatedA}
            setValidatedB={setValidatedB}
            preGameValidated={preGameValidated}
            set1ServingTeamId={setInitialServerForCurrentSet}
            servingChoice={initialServerBySet[currentSet] ?? null}
            onConfirmSetup={handleConfirmSetup}
            addMatchEvent={addMatchEvent}
          />
        )}

        {activeTab === 'resumo' && (
          <ResumoTab
            teamA={teamA}
            teamB={teamB}
            currentSet={currentSet}
            currentScore={currentScore}
            setsWon={setsWon}
            events={events}
            anotacoes={anotacoes}
            timeoutsUsedA={timeoutsUsedA}
            timeoutsUsedB={timeoutsUsedB}
            temposSeparados={matchRules.temposSeparados}
            temposEquipeA={temposEquipeA}
            temposEquipeB={temposEquipeB}
            getMatchNumber={getMatchNumber}
            sidesInverted={sidesInverted}
          />
        )}

        {activeTab === 'pontuacao' && (
          <PontuacaoTab
            teamA={teamA}
            teamB={teamB}
            currentSet={currentSet}
            currentScore={currentScore}
            setsWon={setsWon}
            servingTeamId={servingTeamId}
            sidesInverted={sidesInverted}
            lineupA={lineupA}
            lineupB={lineupB}
            benchA={benchA}
            benchB={benchB}
            serverIndexA={serverIndexA}
            serverIndexB={serverIndexB}
            pointFlash={pointFlash}
            rules={matchRules}
            subModal={subModal}
            allowedSubstitutions={subModal ? listaDeSubstituicao(subModal.teamId, subModal.outNumber).numeros : []}
            substitutionNotice={avisoDoModal()}
            getMatchNumber={getMatchNumber}
            onAttack={(teamId, number) => logPoint(teamId, number, { kind: 'attack' })}
            onBlock={(teamId, number) => logPoint(teamId, number, { kind: 'block' })}
            onAce={logAce}
            events={events}
            onPoint={(teamId) => logPoint(teamId, '', { kind: 'team' })}
            onSubstitution={askSubstitution}
            onSelectSubstitution={executeSubstitution}
            onCloseSubstitution={() => setSubModal(null)}
            onUndo={undoLastPoint}
            onUndoTeamPoint={undoLastPointForTeam}
            onCloseSet={requestCloseCurrentSet}
            timeoutsUsedA={timeoutsUsedA}
            timeoutsUsedB={timeoutsUsedB}
            temposEquipeA={temposEquipeA}
            temposEquipeB={temposEquipeB}
            onTimeout={requestTimeout}
            onTempoEquipe={requestTempoEquipe}
            onTempoMedico={requestTempoMedico}
            saveNote={saveNote}
            vistaQuadra={vistaQuadra}
            encerrada={matchStatus === 'finished'}
          />
        )}

        {activeTab === 'escalacao' && (
          <EscalacaoTab
            teamA={teamA}
            teamB={teamB}
            currentSet={currentSet}
            lineupA={lineupA}
            lineupB={lineupB}
            benchA={benchA}
            benchB={benchB}
            selectedSlot={editingSlot}
            subModal={subModal}
            lineupConfirmed={lineupConfirmed}
            lineupConfirmedA={lineupConfirmedA}
            lineupConfirmedB={lineupConfirmedB}
            startingLiberos={startingLiberos[currentSet] ?? { teamA: '', teamB: '' }}
            initialServer={initialServerBySet[currentSet] ?? null}
            setInitialServer={setInitialServerForCurrentSet}
            setEditingSlot={setEditingSlot}
            askSubstitution={askSubstitution}
            changeSlot={changeSlot}
            confirmLineup={confirmLineup}
            setStartingLibero={setStartingLibero}
            executeSubstitution={executeSubstitution}
            permiteLesao={matchRules.substituicaoPorLesao}
            quantidadeLiberos={matchRules.quantidadeLiberos}
            allowedSubstitutions={subModal ? listaDeSubstituicao(subModal.teamId, subModal.outNumber).numeros : []}
            substitutionNotice={avisoDoModal()}
            closeSubModal={() => setSubModal(null)}
            getMatchNumber={getMatchNumber}
            onMatchNumberChange={updateMatchNumber}
            vistaQuadra={vistaQuadra}
            sidesInverted={sidesInverted}
            initialServers={initialServerBySet}
            onRegistrarSorteio={registrarSorteioTieBreak}
          />
        )}

        {activeTab === 'tempos' && (
          <TemposTab teamA={teamA} teamB={teamB} currentSet={currentSet} currentScore={currentScore} timeoutsUsedA={timeoutsUsedA} timeoutsUsedB={timeoutsUsedB} temposEquipeA={temposEquipeA} temposEquipeB={temposEquipeB} limite={matchRules.timeoutLimit} temposSeparados={matchRules.temposSeparados} events={events} requestTimeout={requestTimeout} requestTempoEquipe={requestTempoEquipe} sidesInverted={sidesInverted} />
        )}

        {activeTab === 'anotacoes' && (
          <AnotacoesTab teamA={teamA} teamB={teamB} currentSet={currentSet} currentScore={currentScore} anotacoes={anotacoes} saveNote={saveNote} mvpId={mvpId} setMvpId={setMvpId} allPlayers={jogadoresVencedores} mvpTeamId={setsWon.teamA > setsWon.teamB ? 'teamA' : 'teamB'} getMatchNumber={getMatchNumber} />
        )}
      </section>

      {setEndPrompt && (
        <SetEndConfirmModal
          teamName={(setEndPrompt.winner === 'teamA' ? teamA : teamB).name}
          score={setEndPrompt.score}
          currentSet={currentSet}
          matchPoint={setEndPrompt.matchPoint}
          onCancel={() => setSetEndPrompt(null)}
          onConfirm={confirmSetEndPrompt}
        />
      )}

      {showStartMatchConfirm && teamA && teamB && (
        <StartMatchConfirmModal
          teamA={teamA}
          teamB={teamB}
          server={initialServerBySet[currentSet] === 'teamB' ? 'teamB' : 'teamA'}
          onEdit={(teamId) => {
            setInitialServerForCurrentSet(teamId)
            setTossWinnerTeamId(teamId)
            setTossDecision('SAQUE')
          }}
          onConfirm={unlockPontuacao}
        />
      )}

      {confirmarOficial && (
        <div className="official-set-confirm" role="dialog" aria-modal="true" aria-labelledby="confirmar-oficial-titulo">
          <div className="official-set-confirm-card">
            <span>Súmula oficial</span>
            <h2 id="confirmar-oficial-titulo">Oficializar a súmula?</h2>
            <p>O resultado fica público e a partida deixa de aceitar novos lances. Confira o MVP da equipe vencedora antes de continuar.</p>
            <div>
              <button type="button" onClick={() => setConfirmarOficial(false)}>Voltar</button>
              <button type="button" onClick={() => { setConfirmarOficial(false); void submitSumula(false) }}>Confirmar oficialização</button>
            </div>
          </div>
        </div>
      )}

      {falhaSalvamento && (
        <div className="official-save-alert" role="alert">
          <strong>Os lances não estão sendo gravados.</strong>
          <span>{falhaSalvamento}</span>
        </div>
      )}

      <AvisosSumula avisos={avisos} />
    </main>
  )
}

function PreMatchFlow(props: {
  token: string
  teamA: Team
  teamB: Team
  partida: any
  stepChecklist: Record<string, boolean>
  validatedA: string[]
  validatedB: string[]
  captA: string
  captB: string
  setCaptA: (value: string) => void
  setCaptB: (value: string) => void
  tossWinnerTeamId: TeamId | null
  setTossWinnerTeamId: (value: TeamId) => void
  tossDecision: 'SAQUE' | 'RECEPCAO' | ''
  setTossDecision: (value: 'SAQUE' | 'RECEPCAO' | '') => void
  setValidatedA: React.Dispatch<React.SetStateAction<string[]>>
  setValidatedB: React.Dispatch<React.SetStateAction<string[]>>
  preGameValidated: boolean
  set1ServingTeamId: (value: TeamId) => void
  servingChoice: TeamId | null
  onConfirmSetup: () => void
  addMatchEvent: (type: EventType, text: string, teamId?: TeamId) => string
  onQuickRelease: () => void
}) {
  const [step, setStep] = useState(0)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerMessage, setScannerMessage] = useState('Aponte a câmera para o QR Code do atleta.')
  const [manualQrToken, setManualQrToken] = useState('')
  const [scannerBusy, setScannerBusy] = useState(false)
  const [pendingQrPlayer, setPendingQrPlayer] = useState<PendingQrValidation | null>(null)
  const scannerBusyRef = useRef(false)
  const pendingQrRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const steps = [
    { title: 'Confirmar equipes', description: 'Confira os elencos disponíveis para esta partida.' },
    { title: 'Capitães e saque', description: 'Defina os capitães das equipes e quem começa sacando.' },
  ]
  const total = props.teamA.players.length + props.teamA.reserves.length + props.teamB.players.length + props.teamB.reserves.length
  const validatedTotal = props.validatedA.length + props.validatedB.length
  const canAdvance = step === 0
    ? props.preGameValidated
    : Boolean(props.captA && props.captB && props.servingChoice)

  useEffect(() => {
    pendingQrRef.current = Boolean(pendingQrPlayer)
  }, [pendingQrPlayer])

  function validateAll() {
    props.setValidatedA([...props.teamA.players, ...props.teamA.reserves].map((p) => p.number))
    props.setValidatedB([...props.teamB.players, ...props.teamB.reserves].map((p) => p.number))
    props.addMatchEvent('system', 'Todos os atletas foram validados em lote.')
  }

  function stopScannerStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  function closeScanner() {
    stopScannerStream()
    setScannerOpen(false)
    setScannerBusy(false)
    scannerBusyRef.current = false
    pendingQrRef.current = false
    setPendingQrPlayer(null)
    setManualQrToken('')
    setScannerMessage('Aponte a câmera para o QR Code do atleta.')
  }

  async function validateQrToken(rawValue: string) {
    const qrToken = extractQrToken(rawValue)
    if (!qrToken) {
      setScannerMessage('QR Code vazio. Tente novamente.')
      return
    }
    if (scannerBusyRef.current) return
    scannerBusyRef.current = true
    setScannerBusy(true)
    setScannerMessage('Validando QR Code...')
    try {
      const res = await fetch(`/api/arbitro/partidas/${props.token}/validar-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setScannerMessage(json?.message || json?.error || 'QR Code não encontrado para esta partida.')
        return
      }

      const jogador = json?.data?.jogador
      const team = jogador?.equipeId === props.teamA.dbId ? props.teamA : jogador?.equipeId === props.teamB.dbId ? props.teamB : null
      if (!jogador || !team) {
        setScannerMessage('Atleta validado, mas não foi possível identificar a equipe na tela.')
        return
      }

      const player = [...team.players, ...team.reserves].find((item) => item.id === jogador.id)
      const number = player?.number || String(jogador.numero || '')
      if (!number) {
        setScannerMessage('Atleta validado, mas sem número cadastrado para exibição.')
        return
      }

      const playerName = displayPlayerName(player?.name ?? jogador.nome ?? 'Atleta', team.name)
      setPendingQrPlayer({
        teamId: team.id,
        teamName: team.name,
        number,
        name: playerName,
        photoUrl: player?.photoUrl ?? jogador.fotoRostoUrl ?? jogador.fotoUrl ?? null,
      })
      setScannerMessage('Confira os dados do atleta antes de validar a presença.')
    } catch {
      setScannerMessage('Não foi possível validar agora. Verifique a conexão e tente novamente.')
    } finally {
      setTimeout(() => {
        scannerBusyRef.current = false
        setScannerBusy(false)
      }, 900)
    }
  }

  async function validateManualQr() {
    await validateQrToken(manualQrToken)
    setManualQrToken('')
  }

  function confirmPendingQr() {
    if (!pendingQrPlayer) return
    if (pendingQrPlayer.teamId === 'teamA') {
      props.setValidatedA((current) => current.includes(pendingQrPlayer.number) ? current : [...current, pendingQrPlayer.number])
    } else {
      props.setValidatedB((current) => current.includes(pendingQrPlayer.number) ? current : [...current, pendingQrPlayer.number])
    }
    props.addMatchEvent('system', `QR Code validado: #${pendingQrPlayer.number} ${pendingQrPlayer.name}.`, pendingQrPlayer.teamId)
    setScannerMessage(`#${pendingQrPlayer.number} ${pendingQrPlayer.name} validado. Pode apresentar o próximo QR Code.`)
    setPendingQrPlayer(null)
  }

  function rejectPendingQr() {
    setScannerMessage('Validação recusada. Aponte para outro QR Code ou tente novamente.')
    setPendingQrPlayer(null)
  }

  function nextStep() {
    if (!canAdvance) return
    if (step < steps.length - 1) setStep((current) => current + 1)
    else props.onConfirmSetup()
  }

  useEffect(() => {
    if (!scannerOpen) return
    let stopped = false
    let rafId = 0

    async function startScanner() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setScannerMessage('Este navegador não liberou câmera. Use a validação manual abaixo.')
          return
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        const Detector = (window as any).BarcodeDetector
        if (!Detector) {
          setScannerMessage('Leitor automático indisponível neste navegador. Use a validação manual abaixo.')
          return
        }
        const detector = new Detector({ formats: ['qr_code'] })
        const scan = async () => {
          if (stopped) return
          const video = videoRef.current
          if (video && video.readyState >= 2 && !scannerBusyRef.current && !pendingQrRef.current) {
            try {
              const codes = await detector.detect(video)
              const rawValue = codes?.[0]?.rawValue
              if (rawValue) await validateQrToken(rawValue)
            } catch {
              setScannerMessage('Não foi possível ler este quadro. Aproxime o QR Code da câmera.')
            }
          }
          rafId = requestAnimationFrame(scan)
        }
        rafId = requestAnimationFrame(scan)
      } catch {
        setScannerMessage('Permissão de câmera não liberada. Use a validação manual abaixo.')
      }
    }

    startScanner()
    return () => {
      stopped = true
      cancelAnimationFrame(rafId)
      stopScannerStream()
    }
  }, [scannerOpen])

  return (
    <section className="official-preflow-wrap">
      <header className="official-preflow-hero">
        <div className="official-preflow-brand">
          <img src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" />
          <div>
            <strong>Pré-partida</strong>
            <span>Súmula digital oficial</span>
          </div>
        </div>
        <div className="official-preflow-match">
          <span>{agendaDaPartida(props.partida).rotulo}</span>
          <h1>{props.teamA.name} <small>vs</small> {props.teamB.name}</h1>
          <AgendaPartidaLinha partida={props.partida} />
        </div>
      </header>

      <div className="official-preflow-steps">
        {steps.map((item, index) => (
          <button key={item.title} type="button" className={`${step === index ? 'is-active' : ''} ${index < step ? 'is-done' : ''}`} onClick={() => index <= step && setStep(index)}>
            <span>{index < step ? <Check size={15} /> : index + 1}</span>
            <strong>{item.title}</strong>
          </button>
        ))}
      </div>

      <section className="official-preflow-card">
        <div className="official-preflow-card-head">
          <div>
            <span>Etapa {step + 1} de {steps.length}</span>
            <h2>{steps[step].title}</h2>
            <p>{steps[step].description}</p>
          </div>
          <div className="official-preflow-counter">
            <strong>{validatedTotal}/{total}</strong>
            <span>atletas validados</span>
          </div>
        </div>

        {step === 0 && (
          <>
            <div className="official-preflow-qr">
              <div>
                <Users size={42} />
                <h3>Equipes da partida</h3>
                <p>Confirme os elencos disponíveis para esta partida. A escalação será montada depois do sorteio e da definição do saque inicial.</p>
              </div>
              <div className="official-preflow-qr-actions">
                <button type="button" className="is-test" onClick={validateAll}>Confirmar equipes</button>
              </div>
            </div>
            <div className="official-validation-board">
              <PlayerValidationList team={props.teamA} validated={props.validatedA} onToggle={(number) => props.setValidatedA((current) => current.includes(number) ? current.filter((item) => item !== number) : [...current, number])} />
              <PlayerValidationList team={props.teamB} validated={props.validatedB} onToggle={(number) => props.setValidatedB((current) => current.includes(number) ? current.filter((item) => item !== number) : [...current, number])} />
            </div>
          </>
        )}

        {step === 1 && (
          <div className="official-preflow-setup-grid">
            <CaptainSelect team={props.teamA} value={props.captA} onChange={props.setCaptA} />
            <CaptainSelect team={props.teamB} value={props.captB} onChange={props.setCaptB} />
            <InitialServeSetup
              teamA={props.teamA}
              teamB={props.teamB}
              value={props.servingChoice}
              onChange={(teamId) => {
                props.set1ServingTeamId(teamId)
                props.setTossWinnerTeamId(teamId)
                props.setTossDecision('SAQUE')
              }}
            />
          </div>
        )}

      </section>

      <footer className="official-preflow-actions">
        <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Anterior</button>
        <button type="button" className="is-primary" onClick={nextStep} disabled={!canAdvance}>{step === steps.length - 1 ? 'Ir para escalação' : 'Próximo passo'}</button>
      </footer>

      {scannerOpen && (
        <div className="official-qr-scanner-modal" role="dialog" aria-modal="true" aria-label="Validação por QR Code">
          <div className="official-qr-scanner">
            <div className="official-qr-scanner-head">
              <div>
                <span>Leitor ativo</span>
                <h3>Validar atleta por QR Code</h3>
              </div>
              <button type="button" onClick={closeScanner} aria-label="Fechar leitor">×</button>
            </div>
            <div className="official-qr-video-frame">
              <video ref={videoRef} playsInline muted />
              <i />
            </div>
            {pendingQrPlayer && (
              <div className="official-qr-confirm-card">
                <div className="official-qr-confirm-profile">
                  <PlayerAvatar player={{ id: 0, number: pendingQrPlayer.number, name: pendingQrPlayer.name, status: 'pendente', photoUrl: pendingQrPlayer.photoUrl }} />
                  <div>
                    <span>{pendingQrPlayer.teamName}</span>
                    <strong>#{pendingQrPlayer.number} {pendingQrPlayer.name}</strong>
                    <small>Confirme se este é o atleta apresentado pelo QR Code.</small>
                  </div>
                </div>
                <div className="official-qr-confirm-actions">
                  <button type="button" onClick={rejectPendingQr}>Não validar</button>
                  <button type="button" onClick={confirmPendingQr}><Check size={14} /> Validar atleta</button>
                </div>
              </div>
            )}
            <p className={scannerBusy ? 'is-busy' : ''}>{scannerMessage}</p>
            <div className="official-qr-manual">
              <label htmlFor="manual-qr">Validação manual</label>
              <div>
                <input id="manual-qr" value={manualQrToken} onChange={(event) => setManualQrToken(event.target.value)} placeholder="Cole o token ou link do QR Code" />
                <button type="button" onClick={validateManualQr} disabled={!manualQrToken.trim() || scannerBusy || Boolean(pendingQrPlayer)}>Validar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function PrePartidaTab(props: {
  teamA: Team
  teamB: Team
  currentSet: number
  currentScore: { teamA: number; teamB: number }
  setsWon: { teamA: number; teamB: number }
  events: MatchEvent[]
  stepChecklist: Record<string, boolean>
  validatedA: string[]
  validatedB: string[]
  captA: string
  captB: string
  setCaptA: (value: string) => void
  setCaptB: (value: string) => void
  setValidatedA: React.Dispatch<React.SetStateAction<string[]>>
  setValidatedB: React.Dispatch<React.SetStateAction<string[]>>
  preGameValidated: boolean
  set1ServingTeamId: (value: TeamId) => void
  servingChoice: TeamId | null
  onConfirmSetup: () => void
  addMatchEvent: (type: EventType, text: string, teamId?: TeamId) => string
}) {
  const [setupTab, setSetupTab] = useState<'qr' | 'capt' | 'saque'>('qr')
  const total = props.teamA.players.length + props.teamA.reserves.length + props.teamB.players.length + props.teamB.reserves.length
  const validatedTotal = props.validatedA.length + props.validatedB.length

  function validateAll() {
    props.setValidatedA([...props.teamA.players, ...props.teamA.reserves].map((p) => p.number))
    props.setValidatedB([...props.teamB.players, ...props.teamB.reserves].map((p) => p.number))
    props.addMatchEvent('system', 'Todos os atletas foram validados em lote.')
  }

  return (
    <div className="official-grid">
      <section className="official-panel official-span-8">
        <div className="official-score-strip">
          <div><span>{props.teamA.name}</span><strong>{props.currentScore.teamA.toString().padStart(2, '0')}</strong></div>
          <div><span>Set {props.currentSet}</span><strong>{props.setsWon.teamA} x {props.setsWon.teamB}</strong><em>sets vencidos</em></div>
          <div><span>{props.teamB.name}</span><strong>{props.currentScore.teamB.toString().padStart(2, '0')}</strong></div>
        </div>

        <div className="official-tabs-inline">
          <button className={setupTab === 'qr' ? 'is-active' : ''} onClick={() => setSetupTab('qr')}><QrCode size={18} /> 1. Conferência QR Code {props.stepChecklist.conferido && <Check size={14} />}</button>
          <button className={setupTab === 'capt' ? 'is-active' : ''} onClick={() => setSetupTab('capt')}><Award size={18} /> 2. Capitães {props.stepChecklist.capitaes && <Check size={14} />}</button>
          <button className={setupTab === 'saque' ? 'is-active' : ''} onClick={() => setSetupTab('saque')}><RefreshCw size={18} /> 3. Saque inicial {props.stepChecklist.saque && <Check size={14} />}</button>
        </div>

        {setupTab === 'qr' && (
          <>
          <div className="official-pre-grid">
            <div className="official-mini-panel">
              <h3>Controle de inscrições</h3>
              <div className="official-counters">
                <div><span>{props.teamA.name}</span><strong>{props.validatedA.length}/{props.teamA.players.length + props.teamA.reserves.length}</strong></div>
                <div><span>{props.teamB.name}</span><strong>{props.validatedB.length}/{props.teamB.players.length + props.teamB.reserves.length}</strong></div>
                <div><span>Pendentes</span><strong>{Math.max(0, total - validatedTotal)}</strong></div>
                <div><span>Mínimo por equipe</span><strong>{props.preGameValidated ? 'OK' : '6'}</strong></div>
              </div>
              <button className="official-dark-button" onClick={validateAll}>Validar todos</button>
            </div>
            <div className="official-camera-box">
              <QrCode size={52} />
              <h3>Leitor de QR Code do árbitro</h3>
              <p>Aponte a câmera para o QR Code do atleta ou use a validação em lote quando a conferência já tiver sido feita pela equipe de arbitragem.</p>
              <button onClick={validateAll}>Escanear QR Code</button>
            </div>
          </div>
          <div className="official-validation-board">
            <PlayerValidationList team={props.teamA} validated={props.validatedA} onToggle={(number) => props.setValidatedA((current) => current.includes(number) ? current.filter((item) => item !== number) : [...current, number])} />
            <PlayerValidationList team={props.teamB} validated={props.validatedB} onToggle={(number) => props.setValidatedB((current) => current.includes(number) ? current.filter((item) => item !== number) : [...current, number])} />
          </div>
          </>
        )}

        {setupTab === 'capt' && (
          <div className="official-two-cols">
            <CaptainSelect team={props.teamA} value={props.captA} onChange={props.setCaptA} />
            <CaptainSelect team={props.teamB} value={props.captB} onChange={props.setCaptB} />
          </div>
        )}

        {setupTab === 'saque' && (
          <div className="official-two-cols">
            <ServeChoice team={props.teamA} active={props.servingChoice === 'teamA'} onClick={() => props.set1ServingTeamId('teamA')} />
            <ServeChoice team={props.teamB} active={props.servingChoice === 'teamB'} onClick={() => props.set1ServingTeamId('teamB')} />
          </div>
        )}

        <div className="official-footer-actions">
          <button className="official-primary" disabled={!props.preGameValidated || !props.stepChecklist.capitaes || !props.stepChecklist.saque} onClick={props.onConfirmSetup}>Salvar pré-jogo e ir para escalação</button>
        </div>
      </section>

      <Checklist events={props.events} checklist={props.stepChecklist} />
    </div>
  )
}

function ResumoTab({ teamA, teamB, currentSet, currentScore, setsWon, events, anotacoes, timeoutsUsedA, timeoutsUsedB, temposSeparados = false, temposEquipeA = 0, temposEquipeB = 0, getMatchNumber, sidesInverted }: {
  teamA: Team
  teamB: Team
  currentSet: number
  currentScore: { teamA: number; teamB: number }
  setsWon: { teamA: number; teamB: number }
  events: MatchEvent[]
  anotacoes: Anotacao[]
  timeoutsUsedA: number
  timeoutsUsedB: number
  temposSeparados?: boolean
  temposEquipeA?: number
  temposEquipeB?: number
  getMatchNumber?: (teamId: TeamId, number: string) => string
  sidesInverted: boolean
}) {
  const pointEvents = events.filter((event) => ['point', 'attack', 'block', 'ace'].includes(event.type))
  const substitutionEvents = events.filter((event) => ['substitution', 'libero_exchange'].includes(event.type))
  const systemEvents = events.filter((event) => event.type === 'system' || event.type === 'set_end')
  const latest = [...events].slice(0, 8)
  const scout = buildOfficialScout(teamA, teamB, events, getMatchNumber)
  const orderedScout = sidesInverted ? [...scout].reverse() : scout
  const leftTeamId: TeamId = sidesInverted ? 'teamB' : 'teamA'
  const rightTeamId: TeamId = sidesInverted ? 'teamA' : 'teamB'
  const leftTeam = leftTeamId === 'teamA' ? teamA : teamB
  const rightTeam = rightTeamId === 'teamA' ? teamA : teamB

  return (
    <div className="official-grid">
      <section className="official-panel official-span-8">
        <div className="official-section-row">
          <h3>Resumo da partida</h3>
          <span>Set {currentSet} - {currentScore.teamA} x {currentScore.teamB}</span>
        </div>
        <div className="official-summary-board">
          <div>
            <span>{leftTeam.name}</span>
            <strong>{currentScore[leftTeamId].toString().padStart(2, '0')}</strong>
            <em>{setsWon[leftTeamId]} set(s)</em>
          </div>
          <div>
            <span>Placar geral</span>
            <strong>{setsWon[leftTeamId]} x {setsWon[rightTeamId]}</strong>
            <em>sets vencidos</em>
          </div>
          <div>
            <span>{rightTeam.name}</span>
            <strong>{currentScore[rightTeamId].toString().padStart(2, '0')}</strong>
            <em>{setsWon[rightTeamId]} set(s)</em>
          </div>
        </div>
        <div className="official-summary-metrics">
          <div><span>Pontos registrados</span><strong>{pointEvents.length}</strong></div>
          <div><span>Substituições</span><strong>{substitutionEvents.length}</strong></div>
          <div><span>Tempos técnicos</span><strong>{timeoutsUsedA + timeoutsUsedB}</strong></div>
          {temposSeparados ? <div><span>Tempos de equipe</span><strong>{temposEquipeA + temposEquipeB}</strong></div> : null}
          <div><span>Anotações oficiais</span><strong>{anotacoes.length}</strong></div>
        </div>
        <div className="official-section-row official-scout-heading"><h3>Scout individual</h3><span>{textoResumoScout(resumirPontos(pointEvents))}</span></div>
        <div className="official-scout-grid">
          {orderedScout.map((teamScout) => (
            <section key={teamScout.teamId}>
              <h4>{teamScout.teamName}</h4>
              {teamScout.players.length ? (
                <div className="official-scout-table">
                  <div><span>Atleta</span><span>Pts</span><span>Ataque</span><span>Bloqueio</span><span>Saque</span></div>
                  {teamScout.players.map((player) => (
                    <div key={`${teamScout.teamId}-${player.number}-${player.name}`}>
                      <strong>#{player.number} {player.name}</strong>
                      <b>{player.points}</b>
                      <b>{player.attacks}</b>
                      <b>{player.blocks}</b>
                      <b>{player.aces}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="Nenhum ponto individual registrado para esta equipe." />
              )}
            </section>
          ))}
        </div>
      </section>

      <section className="official-panel official-span-4">
        <div className="official-section-row"><h3>Últimos registros</h3><span>{latest.length} eventos</span></div>
        <div className="official-log-list compact">
          {latest.length ? latest.map((event) => <LogItem key={event.id} event={event} />) : <Empty text="Nenhum ponto, tempo ou ocorrência registrado ainda." />}
        </div>
      </section>

      <section className="official-panel official-span-12">
        <div className="official-section-row"><h3>Linha do tempo oficial</h3><span>{systemEvents.length} marcos</span></div>
        <div className="official-log-list">
          {events.length ? events.map((event) => <LogItem key={event.id} event={event} />) : <Empty text="A súmula ainda não possui registros de partida." />}
        </div>
      </section>
    </div>
  )
}

function PontuacaoTab(props: {
  teamA: Team
  teamB: Team
  currentSet: number
  currentScore: { teamA: number; teamB: number }
  setsWon: { teamA: number; teamB: number }
  servingTeamId: TeamId
  sidesInverted: boolean
  lineupA: string[]
  lineupB: string[]
  benchA: string[]
  benchB: string[]
  serverIndexA: number
  serverIndexB: number
  pointFlash: { teamId: TeamId; number: string; id: number } | null
  rules: MatchRules
  subModal: { teamId: TeamId; index: number; outNumber: string } | null
  allowedSubstitutions: string[]
  substitutionNotice: string | null
  getMatchNumber: (teamId: TeamId, number: string) => string
  events: MatchEvent[]
  onAttack: (teamId: TeamId, number: string) => void
  onBlock: (teamId: TeamId, number: string) => void
  onAce: () => void
  onPoint: (teamId: TeamId) => void
  onSubstitution: (teamId: TeamId, index: number) => void
  onSelectSubstitution: (number: string, porLesao?: boolean) => void
  onCloseSubstitution: () => void
  onUndo: () => void
  onUndoTeamPoint: (teamId: TeamId) => void
  onCloseSet: () => void
  timeoutsUsedA: number
  timeoutsUsedB: number
  temposEquipeA: number
  temposEquipeB: number
  onTimeout: (teamId: TeamId) => void
  onTempoEquipe: (teamId: TeamId) => void
  onTempoMedico: (teamId: TeamId) => void
  saveNote: (payload: Omit<Anotacao, 'id' | 'set' | 'placar' | 'timestamp'>) => void
  vistaQuadra: '2d' | '3d'
  encerrada?: boolean
}) {
  const [cardModal, setCardModal] = useState<{ teamId: TeamId; tipo: 'Cartão amarelo' | 'Cartão vermelho' } | null>(null)
  const substitutionTeam = props.subModal?.teamId === 'teamA' ? props.teamA : props.teamB
  const substitutionLineup = props.subModal?.teamId === 'teamA' ? props.lineupA : props.lineupB
  const substitutionBench = props.subModal?.teamId === 'teamA' ? props.benchA : props.benchB
  const penaltyTeam = cardModal?.teamId === 'teamA' ? props.teamA : props.teamB

  const leftTeamId: TeamId = props.sidesInverted ? 'teamB' : 'teamA'
  const rightTeamId: TeamId = props.sidesInverted ? 'teamA' : 'teamB'
  const leftTeam = leftTeamId === 'teamA' ? props.teamA : props.teamB
  const rightTeam = rightTeamId === 'teamA' ? props.teamA : props.teamB
  const leftLineup = leftTeamId === 'teamA' ? props.lineupA : props.lineupB
  const rightLineup = rightTeamId === 'teamA' ? props.lineupA : props.lineupB
  const leftServerIndex = leftTeamId === 'teamA' ? props.serverIndexA : props.serverIndexB
  const rightServerIndex = rightTeamId === 'teamA' ? props.serverIndexA : props.serverIndexB
  const leftTimeoutsUsed = leftTeamId === 'teamA' ? props.timeoutsUsedA : props.timeoutsUsedB
  const rightTimeoutsUsed = rightTeamId === 'teamA' ? props.timeoutsUsedA : props.timeoutsUsedB
  const leftTemposEquipe = leftTeamId === 'teamA' ? props.temposEquipeA : props.temposEquipeB
  const rightTemposEquipe = rightTeamId === 'teamA' ? props.temposEquipeA : props.temposEquipeB

  return (
    <>
      {props.vistaQuadra === '2d' ? (
      <>
      <div className="official-facing-court" aria-label="Quadra 2D com as equipes de frente">
        <RosterClickers key={leftTeamId} teamId={leftTeamId} mirrored={false} team={leftTeam} lineup={leftLineup} servingTeam={props.servingTeamId === leftTeamId} serverIndex={leftServerIndex} pointFlash={props.pointFlash} getMatchNumber={props.getMatchNumber} encerrada={props.encerrada} onAttack={(number) => props.onAttack(leftTeamId, number)} onBlock={(number) => props.onBlock(leftTeamId, number)} onSubstitution={props.onSubstitution} />
        <div className="official-facing-net" aria-hidden="true"><span>Rede</span></div>
        <RosterClickers key={rightTeamId} teamId={rightTeamId} mirrored={true} team={rightTeam} lineup={rightLineup} servingTeam={props.servingTeamId === rightTeamId} serverIndex={rightServerIndex} pointFlash={props.pointFlash} getMatchNumber={props.getMatchNumber} encerrada={props.encerrada} onAttack={(number) => props.onAttack(rightTeamId, number)} onBlock={(number) => props.onBlock(rightTeamId, number)} onSubstitution={props.onSubstitution} />
      </div>
      <div className="official-score-layout is-facing">
        <div className="official-team-score-group is-team-a">
          <CompactTeamControl
            teamId={leftTeamId}
            team={leftTeam}
            score={props.currentScore[leftTeamId]}
            serving={props.servingTeamId === leftTeamId}
            onAce={props.onAce}
            onPoint={() => props.onPoint(leftTeamId)}
            onUndo={() => props.onUndoTeamPoint(leftTeamId)}
            onCard={(tipo) => setCardModal({ teamId: leftTeamId, tipo })}
            timeoutsUsed={leftTimeoutsUsed}
            limite={props.rules.timeoutLimit}
            temposSeparados={props.rules.temposSeparados}
            temposEquipeUsados={leftTemposEquipe}
            onTimeout={() => props.onTimeout(leftTeamId)}
            onTempoEquipe={() => props.onTempoEquipe(leftTeamId)}
            tempoMedico={props.rules.tempoMedico}
            onTempoMedico={() => props.onTempoMedico(leftTeamId)}
            events={props.events}
            encerrada={props.encerrada}
          />
        </div>
        <div className="official-score-between">
          <div className="official-compact-set-score" aria-label="Placar de sets">
            <span>{props.setsWon[leftTeamId]}</span>
            <small>sets</small>
            <span>{props.setsWon[rightTeamId]}</span>
          </div>
        </div>
        <div className="official-team-score-group is-team-b">
          <CompactTeamControl
            teamId={rightTeamId}
            team={rightTeam}
            score={props.currentScore[rightTeamId]}
            serving={props.servingTeamId === rightTeamId}
            onAce={props.onAce}
            onPoint={() => props.onPoint(rightTeamId)}
            onUndo={() => props.onUndoTeamPoint(rightTeamId)}
            onCard={(tipo) => setCardModal({ teamId: rightTeamId, tipo })}
            timeoutsUsed={rightTimeoutsUsed}
            limite={props.rules.timeoutLimit}
            temposSeparados={props.rules.temposSeparados}
            temposEquipeUsados={rightTemposEquipe}
            onTimeout={() => props.onTimeout(rightTeamId)}
            onTempoEquipe={() => props.onTempoEquipe(rightTeamId)}
            tempoMedico={props.rules.tempoMedico}
            onTempoMedico={() => props.onTempoMedico(rightTeamId)}
            events={props.events}
            encerrada={props.encerrada}
          />
        </div>
      </div>
      </>
      ) : (
      <div className="official-match-board">
        <div className="official-match-controls">
          <CompactTeamControl
            teamId={leftTeamId}
            team={leftTeam}
            score={props.currentScore[leftTeamId]}
            serving={props.servingTeamId === leftTeamId}
            onAce={props.onAce}
            onPoint={() => props.onPoint(leftTeamId)}
            onUndo={() => props.onUndoTeamPoint(leftTeamId)}
            onCard={(tipo) => setCardModal({ teamId: leftTeamId, tipo })}
            timeoutsUsed={leftTimeoutsUsed}
            limite={props.rules.timeoutLimit}
            temposSeparados={props.rules.temposSeparados}
            temposEquipeUsados={leftTemposEquipe}
            onTimeout={() => props.onTimeout(leftTeamId)}
            onTempoEquipe={() => props.onTempoEquipe(leftTeamId)}
            tempoMedico={props.rules.tempoMedico}
            onTempoMedico={() => props.onTempoMedico(leftTeamId)}
            events={props.events}
            encerrada={props.encerrada}
          />
          <div className="official-compact-set-score" aria-label="Placar de sets">
            <span>{props.setsWon[leftTeamId]}</span>
            <small>sets</small>
            <span>{props.setsWon[rightTeamId]}</span>
          </div>
          <CompactTeamControl
            teamId={rightTeamId}
            team={rightTeam}
            score={props.currentScore[rightTeamId]}
            serving={props.servingTeamId === rightTeamId}
            onAce={props.onAce}
            onPoint={() => props.onPoint(rightTeamId)}
            onUndo={() => props.onUndoTeamPoint(rightTeamId)}
            onCard={(tipo) => setCardModal({ teamId: rightTeamId, tipo })}
            timeoutsUsed={rightTimeoutsUsed}
            limite={props.rules.timeoutLimit}
            temposSeparados={props.rules.temposSeparados}
            temposEquipeUsados={rightTemposEquipe}
            onTimeout={() => props.onTimeout(rightTeamId)}
            onTempoEquipe={() => props.onTempoEquipe(rightTeamId)}
            tempoMedico={props.rules.tempoMedico}
            onTempoMedico={() => props.onTempoMedico(rightTeamId)}
            events={props.events}
            encerrada={props.encerrada}
          />
        </div>
        <QuadraVolei
          modo="jogo"
          encerrada={props.encerrada}
          numeroExibido={props.getMatchNumber}
          destaque={props.pointFlash ? { teamId: props.pointFlash.teamId, numero: props.pointFlash.number } : null}
          esquerda={ladoQuadra(leftTeam, leftLineup, props.servingTeamId === leftTeamId, leftServerIndex)}
          direita={ladoQuadra(rightTeam, rightLineup, props.servingTeamId === rightTeamId, rightServerIndex)}
          onAtaque={(teamId, numero) => props.onAttack(teamId, numero)}
          onBloqueio={(teamId, numero) => props.onBlock(teamId, numero)}
          onAce={() => props.onAce()}
          onSubstituicao={props.onSubstitution}
        />
      </div>
      )}
      <SumulaSubShell aberto={Boolean(props.subModal)}>
        {props.subModal ? (
          <PlayerModal
            title="Substituir atleta"
            team={substitutionTeam}
            lineup={substitutionLineup}
            bench={substitutionBench}
            onlyBench={props.allowedSubstitutions}
            notice={props.substitutionNotice}
            teamId={props.subModal.teamId}
            permiteLesao={props.rules.substituicaoPorLesao}
            getMatchNumber={props.getMatchNumber}
            onSelect={props.onSelectSubstitution}
            onClose={props.onCloseSubstitution}
          />
        ) : null}
      </SumulaSubShell>
      <section className="official-point-history" aria-label="Últimos pontos">
        <h3>Últimos pontos</h3>
        <ol>
          {props.events.map((event, indice) => ({ event, indice })).filter(({ event }) => event.type === 'ace' || event.type === 'attack' || event.type === 'block' || ehPontoSemJogador(event.text)).slice(0, 8).map(({ event, indice }) => {
            const equipe = event.teamId === 'teamA' ? props.teamA.name : event.teamId === 'teamB' ? props.teamB.name : ''
            const rotulo = lerRotuloPonto(event.text) ?? ROTULO_PONTO[event.type as OrigemPonto]
            const placar = placarNaOrientacao(event.score, ladosInvertidosNoPonto(props.events, indice, props.sidesInverted))
            return (
            <li key={event.id}>
              <strong>{event.time} — {equipe} {rotulo}</strong>
              <span>{lerJogadorPonto(event.text) ?? 'Atleta'}</span>
              <em>{placar}</em>
            </li>
            )
          })}
          {props.events.every((event) => event.type !== 'ace' && event.type !== 'attack' && event.type !== 'block' && !ehPontoSemJogador(event.text)) && <li>Nenhum ponto registrado ainda.</li>}
        </ol>
      </section>
      {cardModal && (
        <PenaltyModal
          team={penaltyTeam}
          tipo={cardModal.tipo}
          onClose={() => setCardModal(null)}
          onSave={(payload) => {
            props.saveNote(payload)
            setCardModal(null)
          }}
        />
      )}
    </>
  )
}

function EscalacaoTab(props: {
  teamA: Team
  teamB: Team
  currentSet: number
  lineupA: string[]
  lineupB: string[]
  benchA: string[]
  benchB: string[]
  selectedSlot: { teamId: TeamId; index: number } | null
  subModal: { teamId: TeamId; index: number; outNumber: string } | null
  lineupConfirmed: boolean
  lineupConfirmedA: boolean
  lineupConfirmedB: boolean
  startingLiberos: Record<TeamId, string>
  initialServer: TeamId | null
  setInitialServer: (teamId: TeamId) => void
  setEditingSlot: (slot: { teamId: TeamId; index: number } | null) => void
  askSubstitution: (teamId: TeamId, index: number) => void
  changeSlot: (teamId: TeamId, index: number, number: string) => void
  confirmLineup: (teamId: TeamId) => void
  setStartingLibero: (teamId: TeamId, number: string) => void
  executeSubstitution: (number: string, porLesao?: boolean) => void
  permiteLesao?: boolean
  allowedSubstitutions: string[]
  substitutionNotice: string | null
  closeSubModal: () => void
  getMatchNumber: (teamId: TeamId, number: string) => string
  onMatchNumberChange: (teamId: TeamId, rosterNumber: string, value: string) => void
  vistaQuadra: '2d' | '3d'
  sidesInverted: boolean
  initialServers: Record<number, TeamId | null>
  onRegistrarSorteio: (teamId: TeamId, origem: 'aplicativo' | 'mesa') => void
  quantidadeLiberos?: 1 | 2 | null
}) {
  const [selectedTeamId, setSelectedTeamId] = useState<TeamId>('teamA')
  const [pickedNumber, setPickedNumber] = useState<string | null>(null)
  const [substitutionMode, setSubstitutionMode] = useState(false)
  const [editingNumberSlot, setEditingNumberSlot] = useState<number | null>(null)
  const [editingNumberDraft, setEditingNumberDraft] = useState('')
  const [pulsoAtleta, setPulsoAtleta] = useState<string | null>(null)
  useEffect(() => {
    if (props.lineupConfirmed) return
    if (props.lineupConfirmedA && !props.lineupConfirmedB) setSelectedTeamId('teamB')
    else if (props.lineupConfirmedB && !props.lineupConfirmedA) setSelectedTeamId('teamA')
  }, [props.lineupConfirmed, props.lineupConfirmedA, props.lineupConfirmedB])
  useEffect(() => {
    setSubstitutionMode(false)
    setEditingNumberSlot(null)
    setPickedNumber(null)
  }, [selectedTeamId, props.currentSet, props.lineupConfirmed])
  const team = selectedTeamId === 'teamA' ? props.teamA : props.teamB
  const lineup = selectedTeamId === 'teamA' ? props.lineupA : props.lineupB
  const bench = (selectedTeamId === 'teamA' ? props.benchA : props.benchB).filter((number) => number !== (props.startingLiberos[selectedTeamId] ?? ''))
  const selectedLibero = props.startingLiberos[selectedTeamId] ?? ''
  const liberoOptions = getLiberoOptions(team, lineup, props.quantidadeLiberos)
  const posicoes = ['P4', 'P3', 'P2', 'P5', 'P6', 'P1']
  const selectedTeamConfirmed = selectedTeamId === 'teamA' ? props.lineupConfirmedA : props.lineupConfirmedB
  const reviewLibero = props.startingLiberos[selectedTeamId] ?? ''
  const buttonLabel = selectedTeamConfirmed ? `${team.name} confirmado` : `Confirmar ${team.name}`
  const otherTeamId: TeamId = selectedTeamId === 'teamA' ? 'teamB' : 'teamA'
  const otherTeam = otherTeamId === 'teamA' ? props.teamA : props.teamB
  const otherConfirmed = otherTeamId === 'teamA' ? props.lineupConfirmedA : props.lineupConfirmedB
  const confirmedCount = Number(props.lineupConfirmedA) + Number(props.lineupConfirmedB)
  const modoSaque = modoSaqueInicial(props.currentSet)
  const saqueAnterior = props.initialServers[props.currentSet - 1] ?? null
  const saqueAlternado = saqueObrigatorio(props.currentSet, saqueAnterior)
  const servidorExibido: TeamId | null = modoSaque === 'alternancia' ? saqueAlternado : props.initialServer
  const nomeServidor = servidorExibido === 'teamA' ? props.teamA.name : servidorExibido === 'teamB' ? props.teamB.name : ''
  const nomeAnterior = saqueAnterior === 'teamA' ? props.teamA.name : saqueAnterior === 'teamB' ? props.teamB.name : ''
  const ladoEsquerdoId: TeamId = props.sidesInverted ? 'teamB' : 'teamA'
  const ladoDireitoId: TeamId = props.sidesInverted ? 'teamA' : 'teamB'
  const equipeEsquerda = ladoEsquerdoId === 'teamA' ? props.teamA : props.teamB
  const equipeDireita = ladoDireitoId === 'teamA' ? props.teamA : props.teamB
  const escalacaoEsquerda = ladoEsquerdoId === 'teamA' ? props.lineupA : props.lineupB
  const escalacaoDireita = ladoDireitoId === 'teamA' ? props.lineupA : props.lineupB
  const zonasEsquerda = [
    { label: 'P5', index: 3 },
    { label: 'P4', index: 0 },
    { label: 'P6', index: 4 },
    { label: 'P3', index: 1 },
    { label: 'P1', index: 5 },
    { label: 'P2', index: 2 },
  ]
  const zonasDireita = [
    { label: 'P2', index: 2 },
    { label: 'P1', index: 5 },
    { label: 'P3', index: 1 },
    { label: 'P6', index: 4 },
    { label: 'P4', index: 0 },
    { label: 'P5', index: 3 },
  ]

  function abrirPosicao(teamId: TeamId, index: number) {
    if (teamId !== selectedTeamId) setSelectedTeamId(teamId)
    if (props.lineupConfirmed) props.askSubstitution(teamId, index)
    else props.setEditingSlot({ teamId, index })
  }

  function ladoEscalacao2d(teamId: TeamId, zonas: Array<{ label: string; index: number }>) {
    const sideTeam = teamId === 'teamA' ? props.teamA : props.teamB
    const sideLineup = teamId === 'teamA' ? props.lineupA : props.lineupB
    const sideConfirmed = teamId === 'teamA' ? props.lineupConfirmedA : props.lineupConfirmedB
    const sideLibero = props.startingLiberos[teamId] ?? ''
    return (
      <div className={`official-court is-facing ${teamId === selectedTeamId ? 'is-selected' : ''}`}>
        <strong>{sideTeam.name}</strong>
        <div>
          {zonas.map((slot) => {
            const number = sideLineup[slot.index]
            const player = getAnyPlayer(sideTeam, number)
            const canEditNumber = props.currentSet === 1 && teamId === selectedTeamId && !sideConfirmed && Boolean(number)
            const displayNumber = number ? props.getMatchNumber(teamId, number) : number
            return (
              <div
                key={`${teamId}-${slot.label}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  abrirPosicao(teamId, slot.index)
                  dispararPulso(setPulsoAtleta, `${teamId}-${slot.index}`)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  abrirPosicao(teamId, slot.index)
                }}
                className={`${number ? 'is-filled' : ''} ${teamId === selectedTeamId && substitutionMode ? 'is-substitution-mode' : ''} ${number && number === sideLibero ? 'is-libero-start' : ''} ${pulsoAtleta === `${teamId}-${slot.index}` ? 'sumula-micro-tap' : ''}`}
                onAnimationEnd={(event) => limparPulso(event, setPulsoAtleta)}
              >
                <span>{slot.label}</span>
                {number && canEditNumber && editingNumberSlot === slot.index ? (
                  <input
                    className="official-slot-number-edit"
                    value={editingNumberDraft}
                    autoFocus
                    aria-label="Número do atleta na partida"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur()
                    }}
                    onChange={(event) => setEditingNumberDraft(event.target.value.replace(/[^\dA-Za-z-]/g, '').slice(0, 4))}
                    onBlur={() => { props.onMatchNumberChange(teamId, number, editingNumberDraft); setEditingNumberSlot(null) }}
                  />
                ) : (
                  <strong>{number ? `#${displayNumber}` : 'Sem atleta'}</strong>
                )}
                {number && number === sideLibero && <em>Líbero</em>}
                <small>{player ? displayPlayerName(player.name, sideTeam.name) : 'Clique para escalar'}</small>
                {canEditNumber && (
                  <button
                    type="button"
                    className="official-sub-action is-icon official-slot-edit-number"
                    onClick={(event) => { event.stopPropagation(); setSelectedTeamId(teamId); setEditingNumberDraft(displayNumber); setEditingNumberSlot(slot.index) }}
                    aria-label={`Corrigir número do atleta ${number} nesta partida`}
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="official-panel">
      <div className="official-team-selector" role="tablist" aria-label="Times para conferir a papeleta">
        {(['teamA', 'teamB'] as const).map((teamId) => {
          const side = teamId === 'teamA' ? props.teamA : props.teamB
          const confirmed = teamId === 'teamA' ? props.lineupConfirmedA : props.lineupConfirmedB
          return (
            <button
              key={teamId}
              type="button"
              role="tab"
              aria-selected={selectedTeamId === teamId}
              className={`${selectedTeamId === teamId ? 'is-active' : ''} ${confirmed ? 'is-confirmed' : ''}`}
              onClick={() => setSelectedTeamId(teamId)}
            >
              <span>{side.name}</span>
              <small>{confirmed ? 'Confirmada' : 'Pendente'}</small>
            </button>
          )
        })}
      </div>
      {!props.lineupConfirmed && (
        <div className="official-lineup-review">
          <span>Conferência obrigatória</span>
          <strong>Revise a escalação de {team.name}</strong>
          <p>{confirmedCount} de 2 papeletas confirmadas. Confira este time, confirme e avance para o outro. A pontuação só libera quando as duas papeletas estiverem confirmadas.</p>
        </div>
      )}
      <div className="official-grid">
        <section className="official-mini-panel official-span-8">
          <div className="official-section-row official-lineup-heading">
            <h3 key={props.currentSet} className="sumula-micro-set">Papeleta de distribuição tática - Set {props.currentSet}</h3>
            <div>
              {props.lineupConfirmed && (
                <button
                  type="button"
                  className={`official-lineup-mode-button ${substitutionMode ? 'is-active' : ''}`}
                  onClick={() => setSubstitutionMode((current) => !current)}
                >
                  {substitutionMode ? 'Modo líbero' : 'Modo substituição'}
                </button>
              )}
              <span>{team.name}</span>
            </div>
          </div>
          {!props.lineupConfirmed ? (
          <>
          <p className="volley-help">Toque numa posição ou arraste um atleta do banco. Esta papeleta é só de {team.name}.{pickedNumber ? ` Atleta #${pickedNumber} selecionado.` : ''}</p>
          <div className="official-court" aria-label={`Papeleta de ${team.name}`}>
            <p className="official-court-net">Rede</p>
            <div>
              {posicoes.map((position, index) => {
                const number = lineup[index]
                const player = getAnyPlayer(team, number)
                const canEditNumber = props.currentSet === 1 && !selectedTeamConfirmed && Boolean(number)
                const displayNumber = number ? props.getMatchNumber(selectedTeamId, number) : number
                return (
                  <div
                    key={position}
                    role="button"
                    tabIndex={0}
                    onDragOver={(event) => {
                      if (props.lineupConfirmed) return
                      event.preventDefault()
                    }}
                    onDrop={(event) => {
                      if (props.lineupConfirmed) return
                      event.preventDefault()
                      const numero = event.dataTransfer.getData('text/plain')
                      if (!numero) return
                      props.changeSlot(selectedTeamId, index, numero)
                      setPickedNumber(null)
                    }}
                    onClick={() => {
                      if (pickedNumber) {
                        props.changeSlot(selectedTeamId, index, pickedNumber)
                        setPickedNumber(null)
                        return
                      }
                      props.setEditingSlot({ teamId: selectedTeamId, index })
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      if (pickedNumber) {
                        props.changeSlot(selectedTeamId, index, pickedNumber)
                        setPickedNumber(null)
                        return
                      }
                      props.setEditingSlot({ teamId: selectedTeamId, index })
                    }}
                    className={`${number ? 'is-filled' : ''} ${number && number === selectedLibero ? 'is-libero-start' : ''}`}
                  >
                    <span>{position}</span>
                    {number && canEditNumber && editingNumberSlot === index ? (
                      <input
                        className="official-slot-number-edit"
                        value={editingNumberDraft}
                        autoFocus
                        aria-label="Número do atleta na partida"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          event.stopPropagation()
                          if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur()
                        }}
                        onChange={(event) => setEditingNumberDraft(event.target.value.replace(/[^\dA-Za-z-]/g, '').slice(0, 4))}
                        onBlur={() => { props.onMatchNumberChange(selectedTeamId, number, editingNumberDraft); setEditingNumberSlot(null) }}
                      />
                    ) : (
                      <strong>{number ? `#${displayNumber}` : 'Sem atleta'}</strong>
                    )}
                    {number && number === selectedLibero && <em>Líbero</em>}
                    <small>{player ? displayPlayerName(player.name, team.name) : 'Clique para escalar'}</small>
                    {canEditNumber && (
                      <button
                        type="button"
                        className="official-sub-action is-icon official-slot-edit-number"
                        onClick={(event) => { event.stopPropagation(); setEditingNumberDraft(displayNumber); setEditingNumberSlot(index) }}
                        aria-label={`Corrigir número do atleta ${number} nesta partida`}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          </>
          ) : props.vistaQuadra === '2d' ? (
          <div className="official-facing-court" aria-label="Escalação 2D com as equipes de frente">
            {ladoEscalacao2d(ladoEsquerdoId, zonasEsquerda)}
            <div className="official-facing-net" aria-hidden="true"><span>Rede</span></div>
            {ladoEscalacao2d(ladoDireitoId, zonasDireita)}
          </div>
          ) : (
          <>
          <p className="volley-help">A formação em quadra segue a rotação oficial. Toque em um atleta para substituir.{substitutionMode ? ' Modo substituição ativo.' : ''}</p>
          <QuadraVolei
            modo="escalacao"
            numeroExibido={props.getMatchNumber}
            esquerda={ladoEscalacao(equipeEsquerda, escalacaoEsquerda, false, props.startingLiberos[ladoEsquerdoId] ?? '')}
            direita={ladoEscalacao(equipeDireita, escalacaoDireita, false, props.startingLiberos[ladoDireitoId] ?? '')}
            onAtivar={(teamId, indice) => props.askSubstitution(teamId, indice)}
            onSoltar={() => undefined}
          />
          </>
          )}
          <div className="official-libero-start">
            <div>
              <span>Líbero inicial</span>
              <strong>{selectedLibero ? `#${selectedLibero} ${displayPlayerName(getAnyPlayer(team, selectedLibero)?.name ?? 'Atleta', team.name)}` : 'Defina antes de confirmar'}</strong>
            </div>
            <select value={selectedLibero} onChange={(event) => props.setStartingLibero(selectedTeamId, event.target.value)}>
              <option value="">Selecionar líbero</option>
              {liberoOptions.map((player) => (
                <option key={player.number} value={player.number}>#{player.number} - {displayPlayerName(player.name, team.name)}</option>
              ))}
            </select>
          </div>
          {!props.lineupConfirmed && (
            <div className="official-mini-panel official-initial-serve-panel">
              <h3>Saque inicial do set {props.currentSet}</h3>
              {modoSaque === 'escolha' && (
                <>
                  <p>Escolha a equipe que começa sacando neste set.</p>
                  <div className="official-two-cols">
                    <ServeChoice team={props.teamA} active={props.initialServer === 'teamA'} onClick={() => props.setInitialServer('teamA')} setNumber={props.currentSet} />
                    <ServeChoice team={props.teamB} active={props.initialServer === 'teamB'} onClick={() => props.setInitialServer('teamB')} setNumber={props.currentSet} />
                  </div>
                </>
              )}
              {modoSaque === 'alternancia' && (
                <div className="official-serve-locked" aria-live="polite">
                  <span>Alternância obrigatória</span>
                  <strong>{nomeServidor || 'Saque do set anterior ainda não definido'}</strong>
                  <p>{nomeServidor ? `${nomeServidor} começa sacando neste set porque não sacou no set ${props.currentSet - 1}. No set ${props.currentSet - 1} o saque foi de ${nomeAnterior}.` : `O saque deste set depende de quem começou sacando no set ${props.currentSet - 1}.`}</p>
                </div>
              )}
              {modoSaque === 'sorteio' && (
                <SorteioTieBreak
                  teamA={props.teamA}
                  teamB={props.teamB}
                  servidor={props.initialServer}
                  onRegistrar={props.onRegistrarSorteio}
                />
              )}
            </div>
          )}
          {!props.lineupConfirmed && (
            <div className="official-lineup-actions">
              <button className="official-primary" disabled={!reviewLibero || !servidorExibido || selectedTeamConfirmed} onClick={() => props.confirmLineup(selectedTeamId)}>{buttonLabel}</button>
              <button type="button" className="official-secondary" onClick={() => setSelectedTeamId(otherTeamId)}>
                {otherConfirmed ? `Ver ${otherTeam.name}` : `Conferir ${otherTeam.name}`}
              </button>
            </div>
          )}
        </section>
        <section className="official-mini-panel official-span-4">
          <div className="official-section-row"><h3>Banco de reservas</h3><span>{bench.length} atletas</span></div>
          <div className="official-bench">
            {bench.map((number) => (
              <button
                key={number}
                type="button"
                draggable={!props.lineupConfirmed}
                className={`${pickedNumber === number ? 'is-picked' : ''} ${pulsoAtleta === `banco-${number}` ? 'sumula-micro-tap' : ''}`}
                onAnimationEnd={(event) => limparPulso(event, setPulsoAtleta)}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', number)
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onClick={() => {
                  setPickedNumber((atual) => atual === number ? null : number)
                  dispararPulso(setPulsoAtleta, `banco-${number}`)
                }}
              >
                <strong>#{props.getMatchNumber(selectedTeamId, number)}</strong>
                <span>{getAnyPlayer(team, number)?.name ?? 'Atleta'}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      {props.selectedSlot && (
        <PlayerModal
          title="Escalar atleta"
          team={props.selectedSlot.teamId === 'teamA' ? props.teamA : props.teamB}
          lineup={props.selectedSlot.teamId === 'teamA' ? props.lineupA : props.lineupB}
          bench={props.selectedSlot.teamId === 'teamA' ? props.benchA : props.benchB}
          selectedLibero={props.startingLiberos[props.selectedSlot.teamId] ?? ''}
          hideLiberos
          onSelect={(number) => props.changeSlot(props.selectedSlot!.teamId, props.selectedSlot!.index, number)}
          onClose={() => props.setEditingSlot(null)}
        />
      )}
      <SumulaSubShell aberto={Boolean(props.subModal)}>
        {props.subModal ? (
          <PlayerModal
            title="Anotar substituição"
            team={props.subModal.teamId === 'teamA' ? props.teamA : props.teamB}
            lineup={props.subModal.teamId === 'teamA' ? props.lineupA : props.lineupB}
            bench={props.subModal.teamId === 'teamA' ? props.benchA : props.benchB}
            onlyBench={props.allowedSubstitutions}
            notice={props.substitutionNotice}
            permiteLesao={props.permiteLesao}
            onSelect={props.executeSubstitution}
            onClose={props.closeSubModal}
          />
        ) : null}
      </SumulaSubShell>
    </div>
  )
}

function TemposTab({ teamA, teamB, currentSet, currentScore, timeoutsUsedA, timeoutsUsedB, temposEquipeA = 0, temposEquipeB = 0, limite = 2, temposSeparados = false, events, requestTimeout, requestTempoEquipe, sidesInverted }: {
  teamA: Team
  teamB: Team
  currentSet: number
  currentScore: { teamA: number; teamB: number }
  timeoutsUsedA: number
  timeoutsUsedB: number
  temposEquipeA?: number
  temposEquipeB?: number
  limite?: number
  temposSeparados?: boolean
  events: MatchEvent[]
  requestTimeout: (teamId: TeamId) => void
  requestTempoEquipe?: (teamId: TeamId) => void
  sidesInverted: boolean
}) {
  const timeoutEvents = events.filter((event) => event.type === 'timeout')
  const leftTeamId: TeamId = sidesInverted ? 'teamB' : 'teamA'
  const rightTeamId: TeamId = sidesInverted ? 'teamA' : 'teamB'
  const leftTeam = leftTeamId === 'teamA' ? teamA : teamB
  const rightTeam = rightTeamId === 'teamA' ? teamA : teamB
  const leftUsed = leftTeamId === 'teamA' ? timeoutsUsedA : timeoutsUsedB
  const rightUsed = rightTeamId === 'teamA' ? timeoutsUsedA : timeoutsUsedB
  const leftEquipe = leftTeamId === 'teamA' ? temposEquipeA : temposEquipeB
  const rightEquipe = rightTeamId === 'teamA' ? temposEquipeA : temposEquipeB
  return (
    <div className="official-grid">
      <section className="official-span-8 official-two-cols">
        <TimeoutCard team={leftTeam} used={leftUsed} set={currentSet} limite={limite} onRequest={() => requestTimeout(leftTeamId)} />
        <TimeoutCard team={rightTeam} used={rightUsed} set={currentSet} limite={limite} onRequest={() => requestTimeout(rightTeamId)} />
        {temposSeparados && requestTempoEquipe ? (
          <>
            <TimeoutCard team={leftTeam} used={leftEquipe} set={currentSet} limite={limite} rotulo="Tempo de equipe" onRequest={() => requestTempoEquipe(leftTeamId)} />
            <TimeoutCard team={rightTeam} used={rightEquipe} set={currentSet} limite={limite} rotulo="Tempo de equipe" onRequest={() => requestTempoEquipe(rightTeamId)} />
          </>
        ) : null}
      </section>
      <section className="official-panel official-span-4">
        <div className="official-section-row"><h3>Cronologia de paralisações</h3><span>{currentScore.teamA} x {currentScore.teamB}</span></div>
        <div className="official-log-list">
          {timeoutEvents.length ? timeoutEvents.map((event) => <LogItem key={event.id} event={event} />) : <Empty text="Nenhum tempo solicitado nesta partida." />}
        </div>
      </section>
    </div>
  )
}

function AnotacoesTab({ teamA, teamB, currentSet, currentScore, anotacoes, saveNote, mvpId, setMvpId, allPlayers, mvpTeamId, getMatchNumber }: {
  teamA: Team
  teamB: Team
  currentSet: number
  currentScore: { teamA: number; teamB: number }
  anotacoes: Anotacao[]
  saveNote: (payload: Omit<Anotacao, 'id' | 'set' | 'placar' | 'timestamp'>) => void
  mvpId: string
  setMvpId: (value: string) => void
  allPlayers: Player[]
  mvpTeamId: TeamId
  getMatchNumber: (teamId: TeamId, number: string) => string
}) {
  const playerTargets = [
    ...[...teamA.players, ...teamA.reserves].map((player) => ({
      value: `player:${teamA.id}:${player.number}`,
      label: `#${numeroMvpDaLista(player.number, getMatchNumber('teamA', player.number))} ${displayPlayerName(player.name, teamA.name)} - ${teamA.name}`,
      teamName: teamA.name,
    })),
    ...[...teamB.players, ...teamB.reserves].map((player) => ({
      value: `player:${teamB.id}:${player.number}`,
      label: `#${numeroMvpDaLista(player.number, getMatchNumber('teamB', player.number))} ${displayPlayerName(player.name, teamB.name)} - ${teamB.name}`,
      teamName: teamB.name,
    })),
  ]
  const [tipo, setTipo] = useState('Observação')
  const [equipeRelacionada, setEquipeRelacionada] = useState(teamA.name)
  const [pessoaRelacionada, setPessoaRelacionada] = useState('Equipe inteira')
  const [descricao, setDescricao] = useState('')
  const selectedPlayerTarget = playerTargets.find((player) => player.value === pessoaRelacionada)
  const resolvedEquipe = selectedPlayerTarget?.teamName ?? equipeRelacionada
  const resolvedPessoa = selectedPlayerTarget?.label ?? pessoaRelacionada
  return (
    <div className="official-grid">
      <section className="official-panel official-span-5">
        <div className="official-section-row"><h3>Nova anotação de súmula</h3><span>Set {currentSet} - {currentScore.teamA} x {currentScore.teamB}</span></div>
        <div className="official-form">
          <select value={tipo} onChange={(event) => setTipo(event.target.value)}>{noteTypes.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={equipeRelacionada} onChange={(event) => setEquipeRelacionada(event.target.value)}><option>{teamA.name}</option><option>{teamB.name}</option><option>Ambas as equipes</option><option>Nenhuma / Geral</option></select>
          <select value={pessoaRelacionada} onChange={(event) => setPessoaRelacionada(event.target.value)}>
            <option>Equipe inteira</option>
            <option>Técnico</option>
            <option>Representante</option>
            <option>Não se aplica</option>
            {playerTargets.map((player) => <option key={player.value} value={player.value}>{player.label}</option>)}
          </select>
          <select value={mvpId} onChange={(event) => setMvpId(event.target.value)}><option value="">MVP da equipe vencedora</option>{allPlayers.map((player) => <option key={player.id} value={player.id}>#{numeroMvpDaLista(player.number, getMatchNumber(mvpTeamId, player.number))} - {player.name}</option>)}</select>
          <textarea value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Digite o registro oficial..." />
          <button className="official-primary" onClick={() => { if (descricao.trim()) { saveNote({ tipo, equipeRelacionada: resolvedEquipe, pessoaRelacionada: resolvedPessoa, descricao }); setDescricao('') } }}>Salvar anotação na súmula</button>
        </div>
      </section>
      <section className="official-panel official-span-7">
        <div className="official-section-row"><h3>Livro de ata / anotações salvas</h3><span>{anotacoes.length} registros</span></div>
        <div className="official-log-list">
          {anotacoes.length ? anotacoes.map((note) => <div key={note.id} className="official-note"><strong>{note.tipo}</strong><span>Set {note.set} - {note.placar} - {note.timestamp}</span><p>{note.equipeRelacionada} ({note.pessoaRelacionada}) - {note.descricao}</p></div>) : <Empty text="Nenhuma anotação formal gravada para esta partida." />}
        </div>
      </section>
    </div>
  )
}

function Checklist({ events, checklist }: { events: MatchEvent[]; checklist: Record<string, boolean> }) {
  const items = [
    ['Dados da partida carregados', checklist.loaded],
    ['Atletas conferidos por QR Code', checklist.conferido],
    ['Capitães definidos', checklist.capitaes],
    ['Saque inicial definido', checklist.saque],
    ['Escalação confirmada', checklist.escalacao],
  ] as const
  return (
    <aside className="official-panel official-span-4">
      <div className="official-section-row"><h3>Checklist de homologação</h3><FileCheck2 size={16} /></div>
      <div className="official-checklist">{items.map(([label, done]) => <div key={label} className={done ? 'is-done' : ''}>{done ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}<span>{label}</span></div>)}</div>
      <div className="official-log-list compact">
        {events.slice(0, 7).map((event) => <LogItem key={event.id} event={event} />)}
        {!events.length && <Empty text="Nenhum log gerado ainda." />}
      </div>
    </aside>
  )
}

function CaptainSelect({ team, value, onChange }: { team: Team; value: string; onChange: (value: string) => void }) {
  return <div className="official-mini-panel"><h3>{team.name}</h3><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Selecionar capitão</option>{[...team.players, ...team.reserves].map((player) => <option key={player.number} value={player.number}>#{player.number} - {player.name}</option>)}</select></div>
}

function InitialServeSetup({ teamA, teamB, value, onChange }: { teamA: Team; teamB: Team; value: TeamId | null; onChange: (value: TeamId) => void }) {
  const starter = value === 'teamA' ? teamA : value === 'teamB' ? teamB : null
  return (
    <div className="official-mini-panel official-initial-serve-panel">
      <h3>Saque inicial</h3>
      <p>Escolha a equipe que começa sacando no primeiro set.</p>
      <div className="official-two-cols">
        <ServeChoice team={teamA} active={value === 'teamA'} onClick={() => onChange('teamA')} />
        <ServeChoice team={teamB} active={value === 'teamB'} onClick={() => onChange('teamB')} />
      </div>
      <strong>{starter ? `${starter.name} começa sacando` : 'Defina quem começa sacando.'}</strong>
    </div>
  )
}

function TossSetup({
  teamA,
  teamB,
  winner,
  decision,
  onWinnerChange,
  onDecisionChange,
  onServingChange,
}: {
  teamA: Team
  teamB: Team
  winner: TeamId | null
  decision: 'SAQUE' | 'RECEPCAO' | ''
  onWinnerChange: (value: TeamId) => void
  onDecisionChange: (value: 'SAQUE' | 'RECEPCAO' | '') => void
  onServingChange: (value: TeamId) => void
}) {
  const winnerTeam = winner === 'teamA' ? teamA : winner === 'teamB' ? teamB : null
  const receiverTeam = winner === 'teamA' ? teamB : teamA
  const starter = !winner ? null : decision === 'SAQUE' ? winnerTeam : decision === 'RECEPCAO' ? receiverTeam : null

  function chooseWinner(teamId: TeamId) {
    onWinnerChange(teamId)
    if (decision === 'SAQUE') onServingChange(teamId)
    if (decision === 'RECEPCAO') onServingChange(teamId === 'teamA' ? 'teamB' : 'teamA')
  }

  function chooseDecision(nextDecision: 'SAQUE' | 'RECEPCAO') {
    onDecisionChange(nextDecision)
    if (!winner) return
    onServingChange(nextDecision === 'SAQUE' ? winner : winner === 'teamA' ? 'teamB' : 'teamA')
  }

  return (
    <div className="official-toss-setup">
      <div>
        <span>Vencedor do sorteio</span>
        <div className="official-two-cols">
          <button type="button" className={winner === 'teamA' ? 'is-active' : ''} onClick={() => chooseWinner('teamA')}>{teamA.name}</button>
          <button type="button" className={winner === 'teamB' ? 'is-active' : ''} onClick={() => chooseWinner('teamB')}>{teamB.name}</button>
        </div>
      </div>
      <div>
        <span>Decisão</span>
        <div className="official-two-cols">
          <button type="button" className={decision === 'SAQUE' ? 'is-active' : ''} disabled={!winner} onClick={() => chooseDecision('SAQUE')}>Sacar</button>
          <button type="button" className={decision === 'RECEPCAO' ? 'is-active' : ''} disabled={!winner} onClick={() => chooseDecision('RECEPCAO')}>Receber</button>
        </div>
      </div>
      <strong>{starter ? `${starter.name} inicia sacando` : 'Defina vencedor e decisão para calcular o saque inicial.'}</strong>
    </div>
  )
}

function PlayerValidationList({ team, validated, onToggle }: { team: Team; validated: string[]; onToggle: (number: string) => void }) {
  const players = [...team.players, ...team.reserves]
  return (
    <section className="official-validation-team">
      <div className="official-section-row">
        <h3>{team.name}</h3>
        <span>{validated.length}/{players.length} validados</span>
      </div>
      <div className="official-validation-progress"><i style={{ width: `${Math.min(100, (validated.length / Math.max(6, players.length)) * 100)}%` }} /></div>
      <div className="official-validation-list">
        {players.map((player) => {
          const checked = validated.includes(player.number)
          return (
            <button key={player.number} type="button" className={checked ? 'is-validated' : ''} onClick={() => onToggle(player.number)}>
              <PlayerAvatar player={player} />
              <span><strong>#{player.number} {player.name}</strong><small>{checked ? 'Validado para jogo' : 'Pendente de QR Code'}</small></span>
              <em>{checked ? <><Check size={13} /> Validado</> : 'QR'}</em>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PlayerAvatar({ player }: { player: Player }) {
  if (player.photoUrl) return <img className="official-player-avatar" src={player.photoUrl} alt={`Foto de ${player.name}`} />
  return <span className="official-player-avatar">{initials(player.name)}</span>
}

function SorteioTieBreak({
  teamA,
  teamB,
  servidor,
  onRegistrar,
}: {
  teamA: Team
  teamB: Team
  servidor: TeamId | null
  onRegistrar: (teamId: TeamId, origem: 'aplicativo' | 'mesa') => void
}) {
  const nome = servidor === 'teamA' ? teamA.name : servidor === 'teamB' ? teamB.name : ''
  return (
    <div className="official-toss-setup">
      <p>No 5º set o saque sai de um sorteio novo. Registre o resultado da mesa ou sorteie no aplicativo.</p>
      <button type="button" className="official-secondary" onClick={() => onRegistrar(sortearLado(Math.random()), 'aplicativo')}>
        Sortear no aplicativo
      </button>
      <div className="official-two-cols">
        <button type="button" className={`official-serve ${servidor === 'teamA' ? 'is-active' : ''}`} onClick={() => onRegistrar('teamA', 'mesa')}>
          <strong>{teamA.name}</strong>
          <span>Registrar sorteio da mesa</span>
        </button>
        <button type="button" className={`official-serve ${servidor === 'teamB' ? 'is-active' : ''}`} onClick={() => onRegistrar('teamB', 'mesa')}>
          <strong>{teamB.name}</strong>
          <span>Registrar sorteio da mesa</span>
        </button>
      </div>
      <strong>{nome ? `${nome} começa sacando neste tie-break.` : 'O sorteio ainda não definiu quem saca.'}</strong>
    </div>
  )
}

function ServeChoice({ team, active, onClick, setNumber = 1 }: { team: Team; active: boolean; onClick: () => void; setNumber?: number }) {
  return <button className={`official-serve ${active ? 'is-active' : ''}`} onClick={onClick}><strong>{team.name}</strong><span>Inicia sacando no set {setNumber}</span></button>
}

function ScoreSide({ team, score, serving, server }: { team: Team; score: number; serving: boolean; server?: string }) {
  return <div className="official-score-side"><span>{team.name}</span><div>{serving && <i />}<strong>{score.toString().padStart(2, '0')}</strong></div><p>Sacador: #{server || '--'}</p></div>
}

function CompactScoreDock({
  teamA,
  teamB,
  currentScore,
  setsWon,
  currentSet,
  servingTeamId,
  serverA,
  serverB,
}: {
  teamA: Team
  teamB: Team
  currentScore: { teamA: number; teamB: number }
  setsWon: { teamA: number; teamB: number }
  currentSet: number
  servingTeamId: TeamId
  serverA?: string
  serverB?: string
}) {
  return (
    <div className="official-score-dock" aria-label="Placar atual da partida">
      <div className={`official-score-dock-team ${servingTeamId === 'teamA' ? 'is-serving' : ''}`}>
        <span>{teamA.name}</span>
        <strong>{currentScore.teamA}</strong>
        <em>Sacador #{serverA || '--'}</em>
      </div>
      <div key={currentSet} className="official-score-dock-center sumula-micro-set">
        <small>Set {currentSet}</small>
        <b>{setsWon.teamA} x {setsWon.teamB}</b>
        <span>sets</span>
      </div>
      <div className={`official-score-dock-team ${servingTeamId === 'teamB' ? 'is-serving' : ''}`}>
        <span>{teamB.name}</span>
        <strong>{currentScore.teamB}</strong>
        <em>Sacador #{serverB || '--'}</em>
      </div>
    </div>
  )
}

function dispararPulso(setPulso: (valor: string | null) => void, id: string) {
  setPulso(null)
  queueMicrotask(() => setPulso(id))
}

function limparPulso(event: { target: EventTarget | null; currentTarget: EventTarget | null; animationName: string }, setPulso: (valor: string | null) => void) {
  if (event.target !== event.currentTarget) return
  if (!event.animationName.startsWith('sumula-micro')) return
  setPulso(null)
}

function CompactTeamControl({
  teamId,
  team,
  score,
  serving,
  onAce,
  onPoint,
  onUndo,
  onCard,
  timeoutsUsed,
  limite = 2,
  temposSeparados = false,
  temposEquipeUsados = 0,
  tempoMedico = false,
  onTimeout,
  onTempoEquipe,
  onTempoMedico,
  events,
  encerrada,
}: {
  teamId: TeamId
  team: Team
  score: number
  serving: boolean
  onAce: () => void
  onPoint: () => void
  onUndo: () => void
  onCard: (tipo: 'Cartão amarelo' | 'Cartão vermelho') => void
  timeoutsUsed: number
  limite?: number
  temposSeparados?: boolean
  temposEquipeUsados?: number
  tempoMedico?: boolean
  onTimeout: () => void
  onTempoEquipe?: () => void
  onTempoMedico?: () => void
  events: MatchEvent[]
  encerrada?: boolean
}) {
  const [pulsoAce, setPulsoAce] = useState(false)
  const ultimo = events.find((event) => event.teamId === teamId && (event.type === 'ace' || event.type === 'attack' || event.type === 'block' || ehPontoSemJogador(event.text)))
  const rotulo = ultimo ? lerRotuloPonto(ultimo.text) ?? ROTULO_PONTO[ultimo.type as OrigemPonto] : null
  const jogador = ultimo ? lerJogadorPonto(ultimo.text) : null
  return (
    <div className={`official-compact-team-control is-${teamId} ${serving ? 'is-serving' : ''}`}>
      <div className="official-card-actions" aria-label={`Cartões para ${team.name}`}>
        <button className="official-card-icon is-yellow" type="button" onClick={() => onCard('Cartão amarelo')} aria-label={`Cartão amarelo para ${team.name}`}><img src="/images/cartao-amarelo.png" alt="" /></button>
        <button className="official-card-icon is-red" type="button" onClick={() => onCard('Cartão vermelho')} aria-label={`Cartão vermelho para ${team.name}`}><img src="/images/vermelho.png" alt="" /></button>
      </div>
      <span className="official-compact-score-team-name">{team.name}</span>
      <strong>{score.toString().padStart(2, '0')}</strong>
      {serving && !encerrada ? (
        <button className={`official-compact-icon-action is-ace${pulsoAce ? ' sumula-micro-ace' : ''}`} type="button" onClick={() => { onAce(); setPulsoAce(false); queueMicrotask(() => setPulsoAce(true)) }} onAnimationEnd={(event) => { if (event.target === event.currentTarget && event.animationName === 'sumula-micro-ace') setPulsoAce(false) }} aria-label={`ACE para ${team.name}`}>ACE</button>
      ) : (
        <i aria-hidden="true" />
      )}
      <button className="official-compact-timeout-action" type="button" onClick={onTimeout} disabled={encerrada || timeoutsUsed >= limite} aria-label={`Registrar tempo para ${team.name}`}>
        <Clock size={15} />
        {timeoutsUsed}/{limite}
      </button>
      {temposSeparados ? (
        <button className="official-compact-timeout-action" type="button" onClick={onTempoEquipe} disabled={encerrada || temposEquipeUsados >= limite} aria-label={`Registrar tempo de equipe para ${team.name}`}>
          <Clock size={15} />
          {temposEquipeUsados}/{limite}
        </button>
      ) : null}
      {tempoMedico ? (
        <button className="official-compact-timeout-action" type="button" onClick={onTempoMedico} disabled={encerrada} aria-label={`Registrar tempo médico para ${team.name}`}>
          Médico
        </button>
      ) : null}
      {!encerrada && (
      <div className="official-point-actions">
        <VolleyballBurst>
          <button className="official-compact-point-action vs-press vs-focus" type="button" onClick={onPoint} aria-label={`Registrar +1 para ${team.name} sem atribuir jogador`}>+1</button>
        </VolleyballBurst>
      </div>
      )}
      <button className="official-compact-icon-action" type="button" onClick={onUndo} aria-label={`Corrigir Último ponto do ${team.name}`}><RotateCcw size={16} /></button>
      {rotulo && (
        <p className="official-last-point">
          <strong>{rotulo}</strong>
          {jogador ? <span>{jogador}</span> : null}
        </p>
      )}
    </div>
  )
}

function PenaltyModal({
  team,
  tipo,
  onSave,
  onClose,
}: {
  team: Team
  tipo: 'Cartão amarelo' | 'Cartão vermelho'
  onSave: (payload: Omit<Anotacao, 'id' | 'set' | 'placar' | 'timestamp'>) => void
  onClose: () => void
}) {
  const [person, setPerson] = useState('')
  const [note, setNote] = useState('')
  const roster = [...team.players, ...team.reserves]

  function registerCard() {
    onSave({
      tipo,
      equipeRelacionada: team.name,
      pessoaRelacionada: person || 'Equipe',
      descricao: note.trim() || `${tipo} registrado durante a partida.`,
    })
  }

  return (
    <div className="official-modal official-card-modal" role="dialog" aria-modal="true" aria-labelledby="card-modal-title">
      <div>
        <header className="official-card-modal-head">
          <div>
            <span>{team.name}</span>
            <h3 id="card-modal-title">{tipo}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">Fechar</button>
        </header>
        <div className="official-card-targets" role="listbox" aria-label="Pessoa relacionada">
          <button type="button" className={person === '' ? 'is-selected' : ''} onClick={() => setPerson('')}>
            <span>Equipe / comissão</span>
            <em>Geral</em>
          </button>
          {roster.map((player) => {
            const value = `#${player.number} ${displayPlayerName(player.name, team.name)}`
            return (
              <button key={player.number} type="button" className={person === value ? 'is-selected' : ''} onClick={() => setPerson(value)}>
                <span>#{player.number} - {displayPlayerName(player.name, team.name)}</span>
                <em>Atleta</em>
                </button>
            )
          })}
        </div>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observação opcional" />
        <div className="official-penalty-actions">
          <button type="button" className={tipo === 'Cartão amarelo' ? 'is-yellow' : 'is-red'} onClick={registerCard}>Registrar {tipo === 'Cartão amarelo' ? 'amarelo' : 'vermelho'}</button>
        </div>
      </div>
    </div>
  )
}

function FloatingScoreBar({
  teamA,
  teamB,
  currentScore,
  setsWon,
  currentSet,
  servingTeamId,
  serverA,
  serverB,
}: {
  teamA: Team
  teamB: Team
  currentScore: { teamA: number; teamB: number }
  setsWon: { teamA: number; teamB: number }
  currentSet: number
  servingTeamId: TeamId
  serverA?: string
  serverB?: string
}) {
  return (
    <div className="official-floating-score" aria-label="Placar fixo da aba de pontuação">
      <div className={`official-floating-score-team ${servingTeamId === 'teamA' ? 'is-serving' : ''}`}>
        <span>{teamA.name}</span>
        <strong>{currentScore.teamA}</strong>
        <em>#{serverA || '--'}</em>
      </div>
      <div key={currentSet} className="official-floating-score-set sumula-micro-set">
        <span>Set {currentSet}</span>
        <strong>{setsWon.teamA} x {setsWon.teamB}</strong>
      </div>
      <div className={`official-floating-score-team ${servingTeamId === 'teamB' ? 'is-serving' : ''}`}>
        <span>{teamB.name}</span>
        <strong>{currentScore.teamB}</strong>
        <em>#{serverB || '--'}</em>
      </div>
    </div>
  )
}

function SetEndConfirmModal({
  teamName,
  score,
  currentSet,
  matchPoint,
  onCancel,
  onConfirm,
}: {
  teamName: string
  score: { teamA: number; teamB: number }
  currentSet: number
  matchPoint: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="official-set-confirm" role="dialog" aria-modal="true" aria-labelledby="set-confirm-title">
      <div className="official-set-confirm-card">
        <span>{matchPoint ? 'Fim da partida' : `Fim do set ${currentSet}`}</span>
        <h2 id="set-confirm-title">{teamName} venceu por {score.teamA} x {score.teamB}?</h2>
        <p>O placar atingiu a regra do campeonato com pelo menos 2 pontos de diferença. Confirme para encerrar {matchPoint ? 'a partida' : 'este set'}.</p>
        <div>
          <button type="button" onClick={onCancel}>Continuar jogando</button>
          <button type="button" onClick={onConfirm}>{matchPoint ? 'Encerrar partida' : 'Encerrar set'}</button>
        </div>
      </div>
    </div>
  )
}

function StartMatchConfirmModal({
  teamA,
  teamB,
  server,
  onEdit,
  onConfirm,
}: {
  teamA: Team
  teamB: Team
  server: TeamId
  onEdit: (teamId: TeamId) => void
  onConfirm: () => void
}) {
  const [editing, setEditing] = useState(false)
  const serverTeam = server === 'teamA' ? teamA : teamB

  if (editing) {
    return (
      <div className="official-set-confirm" role="dialog" aria-modal="true" aria-labelledby="start-match-confirm-title">
        <div className="official-set-confirm-card">
          <span>Conferência antes de iniciar</span>
          <h2 id="start-match-confirm-title">Quem começa sacando?</h2>
          <div className="official-two-cols">
            <ServeChoice team={teamA} active={server === 'teamA'} onClick={() => { onEdit('teamA'); setEditing(false) }} />
            <ServeChoice team={teamB} active={server === 'teamB'} onClick={() => { onEdit('teamB'); setEditing(false) }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="official-set-confirm" role="dialog" aria-modal="true" aria-labelledby="start-match-confirm-title">
      <div className="official-set-confirm-card">
        <span>Conferência antes de iniciar</span>
        <h2 id="start-match-confirm-title">{serverTeam.name} começa sacando</h2>
        <p>Escalação, capitães e papeleta confirmados. Confira quem inicia o saque antes de liberar a pontuação — depois disso o rodízio já passa a valer.</p>
        <div>
          <button type="button" onClick={() => setEditing(true)}>Editar</button>
          <button type="button" onClick={onConfirm}>Iniciar partida</button>
        </div>
      </div>
    </div>
  )
}

function ladoQuadra(team: Team, escalacao: string[], sacando: boolean, indiceSaque: number) {
  return {
    id: team.id,
    nome: team.name,
    atletas: [...team.players, ...team.reserves],
    escalacao,
    sacando,
    indiceSaque,
  }
}

function ladoEscalacao(team: Team, escalacao: string[], editavel: boolean, libero: string) {
  return {
    id: team.id,
    nome: team.name,
    atletas: [...team.players, ...team.reserves],
    escalacao,
    libero,
    editavel,
  }
}

function RosterClickers({
  teamId,
  mirrored,
  team,
  lineup,
  servingTeam,
  serverIndex,
  pointFlash,
  getMatchNumber,
  onAttack,
  onBlock,
  onSubstitution,
  encerrada,
}: {
  teamId: TeamId
  mirrored: boolean
  team: Team
  lineup: string[]
  servingTeam: boolean
  serverIndex: number
  pointFlash: { teamId: TeamId; number: string; id: number } | null
  getMatchNumber: (teamId: TeamId, number: string) => string
  onAttack: (number: string) => void
  onBlock: (number: string) => void
  onSubstitution: (teamId: TeamId, index: number) => void
  encerrada?: boolean
}) {
  const [pulso, setPulso] = useState<string | null>(null)
  const visualSlots = !mirrored
    ? [
      { label: 'P5', index: 3 },
      { label: 'P4', index: 0 },
      { label: 'P6', index: 4 },
      { label: 'P3', index: 1 },
      { label: 'P1', index: 5 },
      { label: 'P2', index: 2 },
    ]
    : [
      { label: 'P2', index: 2 },
      { label: 'P1', index: 5 },
      { label: 'P3', index: 1 },
      { label: 'P6', index: 4 },
      { label: 'P4', index: 0 },
      { label: 'P5', index: 3 },
    ]
  return (
    <section className="official-mini-panel">
      <div className="official-section-row official-roster-header">
        <h3>{team.name}</h3>
      </div>
      <div className="official-player-grid is-facing">
        {visualSlots.map((slot) => {
          const index = slot.index
          const number = lineup[index]
          const player = number ? getAnyPlayer(team, number) : undefined
          const nome = player ? displayPlayerName(player.name, team.name) : ''
          const scored = pointFlash?.teamId === teamId && pointFlash.number === number
          const frontRow = ['P2', 'P3', 'P4'].includes(slot.label)
          return (
            <div
              key={`${slot.label}-${number || index}`}
              className={`official-player-card ${frontRow ? 'is-front-row' : 'is-back-row'} ${servingTeam && index === serverIndex ? 'is-serving' : ''} ${scored ? 'is-scored' : ''}`}
              role={encerrada ? undefined : 'button'}
              tabIndex={encerrada ? undefined : 0}
              onClick={() => {
                if (encerrada || !number) return
                onAttack(number)
                dispararPulso(setPulso, `${index}:tap`)
              }}
              onKeyDown={(event) => {
                if (encerrada || !number) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onAttack(number)
                  dispararPulso(setPulso, `${index}:tap`)
                }
              }}
              aria-label={encerrada ? `Atleta ${number}` : `Ponto de ataque do atleta ${number}`}
            >
              <div className="official-player-card-top">
                <i>{slot.label}</i>
              </div>
              <div className={`official-player-identity${pulso === `${index}:tap` ? ' sumula-micro-tap' : ''}`} onAnimationEnd={(event) => limparPulso(event, setPulso)}>
                {number ? (
                  <span className="official-player-number-edit">{getMatchNumber(teamId, number)}</span>
                ) : (
                  <span>--</span>
                )}
                {nome && <small className="official-player-name">{nome}</small>}
              </div>
              {!encerrada && (
              <div className="official-player-actions">
                {frontRow && number && <button className={`official-point-action is-block${pulso === `${index}:block` ? ' sumula-micro-block' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); onBlock(number); dispararPulso(setPulso, `${index}:block`) }} onAnimationEnd={(event) => limparPulso(event, setPulso)} aria-label={`Bloqueio do atleta ${number}`}>B</button>}
                {number && <button className="official-sub-action is-icon" type="button" onClick={(event) => { event.stopPropagation(); onSubstitution(teamId, index) }} aria-label={`Substituir atleta ${number}`}><Repeat2 size={15} /></button>}
              </div>
              )}
              {scored && <b>+1</b>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function equipeMencionada(texto: string, teamA: Team, teamB: Team): TeamId | undefined {
  const normalizado = normalizeName(texto)
  const mencionaA = normalizado.includes(normalizeName(`para ${teamA.name}`))
  const mencionaB = normalizado.includes(normalizeName(`para ${teamB.name}`))
  if (mencionaA && mencionaB) return teamA.name.length >= teamB.name.length ? 'teamA' : 'teamB'
  if (mencionaA) return 'teamA'
  if (mencionaB) return 'teamB'
  return undefined
}

function equipeDoJogador(teamA: Team, teamB: Team, jogadorId?: number): TeamId | undefined {
  if (jogadorId == null) return undefined
  if ([...teamA.players, ...teamA.reserves].some((player) => player.id === jogadorId)) return 'teamA'
  if ([...teamB.players, ...teamB.reserves].some((player) => player.id === jogadorId)) return 'teamB'
  return undefined
}

function partirDescricaoSalva(descricao: string) {
  const partes = descricao.split('|').map((parte) => parte.trim())
  if (partes.length < 3) return { time: 'salvo', score: '--', text: descricao }
  return { time: partes[0] || 'salvo', score: partes[1] || '--', text: partes.slice(2).join(' | ') }
}

function displayPlayerName(name: string, teamName: string) {
  const suffixRegex = new RegExp(`\\s*[-\\u2013\\u2014]\\s*${escapeRegExp(teamName)}$`, 'i')
  const withoutSuffix = name.replace(suffixRegex, '').trim()
  if (withoutSuffix !== name.trim()) return withoutSuffix
  const parts = name.split(/\s*[-–—]\s*/)
  if (parts.length > 1 && normalizeName(parts[parts.length - 1]) === normalizeName(teamName)) {
    return parts.slice(0, -1).join(' - ').trim()
  }
  return name.replace(new RegExp(`\\s*[-–—]\\s*${escapeRegExp(teamName)}$`, 'i'), '').trim()
}

function normalizeOccurrenceType(event: MatchEvent) {
  const normalizedText = normalizeName(event.text)
  if (normalizedText.includes('cartao vermelho')) return 'CARTAO_VERMELHO'
  if (normalizedText.includes('cartao amarelo')) return 'CARTAO_AMARELO'
  if (event.type === 'attack') return 'attack'
  if (event.type === 'block') return 'block'
  if (event.type === 'point') return 'point'
  if (event.type === 'ace') return 'ace'
  if (event.type === 'timeout') return 'timeout'
  if (event.type === 'substitution') return 'substitution'
  if (event.type === 'injury_substitution') return 'lesao'
  if (event.type === 'libero_exchange') return 'troca_libero'
  if (event.type === 'set_start') return 'set_start'
  if (event.type === 'set_end') return 'set_end'
  if (event.type === 'system') return 'system'
  if (event.type === 'anotacao') return 'anotacao'
  return 'OBSERVACAO'
}

type OfficialScoutPlayer = {
  number: string
  name: string
  points: number
  attacks: number
  blocks: number
  aces: number
}

function buildOfficialScout(teamA: Team, teamB: Team, events: MatchEvent[], getMatchNumber?: (teamId: TeamId, number: string) => string) {
  const teams = [
    { teamId: 'teamA' as TeamId, teamName: teamA.name, team: teamA },
    { teamId: 'teamB' as TeamId, teamName: teamB.name, team: teamB },
  ]
  const statsByTeam = new Map<TeamId, Map<number, OfficialScoutPlayer>>([
    ['teamA', new Map()],
    ['teamB', new Map()],
  ])

  for (const event of events) {
    if (!['attack', 'block', 'ace'].includes(event.type)) continue
    const teamInfo = teams.find((item) => item.teamId === event.teamId)
      ?? teams.find((item) => normalizeName(event.text).includes(`para ${normalizeName(item.teamName)}:`))
    if (!teamInfo) continue
    const rosterPlayers = [...teamInfo.team.players, ...teamInfo.team.reserves]

    // Preferimos o jogadorId persistido no evento: o número exibido no texto pode ter
    // sido sobrescrito para a partida e não bater mais com o número de elenco.
    let player = event.jogadorId != null ? rosterPlayers.find((item) => item.id === event.jogadorId) : undefined
    let fallbackNumber: string | undefined
    let fallbackName: string | undefined
    if (!player) {
      const match = event.text.match(/#([^\s]+)\s+(.+?)(?:\.|$)/)
      if (!match) continue
      const number = normalizeJerseyNumber(match[1])
      player = rosterPlayers.find((item) => normalizeJerseyNumber(item.number) === number)
      fallbackNumber = match[1]
      fallbackName = match[2]
    }

    const stats = statsByTeam.get(teamInfo.teamId)
    if (!stats) continue

    const key = player?.id ?? -1
    const displayNumber = player && getMatchNumber ? getMatchNumber(teamInfo.teamId, player.number) : (player?.number ?? fallbackNumber ?? '?')
    const current = stats.get(key) ?? {
      number: displayNumber,
      name: displayPlayerName(player?.name ?? fallbackName ?? 'Atleta', teamInfo.teamName),
      points: 0,
      attacks: 0,
      blocks: 0,
      aces: 0,
    }
    current.number = displayNumber
    current.points += 1
    if (event.type === 'attack') current.attacks += 1
    if (event.type === 'block') current.blocks += 1
    if (event.type === 'ace') current.aces += 1
    stats.set(key, current)
  }

  return teams.map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    players: Array.from(statsByTeam.get(team.teamId)?.values() ?? []).sort((a, b) =>
      b.points - a.points
      || b.aces - a.aces
      || b.blocks - a.blocks
      || b.attacks - a.attacks
      || Number(normalizeJerseyNumber(a.number)) - Number(normalizeJerseyNumber(b.number)),
    ),
  }))
}

function normalizeJerseyNumber(value: string | number | null | undefined) {
  const text = String(value ?? '').trim()
  return text.replace(/^0+(?=\d)/, '') || text
}

function parseMatchNumberOverride(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  return Number(value)
}

function normalizeName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function TimeoutCard({ team, used, set, onRequest, limite = 2, rotulo = 'Registrar tempo' }: { team: Team; used: number; set: number; onRequest: () => void; limite?: number; rotulo?: string }) {
  const caixas = Array.from({ length: limite }, (_, indice) => indice + 1)
  return <section className="official-panel"><div className="official-section-row"><h3>{team.name}</h3><span>Set {set}</span></div><div className="official-timeout-boxes">{caixas.map((n) => <div key={n} className={used >= n ? 'is-used' : ''}><Clock size={15} />Tempo {n}</div>)}</div><button className="official-primary" disabled={used >= limite} onClick={onRequest}>{rotulo}</button></section>
}

function PlayerModal({ title, team, teamId, lineup = [], bench = [], onlyBench, notice = null, selectedLibero = '', hideLiberos = false, permiteLesao = false, getMatchNumber, onSelect, onClose }: { title: string; team: Team; teamId?: TeamId; lineup?: string[]; bench?: string[]; onlyBench?: string[]; notice?: string | null; selectedLibero?: string; hideLiberos?: boolean; permiteLesao?: boolean; getMatchNumber?: (teamId: TeamId, number: string) => string; onSelect: (number: string, porLesao?: boolean) => void; onClose: () => void }) {
  const [lesao, setLesao] = useState(false)
  const substitutionMode = onlyBench != null
  const players = [...team.players, ...team.reserves].filter((player) => !(hideLiberos && player.isLibero))
  const visiveis = substitutionMode
    ? players.filter((player) => onlyBench.includes(player.number) && !lineup.includes(player.number))
    : players
  return (
    <div className="official-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div>
        <h3>{title}</h3>
        <p className="official-modal-caption">{team.name}</p>
        {notice ? <p className="official-modal-note">{notice}</p> : null}
        {permiteLesao ? (
          <label className="official-modal-note">
            <input type="checkbox" checked={lesao} onChange={(event) => setLesao(event.target.checked)} />
            {' '}Substituição por lesão. Não conta no limite e não cria par.
          </label>
        ) : null}
        <div>
          {visiveis.map((player) => {
            const isCourt = lineup.includes(player.number)
            const isBench = bench.includes(player.number)
            const isSelectedLibero = selectedLibero === player.number
            const isLibero = Boolean(player.isLibero || isSelectedLibero)
            const isSelectable = !isSelectedLibero && (!substitutionMode || onlyBench.includes(player.number))
            const playerName = displayPlayerName(player.name, team.name)
            const displayNumber = teamId && getMatchNumber ? getMatchNumber(teamId, player.number) : player.number
            return (
              <button
                key={player.number}
                className={isCourt ? 'is-court-player' : isBench ? 'is-bench-player' : isLibero ? 'is-libero-player' : ''}
                disabled={!isSelectable}
                onClick={() => {
                  if (!isSelectable) return
                  if (permiteLesao && lesao) onSelect(player.number, true)
                  else onSelect(player.number)
                }}
              >
                <span>#{displayNumber} - {playerName}</span>
                <em>{isSelectedLibero ? 'Líbero definido' : isLibero ? 'Líbero' : isCourt ? 'Em quadra' : isBench ? 'Reserva' : 'Elenco'}</em>
              </button>
            )
          })}
          {substitutionMode && visiveis.length === 0 && !notice ? <p className="official-modal-empty">Nenhum reserva elegível neste set.</p> : null}
        </div>
        <button onClick={onClose}>Voltar</button>
      </div>
    </div>
  )
}

function LogItem({ event }: { event: MatchEvent }) {
  const displayText = event.text.replace(/\s*\[\[ROT:[^\]]*\]\]/, '')
  return <div className="official-log"><span>{event.time}</span><strong>Set {event.set}</strong><p>{displayText}</p><em>{event.score}</em></div>
}

function Empty({ text }: { text: string }) {
  return <div className="official-empty"><HelpCircle size={24} /><p>{text}</p></div>
}

function tituloFalhaSumula(mensagem: string) {
  if (mensagem.includes('Entre para')) return 'Entre para abrir a súmula'
  if (mensagem.includes('escalado') || mensagem.includes('não pode abrir') || mensagem.includes('não é do seu')) return 'Sem autorização'
  if (mensagem.includes('não encontrada')) return 'Partida não encontrada'
  if (mensagem.includes('expirou')) return 'Link expirado'
  if (mensagem.includes('Falha de conexão')) return 'Falha de conexão'
  return 'Súmula indisponível'
}

function Status({ icon, title, description, success = false, onRetry, action }: { icon: ReactNode; title: string; description: string; success?: boolean; onRetry?: () => void; action?: ReactNode }) {
  return <main className="official-sumula official-status"><div className="official-panel"><span className={success ? 'success' : ''}>{icon}</span><h1>{title}</h1><p>{description}</p>{action}<div className="mt-4">{onRetry ? <button type="button" onClick={onRetry} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">Tentar novamente</button> : null}</div></div></main>
}

function restoreMatchNumberOverrides(teamA: Team, teamB: Team, savedPresence: any[]): Record<TeamId, Record<number, string>> {
  const overrides: Record<TeamId, Record<number, string>> = { teamA: {}, teamB: {} }
  const teams: Array<{ teamId: TeamId; team: Team }> = [{ teamId: 'teamA', team: teamA }, { teamId: 'teamB', team: teamB }]
  for (const { teamId, team } of teams) {
    const players = [...team.players, ...team.reserves]
    for (const presenca of savedPresence) {
      if (presenca.numero == null) continue
      const player = players.find((item) => item.id === presenca.jogadorId)
      if (!player) continue
      const overrideNumber = String(presenca.numero)
      if (overrideNumber !== player.number) overrides[teamId][player.id] = overrideNumber
    }
  }
  return overrides
}

function restoreSavedMatchState(partida: any, savedSets: any[], savedOccurrences: any[], savedPresence: any[], rules: MatchRules) {
  const normalizedStatus = normalizeName(partida?.status ?? '')
  const finished = partidaEncerradaNaSessao(String(partida?.status ?? ''), savedOccurrences)
  const inProgress = ['em andamento', 'em_andamento', 'ao vivo', 'ao_vivo', 'live'].includes(normalizedStatus)
  const sortedSets = [...savedSets].sort((a, b) => Number(a.numero) - Number(b.numero))
  const hasSavedProgress = sortedSets.length > 0 || savedOccurrences.length > 0 || savedPresence.some((item) => item?.presente)
  const completedSavedSets = sortedSets.filter((set) => canCloseSetByRules({ teamA: Number(set.pontosA ?? 0), teamB: Number(set.pontosB ?? 0) }, pointsForSet(rules, Number(set.numero))))
  const latestSet = sortedSets[sortedSets.length - 1]
  const currentSet = finished
    ? Math.max(1, Number(latestSet?.numero ?? 1))
    : latestSet && canCloseSetByRules({ teamA: Number(latestSet.pontosA ?? 0), teamB: Number(latestSet.pontosB ?? 0) }, pointsForSet(rules, Number(latestSet.numero))) && completedSavedSets.length < rules.setsToWin && Number(latestSet.numero) < rules.setsPerMatch
      ? Number(latestSet.numero) + 1
      : Math.max(1, Number(latestSet?.numero ?? 1))
  const currentSavedSet = sortedSets.find((set) => Number(set.numero) === currentSet)
  const currentScore = {
    teamA: Number(currentSavedSet?.pontosA ?? 0),
    teamB: Number(currentSavedSet?.pontosB ?? 0),
  }
  const setScores = Array.from({ length: rules.setsPerMatch }, (_, index) => {
    const numero = index + 1
    const saved = sortedSets.find((set) => Number(set.numero) === numero)
    const score = { teamA: Number(saved?.pontosA ?? 0), teamB: Number(saved?.pontosB ?? 0) }
    const confirmed = Boolean(saved) && (finished || (numero < currentSet && canCloseSetByRules(score, pointsForSet(rules, numero))))
    return { ...score, winner: confirmed ? getSetWinner(score) : undefined, confirmed } as SetScore
  })
  const setsWon = countSets(setScores)
  const matchStatus: 'pre-game' | 'live' | 'finished' = finished ? 'finished' : inProgress || hasSavedProgress ? 'live' : 'pre-game'
  const startingLiberos = parseSavedStartingLiberos(savedOccurrences)
  if (!startingLiberos[currentSet]) startingLiberos[currentSet] = { teamA: '', teamB: '' }
  const hasCurrentSetStart = savedOccurrences.some((item) => normalizeSavedEventType(item.tipo) === 'set_start' && Number(item.set ?? 1) === currentSet)
  const hasCurrentScore = currentScore.teamA > 0 || currentScore.teamB > 0
  const lineupConfirmed = finished || (matchStatus === 'live' && (hasCurrentSetStart || hasCurrentScore))
  const activeTab: TabId = matchStatus === 'pre-game' ? 'pre' : matchStatus === 'finished' ? 'resumo' : lineupConfirmed ? 'pontuacao' : 'escalacao'

  return { setScores, currentSet, currentScore, setsWon, matchStatus, activeTab, lineupConfirmed, startingLiberos }
}

function restoreLineupConfirmations(savedOccurrences: any[], teamA: Team, teamB: Team, currentSet: number) {
  return confirmarPapeletas(savedOccurrences, teamA.name, teamB.name, currentSet)
}

function parseSavedStartingLiberos(savedOccurrences: any[]) {
  const result: Record<number, Record<TeamId, string>> = {}
  for (const occurrence of savedOccurrences) {
    if (normalizeSavedEventType(occurrence.tipo) !== 'set_start') continue
    const setNumber = Math.max(1, Number(occurrence.set ?? 1))
    const matches = String(occurrence.descricao ?? '').match(/#([^\s.,|]+).*?#([^\s.,|]+)/)
    if (!matches) continue
    result[setNumber] = { teamA: matches[1], teamB: matches[2] }
  }
  return result
}

function parseSavedPreMatchRecords(savedOccurrences: any[], teamA: Team, teamB: Team) {
  const result: {
    captA: string
    captB: string
    tossWinnerTeamId: TeamId | null
    tossDecision: 'SAQUE' | 'RECEPCAO' | ''
  } = {
    captA: '',
    captB: '',
    tossWinnerTeamId: null,
    tossDecision: '',
  }

  const teamAName = normalizeName(teamA.name)
  const teamBName = normalizeName(teamB.name)

  for (const occurrence of savedOccurrences) {
    const text = String(occurrence.descricao ?? '')
    const normalized = normalizeName(text)

    if (!result.captA && normalized.includes('capitaes da partida')) {
      const matches = text.match(/#([^\s.,|]+).*?#([^\s.,|]+)/)
      if (matches) {
        result.captA = matches[1]
        result.captB = matches[2]
      }
    }

    if (!result.tossWinnerTeamId && normalized.includes('sorteio:')) {
      if (normalized.includes(`${teamAName} venceu`)) result.tossWinnerTeamId = 'teamA'
      if (normalized.includes(`${teamBName} venceu`)) result.tossWinnerTeamId = 'teamB'
      if (normalized.includes('decidiu sacar')) result.tossDecision = 'SAQUE'
      if (normalized.includes('decidiu receber')) result.tossDecision = 'RECEPCAO'
    }
  }

  return result
}

function encodeRotationMarker(servingTeamId: TeamId, lineupA: string[], lineupB: string[]) {
  return ` [[ROT:${Date.now()}:${servingTeamId}:${lineupA.join(',')}:${lineupB.join(',')}]]`
}

function parseSavedRotationState(savedOccurrences: any[], currentSet: number) {
  let best: { timestamp: number; servingTeamId: TeamId; lineupA: string[]; lineupB: string[] } | null = null
  for (const occurrence of savedOccurrences) {
    if (Number(occurrence.set ?? currentSet) !== currentSet) continue
    const match = String(occurrence.descricao ?? '').match(/\[\[ROT:(\d+):(teamA|teamB):([^:]*):([^\]]*)\]\]/)
    if (!match) continue
    const timestamp = Number(match[1])
    if (best && timestamp <= best.timestamp) continue
    best = {
      timestamp,
      servingTeamId: match[2] as TeamId,
      lineupA: match[3].split(','),
      lineupB: match[4].split(','),
    }
  }
  return best
}

function parseSavedInitialServerBySet(savedOccurrences: any[], teamA: Team, teamB: Team) {
  const result: Record<number, TeamId | null> = {}
  const teamAName = normalizeName(teamA.name)
  const teamBName = normalizeName(teamB.name)

  for (const occurrence of savedOccurrences) {
    const normalized = normalizeName(String(occurrence.descricao ?? ''))
    if (!normalized.includes('comeca sacando')) continue
    const setNumber = Math.max(1, Number(occurrence.set ?? 1))
    if (normalized.includes(`${teamAName} comeca sacando`)) result[setNumber] = 'teamA'
    else if (normalized.includes(`${teamBName} comeca sacando`)) result[setNumber] = 'teamB'
  }

  return result
}

function countSavedTimeouts(savedOccurrences: any[], teamA: Team, teamB: Team, currentSet: number) {
  const result: Record<TeamId, number> = { teamA: 0, teamB: 0 }
  for (const occurrence of savedOccurrences) {
    if (normalizeSavedEventType(occurrence.tipo) !== 'timeout') continue
    if (Number(occurrence.set ?? currentSet) !== currentSet) continue
    const text = normalizeName(String(occurrence.descricao ?? ''))
    if (ehTempoDeEquipe(text)) continue
    if (text.includes(normalizeName(teamA.name))) result.teamA += 1
    if (text.includes(normalizeName(teamB.name))) result.teamB += 1
  }
  return result
}

function countSavedTemposEquipe(savedOccurrences: any[], teamA: Team, teamB: Team, currentSet: number) {
  const result: Record<TeamId, number> = { teamA: 0, teamB: 0 }
  for (const occurrence of savedOccurrences) {
    if (normalizeSavedEventType(occurrence.tipo) !== 'timeout') continue
    if (Number(occurrence.set ?? currentSet) !== currentSet) continue
    const text = normalizeName(String(occurrence.descricao ?? ''))
    if (!ehTempoDeEquipe(text)) continue
    if (text.includes(normalizeName(teamA.name))) result.teamA += 1
    if (text.includes(normalizeName(teamB.name))) result.teamB += 1
  }
  return result
}

function restoreControleSubstituicao(
  savedOccurrences: any[],
  teamA: Team,
  teamB: Team,
  overrides: Record<TeamId, Record<number, string>>,
  limite: number = LIMITE_SUBSTITUICOES_POR_SET,
) {
  const controle: Record<number, Record<TeamId, ControleSubstituicao>> = {}
  for (const occurrence of savedOccurrences) {
    if (normalizeSavedEventType(occurrence.tipo) !== 'substitution') continue
    const text = String(occurrence.descricao ?? '')
    const setNumber = Number(occurrence.set ?? 1)
    const normalized = normalizeName(text)
    const teamId: TeamId | null = normalized.includes(normalizeName(teamA.name))
      ? 'teamA'
      : normalized.includes(normalizeName(teamB.name))
        ? 'teamB'
        : null
    if (!teamId) continue
    const team = teamId === 'teamA' ? teamA : teamB
    const troca = numerosDaTroca(text)
    const atual = controle[setNumber]?.[teamId] ?? controleVazio()
    const proximo = troca
      ? aplicarSubstituicao(atual, numeroDoElenco(team, troca[0], overrides[teamId]), numeroDoElenco(team, troca[1], overrides[teamId]), limite)
      : atual.usadas >= limiteDeSubstituicoes(limite)
        ? null
        : { controle: { usadas: atual.usadas + 1, pares: atual.pares }, falha: null }
    if (!proximo || proximo.falha) continue
    controle[setNumber] = {
      teamA: controle[setNumber]?.teamA ?? controleVazio(),
      teamB: controle[setNumber]?.teamB ?? controleVazio(),
      [teamId]: proximo.controle,
    }
  }
  return controle
}

function numeroDoElenco(team: Team, exibido: string, overrides: Record<number, string> | undefined) {
  const players = [...team.players, ...team.reserves]
  const encontrado = players.find((player) => (overrides?.[player.id] || player.number) === exibido)
  return encontrado?.number ?? exibido
}

function countSavedSideInversions(savedOccurrences: any[]) {
  let count = 0
  for (const occurrence of savedOccurrences) {
    if (normalizeSavedEventType(occurrence.tipo) !== 'anotacao') continue
    const text = normalizeName(String(occurrence.descricao ?? ''))
    if (text.includes(normalizeName('Equipes inverteram os lados da quadra.'))) count += 1
  }
  return count
}

function normalizeSavedEventType(tipo: string): EventType {
  const normalized = normalizeName(tipo ?? '')
  if (normalized === 'point') return 'point'
  if (normalized === 'attack') return 'attack'
  if (normalized === 'block') return 'block'
  if (normalized === 'ace') return 'ace'
  if (normalized === 'timeout') return 'timeout'
  if (normalized === 'substitution' || normalized === 'substituicao') return 'substitution'
  if (normalized === 'injury_substitution' || normalized === 'lesao') return 'injury_substitution'
  if (normalized === 'libero_exchange' || normalized === 'libero exchange' || normalized === 'troca_libero' || normalized === 'troca libero') return 'libero_exchange'
  if (normalized === 'set_start' || normalized === 'set start' || normalized === 'inicio_de_set' || normalized === 'inicio de set') return 'set_start'
  if (normalized === 'set_end' || normalized === 'set end' || normalized === 'fim_de_set' || normalized === 'fim de set') return 'set_end'
  if (normalized === 'system') return 'system'
  return 'anotacao'
}

function AgendaPartidaLinha({ partida }: { partida: { status?: string | null; dataHora?: string | null; localNome?: string | null; rodada?: number | null; fase?: string | null } }) {
  const agenda = agendaDaPartida(partida)
  const texto = [agenda.data, agenda.local].filter(Boolean).join(' · ')
  if (!texto) return null
  return <p>{texto}</p>
}

function makeTeam(id: TeamId, data: any): Team {
  const players = (data?.jogadores ?? []).map((jogador: any, index: number) => ({
    id: jogador.id,
    number: String(jogador.numero || index + 1),
    name: jogador.nome,
    status: 'Inscrição ativa',
    position: jogador.posicao ?? null,
    isLibero: String(jogador.posicao || '').toUpperCase() === 'LB',
    photoUrl: jogador.fotoRostoUrl ?? jogador.fotoUrl ?? null,
  }))
  return {
    id,
    dbId: data?.id ?? 0,
    name: normalizarNomeEquipe(String(data?.nome ?? '')),
    players: players.slice(0, 6),
    reserves: players.slice(6),
  }
}

function getAnyPlayer(team: Team, number: string) {
  return [...team.players, ...team.reserves].find((player) => player.number === number)
}

function createEmptyLineup() {
  return Array.from({ length: 6 }, () => '')
}

function getDefaultLineupNumbers(team: Team) {
  const numbers = [...team.players, ...team.reserves]
    .filter((player) => !player.isLibero)
    .slice(0, 6)
    .map((player) => player.number)
  return numbers.concat(createEmptyLineup()).slice(0, 6)
}

function getBenchNumbers(team: Team, lineup: string[], selectedLibero = '') {
  const roster = [...team.players, ...team.reserves]
  return roster
    .filter((player) => !player.isLibero)
    .filter((player) => player.number !== selectedLibero)
    .filter((player) => !lineup.includes(player.number))
    .map((player) => player.number)
    .filter((number, index, list) => number && list.indexOf(number) === index)
}

function getLiberoOptions(team: Team, lineup: string[] = [], quantidade?: number | null) {
  const roster = [...team.players, ...team.reserves].filter((player) => !lineup.includes(player.number))
  const liberos = roster.filter((player) => player.isLibero)
  const lista = liberos.length ? liberos : roster
  if (quantidade !== 1 && quantidade !== 2) return lista
  return lista.slice(0, quantidade)
}

function rotateVolleyballLineup(lineup: string[]) {
  if (lineup.length < 6) return lineup
  // Ordem visual da quadra: P4, P3, P2, P5, P6, P1.
  // Rodízio real do vôlei ao ganhar o saque: P2->P1, P1->P6, P6->P5, P5->P4, P4->P3, P3->P2.
  return [lineup[3], lineup[0], lineup[1], lineup[4], lineup[5], lineup[2]]
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AT'
}

function extractQrToken(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const parsed = new URL(trimmed)
    const fromQuery = parsed.searchParams.get('token') || parsed.searchParams.get('qrToken')
    if (fromQuery) return fromQuery
    const match = parsed.pathname.match(/\/api\/jogadores\/qr\/([^/?#]+)/)
    return decodeURIComponent(match?.[1] ?? parsed.pathname.split('/').filter(Boolean).pop() ?? trimmed)
  } catch {
    const match = trimmed.match(/\/api\/jogadores\/qr\/([^/?#]+)/)
    return decodeURIComponent(match?.[1] ?? trimmed)
  }
}

function countSets(sets: SetScore[]) {
  return sets.reduce((acc, set) => {
    if (set.confirmed && set.winner === 'teamA') acc.teamA += 1
    if (set.confirmed && set.winner === 'teamB') acc.teamB += 1
    return acc
  }, { teamA: 0, teamB: 0 })
}

function getSetWinner(score: { teamA: number; teamB: number }): TeamId | undefined {
  if (score.teamA > score.teamB) return 'teamA'
  if (score.teamB > score.teamA) return 'teamB'
  return undefined
}

function canCloseSetByRules(score: { teamA: number; teamB: number }, pointsPerSet: number) {
  return Math.max(score.teamA, score.teamB) >= pointsPerSet && Math.abs(score.teamA - score.teamB) >= 2
}

function getMatchRules(liga: any, fase?: string | null): MatchRules {
  const source = Array.isArray(liga) ? liga[0] : liga
  const regras = regrasVisiveis({
    setsPorPartida: readOptionalNumber(source, ['setsPorPartida', 'sets_por_partida', 'sets']),
    pontosPorSet: readOptionalNumber(source, ['pontosPorSet', 'pontos_por_set', 'pontuacaoSet']),
    tieBreakUltimoSet: readOptionalBoolean(source, ['tieBreakUltimoSet', 'tie_break_ultimo_set']),
    pontosUltimoSet: readOptionalNumber(source, ['pontosUltimoSet', 'pontos_ultimo_set']),
    setsFormato: readOptionalText(source, ['setsFormato', 'sets_formato']),
    terceiroSetObrigatorio: readOptionalBoolean(source, ['terceiroSetObrigatorio', 'terceiro_set_obrigatorio']),
    setsPorPartidaFinal: source?.setsPorPartidaFinal,
    setsPorPartidaSemifinal: source?.setsPorPartidaSemifinal,
    setsPorPartidaQuartas: source?.setsPorPartidaQuartas,
    setsPorPartidaOitavas: source?.setsPorPartidaOitavas,
    setsPorPartidaTerceiroLugar: source?.setsPorPartidaTerceiroLugar,
  }, fase)
  return {
    ...regras,
    substitutionLimit: limiteDeSubstituicoes(source?.limiteSubstituicoesPorSet),
    alertaRodizio: source?.alertaRodizioIlegal === true,
    timeoutLimit: limiteDeTempos(source?.limiteTemposPorSet),
    temposSeparados: source?.separarTempos === true,
    tempoMedico: source?.tempoMedico === true,
    substituicaoPorLesao: source?.substituicaoPorLesao === true,
    exigirLiberoInicial: source?.exigirLiberoInicial !== false,
    quantidadeLiberos: quantidadeDeLiberos(source?.quantidadeLiberos),
  }
}

function pointsForSet(rules: MatchRules, setNumber: number) {
  return setNumber === rules.setsPerMatch ? rules.lastSetPoints : rules.pointsPerSet
}

function readOptionalNumber(source: any, keys: string[]) {
  for (const key of keys) {
    const value = Number(source?.[key])
    if (Number.isFinite(value) && value > 0) return Math.trunc(value)
  }
  return undefined
}

function readOptionalBoolean(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'boolean') return value
  }
  return undefined
}

function readOptionalText(source: any, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}
