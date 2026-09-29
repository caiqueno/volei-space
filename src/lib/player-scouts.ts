import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { getApprovedTeams, isFinishedMatch } from '@/lib/championship-operations'

export type PlayerScoutRow = {
  jogadorId: number
  nome: string
  numero: string
  equipeId: number
  pontos: number
  ataques: number
  bloqueios: number
  aces: number
}

const SCOUT_TIPOS = ['attack', 'block', 'ace'] as const
type ScoutTipo = (typeof SCOUT_TIPOS)[number]

export async function getLeaguePlayerScouts(ligaId: number): Promise<PlayerScoutRow[]> {
  const approvedTeams = await getApprovedTeams(ligaId)
  if (approvedTeams.length === 0) return []
  const teamIds = approvedTeams.map((equipe) => equipe.id)

  const { data: partidas, error: partidasErr } = await supabase
    .from('Partida')
    .select('id,equipeAId,equipeBId,status,vencedorId,sumulaSubmetidaEm,sumulaAprovadaEm,equipeA:Equipe!Partida_equipeAId_fkey(nome),equipeB:Equipe!Partida_equipeBId_fkey(nome)')
    .eq('ligaId', ligaId)
  if (partidasErr) throw partidasErr

  const finished = (partidas ?? []).filter(isFinishedMatch)
  if (finished.length === 0) return []

  const partidaById = new Map(finished.map((partida: any) => [partida.id, partida]))
  const partidaIds = finished.map((partida: any) => partida.id)

  const [{ data: jogadores, error: jogadoresErr }, { data: ocorrencias, error: ocorrenciasErr }] = await Promise.all([
    supabase
      .from('Jogador')
      .select('id,nome,numero,equipeId')
      .in('equipeId', teamIds),
    supabase
      .from('OcorrenciaPartida')
      .select('partidaId,tipo,descricao,jogadorId')
      .in('partidaId', partidaIds)
      .in('tipo', SCOUT_TIPOS as unknown as string[]),
  ])
  if (jogadoresErr) throw jogadoresErr
  if (ocorrenciasErr) throw ocorrenciasErr

  const jogadorById = new Map((jogadores ?? []).map((jogador: any) => [jogador.id, jogador]))
  const jogadorByEquipeNumero = new Map(
    (jogadores ?? []).map((jogador: any) => [`${jogador.equipeId}:${normalizeNumero(jogador.numero)}`, jogador]),
  )

  const stats = new Map<number, PlayerScoutRow>()

  for (const ocorrencia of (ocorrencias ?? []) as any[]) {
    const partida = partidaById.get(ocorrencia.partidaId)
    if (!partida) continue

    let jogador = ocorrencia.jogadorId != null ? jogadorById.get(ocorrencia.jogadorId) : undefined
    if (!jogador) {
      jogador = resolveJogadorFromDescricao(ocorrencia.descricao, partida, jogadorByEquipeNumero)
    }
    if (!jogador) continue

    const current = stats.get(jogador.id) ?? {
      jogadorId: jogador.id,
      nome: jogador.nome,
      numero: String(jogador.numero ?? ''),
      equipeId: jogador.equipeId,
      pontos: 0,
      ataques: 0,
      bloqueios: 0,
      aces: 0,
    }

    current.pontos += 1
    const tipo = ocorrencia.tipo as ScoutTipo
    if (tipo === 'attack') current.ataques += 1
    if (tipo === 'block') current.bloqueios += 1
    if (tipo === 'ace') current.aces += 1
    stats.set(jogador.id, current)
  }

  return Array.from(stats.values()).sort((a, b) =>
    b.pontos - a.pontos
    || b.aces - a.aces
    || b.bloqueios - a.bloqueios
    || b.ataques - a.ataques,
  )
}

function resolveJogadorFromDescricao(descricao: string | null, partida: any, jogadorByEquipeNumero: Map<string, any>) {
  const text = String(descricao ?? '')
  const pointMatch = text.match(/#([^\s]+)\s+(.+?)(?:\.|$)/)
  const teamMatch = text.match(/para\s+(.+?):/i)
  if (!pointMatch || !teamMatch) return undefined

  const equipeANome = firstRelation(partida.equipeA)?.nome
  const equipeBNome = firstRelation(partida.equipeB)?.nome
  const teamName = normalizeName(teamMatch[1])
  const equipeId = normalizeName(equipeANome ?? '') === teamName
    ? partida.equipeAId
    : normalizeName(equipeBNome ?? '') === teamName
      ? partida.equipeBId
      : null
  if (!equipeId) return undefined

  return jogadorByEquipeNumero.get(`${equipeId}:${normalizeNumero(pointMatch[1])}`)
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function normalizeNumero(value: string | number | null | undefined) {
  const text = String(value ?? '').trim()
  return text.replace(/^0+(?=\d)/, '') || text
}

const DIACRITICS_PATTERN = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g')

function normalizeName(value: string) {
  return value.normalize('NFD').replace(DIACRITICS_PATTERN, '').toLowerCase().trim()
}
