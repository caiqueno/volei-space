'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, Clock, LogIn, LogOut, Radio, ShieldCheck, Trophy } from 'lucide-react'

type LiveMatch = {
  id: number
  rodada: number
  dataHora: string | null
  localNome: string | null
  status: string
  setsPorA?: number | null
  setsPorB?: number | null
  pontosPorA?: number | null
  pontosPorB?: number | null
  atualizadoEm?: string
  equipeA: { id: number; nome: string; jogadores?: LivePlayer[] } | null
  equipeB: { id: number; nome: string; jogadores?: LivePlayer[] } | null
  sets?: Array<{ id: number; numero: number; pontosA: number; pontosB: number }>
  presencas?: Array<{ id: number; presente: boolean; equipeId: number; jogadorId: number; jogador?: LivePlayer | null }>
  ocorrencias?: Array<{ id: number; tipo: string; descricao: string; set?: number | null; createdAt?: string | null; jogadorId?: number | null }>
  destaques?: Array<{ id: number; tipo: string; jogador?: LivePlayer | null }>
  oficial?: boolean
}

type LivePlayer = {
  id: number
  nome: string
  numero?: number | string | null
  fotoRostoUrl?: string | null
  fotoUrl?: string | null
}

export default function LiveMatchView({ partidaId }: { partidaId: string }) {
  const [match, setMatch] = useState<LiveMatch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const demoStorageKey = `luv-live-match-${partidaId}`
    function syncStoredDemo() {
      const stored = readStoredDemoMatch(partidaId)
      if (stored) {
        setMatch(stored)
        setError('')
        setLoading(false)
      }
    }
    async function load() {
      try {
        const res = await fetch(`/api/partidas/${partidaId}/ao-vivo?t=${Date.now()}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || json?.message || 'Erro ao carregar partida')
        if (alive) {
          setMatch(readStoredDemoMatch(partidaId) ?? json.data)
          setError('')
          setLoading(false)
        }
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar acompanhamento')
          setLoading(false)
        }
      }
    }
    load()
    function handleStorage(event: StorageEvent) {
      if (event.key === demoStorageKey) syncStoredDemo()
    }
    window.addEventListener('storage', handleStorage)
    const timer = window.setInterval(load, 4000)
    return () => {
      alive = false
      window.removeEventListener('storage', handleStorage)
      window.clearInterval(timer)
    }
  }, [partidaId])

  const timeline = useMemo(() => orderLiveEvents(match?.ocorrencias ?? []).filter(shouldShowLiveEvent), [match])
  const scout = useMemo(() => match ? buildIndividualScout(match) : [], [match])

  if (loading) {
    return (
      <main className="live-match-page">
        <section className="live-match-state"><Activity size={22} /><h1>Carregando partida</h1><p>Buscando placar e movimentações ao vivo.</p></section>
      </main>
    )
  }

  if (error || !match || !match.equipeA || !match.equipeB) {
    return (
      <main className="live-match-page">
        <section className="live-match-state is-error"><ShieldCheck size={24} /><h1>Partida indisponível</h1><p>{error || 'Não foi possível encontrar esta partida.'}</p></section>
      </main>
    )
  }

  const scoreA = latestSet(match)?.pontosA ?? match.pontosPorA ?? 0
  const scoreB = latestSet(match)?.pontosB ?? match.pontosPorB ?? 0
  const finished = ['encerrada', 'finalizada', 'finished'].includes(normalizeStatus(match.status))

  return (
    <main className="live-match-page">
      <section className="live-match-hero">
        <div>
          <div className="live-match-hero-top">
            <span><Radio size={15} /> {finished && match.oficial ? 'Súmula oficial' : 'Placar em tempo real'}</span>
            <em>{formatStatus(match.status)}</em>
          </div>
          <h1>{match.equipeA.nome} <small>vs</small> {match.equipeB.nome}</h1>
          <p><CalendarDays size={16} /> Rodada {match.rodada} · {match.dataHora ? new Date(match.dataHora).toLocaleString('pt-BR') : 'Data a definir'}</p>
          <p><Clock size={16} /> {match.localNome || 'Local a definir'}</p>
          {finished && match.oficial ? <p>Resultado oficial, visível sem login.</p> : null}
        </div>
        <div className="live-match-scoreboard">
          <div><strong>{match.equipeA.nome}</strong><b>{scoreA}</b></div>
          <span>{match.setsPorA ?? 0} x {match.setsPorB ?? 0}<em>sets</em></span>
          <div><strong>{match.equipeB.nome}</strong><b>{scoreB}</b></div>
        </div>
      </section>

      <section className="live-match-grid">
        <article className="live-match-card">
          <header><h2>Resumo da partida</h2></header>
          <div className="live-match-sets">
            {(match.sets?.length ? match.sets : [{ id: 0, numero: 1, pontosA: scoreA, pontosB: scoreB }]).map((set) => (
              <div key={set.id || set.numero}>
                <span>Set {set.numero}</span>
                <strong>{set.pontosA} x {set.pontosB}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="live-match-card live-match-wide">
          <header><h2>Lances da partida</h2><span>Atualização automática</span></header>
          <div className="live-match-timeline">
            {timeline.length ? timeline.map((event) => (
              <div key={event.id}>
                <LiveEvent event={event} teamNames={[match.equipeA?.nome, match.equipeB?.nome].filter(Boolean) as string[]} />
              </div>
            )) : <p className="live-match-empty">Nenhum lance registrado ainda.</p>}
          </div>
        </article>

        {finished && <article className="live-match-card live-match-highlights-card">
          <header><h2>Destaques</h2><span><Trophy size={14} /> Oficial</span></header>
          <div className="live-match-highlights">
            {match.destaques?.length ? match.destaques.map((item) => (
              <div key={item.id}>
                {playerPhoto(item.jogador) ? <img src={playerPhoto(item.jogador)!} alt="" /> : <i>{initials(item.jogador?.nome ?? 'Atleta')}</i>}
                <span>{item.tipo}</span>
                <strong>{item.jogador?.nome ?? 'Atleta'}</strong>
              </div>
            )) : <p className="live-match-empty">Destaques ainda não definidos na súmula oficial.</p>}
          </div>
        </article>}

        {finished && <article className="live-match-card live-match-scout-card">
          <header><h2>Scout individual</h2><span>Final da partida</span></header>
          <div className="live-match-scout">
            {scout.map((team) => (
              <section key={team.teamId}>
                <h3>{team.teamName}</h3>
                {team.players.length ? (
                  <div className="live-match-scout-table">
                    <div><span>Atleta</span><span>Pts</span><span>Ataq.</span><span>Bloq.</span><span>Aces</span></div>
                    {team.players.map((player) => (
                      <div key={`${team.teamId}-${player.number}-${player.name}`}>
                        <strong>#{player.number} {player.name}</strong>
                        <b>{player.points}</b>
                        <b>{player.attacks}</b>
                        <b>{player.blocks}</b>
                        <b>{player.aces}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="live-match-empty">Nenhum lance individual registrado para esta equipe.</p>
                )}
              </section>
            ))}
          </div>
        </article>}
      </section>
    </main>
  )
}

function readStoredDemoMatch(partidaId: string) {
  if (typeof window === 'undefined' || partidaId !== '9001') return null
  try {
    const raw = window.localStorage.getItem(`luv-live-match-${partidaId}`)
    return raw ? JSON.parse(raw) as LiveMatch : null
  } catch {
    return null
  }
}


function latestSet(match: LiveMatch) {
  return [...(match.sets ?? [])].sort((a, b) => b.numero - a.numero)[0]
}

function orderLiveEvents(events: NonNullable<LiveMatch['ocorrencias']>) {
  return [...events].sort((a, b) => Number(a.id) - Number(b.id))
}

function shouldShowLiveEvent(event: NonNullable<LiveMatch['ocorrencias']>[number]) {
  const parsed = parseEventDescription(event.descricao)
  return !parsed.text.toLowerCase().includes('troca de saque')
}

function playerPhoto(player?: LivePlayer | null) {
  return player?.fotoRostoUrl || player?.fotoUrl || null
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AT'
}

function normalizeStatus(status: string) {
  return status.replaceAll('_', ' ').toLowerCase()
}

function formatStatus(status: string) {
  return normalizeStatus(status).replace(/^\w/, (letter) => letter.toUpperCase())
}

function parseEventDescription(description: string) {
  const [time, score, ...textParts] = description.split('|').map((part) => part.trim())
  const text = textParts.join(' | ')
  if (!text) return { time: '', score: '', text: description }
  return { time, score, text }
}

function liveEventTypeLabel(tipo: string, text: string) {
  const normalized = normalizeStatus(tipo)
  const lowerText = text.toLowerCase()
  if (normalized.includes('substitution') || normalized.includes('substituicao') || lowerText.includes('substitui')) return 'Substituição'
  if (normalized.includes('ace') || lowerText.includes('ace para')) return 'ACE'
  if (normalized.includes('block')) return 'Bloqueio'
  if (normalized.includes('attack')) return 'Ataque'
  if (normalized.includes('point') && lowerText.includes('bloqueio para')) return 'Bloqueio'
  if (normalized.includes('point') && lowerText.includes('ataque para')) return 'Ataque'
  if (normalized.includes('timeout') || lowerText.includes('tempo técnico')) return 'Tempo técnico'
  if (normalized.includes('set end') || lowerText.includes('set encerrado')) return 'Set encerrado'
  if (normalized.includes('set start') || lowerText.includes('set iniciado')) return 'Início de set'
  if (normalized.includes('point') || lowerText.includes('ponto para')) return 'Ponto'
  if (normalized.includes('anotacao') || normalized.includes('note')) return 'Anotação'
  return 'Lance'
}

function escapeLiveRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripTeamSuffix(text: string, teamNames: string[]) {
  let cleaned = text
  for (const teamName of teamNames.filter(Boolean)) {
    cleaned = cleaned.replace(new RegExp(`\\s*[-\\u2013\\u2014]\\s*${escapeLiveRegExp(teamName)}(?=[.,]|$)`, 'gi'), '')
  }
  return cleaned.replace(/\s{2,}/g, ' ').trim()
}

function cleanLiveText(text: string, teamNames: string[], options: { removeScore?: boolean } = {}) {
  const cleanText = stripTeamSuffix(text, teamNames)
  if (!options.removeScore) return cleanText
  return cleanText
    .replace(/\s*Placar\s+\d+\s*x\s*\d+\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

type IndividualScoutPlayer = {
  number: string
  name: string
  points: number
  attacks: number
  blocks: number
  aces: number
}

const SCOUT_ACTION_BY_TIPO: Record<string, 'ataque' | 'bloqueio' | 'ace'> = {
  attack: 'ataque',
  block: 'bloqueio',
  ace: 'ace',
}

function buildIndividualScout(match: LiveMatch) {
  const teams = [
    { id: 'A', name: match.equipeA?.nome ?? 'Equipe A', players: match.equipeA?.jogadores ?? [] },
    { id: 'B', name: match.equipeB?.nome ?? 'Equipe B', players: match.equipeB?.jogadores ?? [] },
  ]
  const statsByTeam = new Map(teams.map((team) => [team.id, new Map<number | string, IndividualScoutPlayer>()]))

  function findTeamId(teamName: string) {
    const normalized = normalizeForScout(teamName)
    return teams.find((team) => normalizeForScout(team.name) === normalized)?.id ?? null
  }

  function findTeamIdByPlayer(jogadorId: number) {
    return teams.find((team) => team.players.some((player) => player.id === jogadorId))?.id ?? null
  }

  function resolvePlayer(teamId: string, rawNumber: string, fallbackName: string) {
    const normalizedNumber = normalizeJerseyNumber(rawNumber)
    const team = teams.find((item) => item.id === teamId)
    const player = team?.players.find((item) => normalizeJerseyNumber(item.numero ?? '') === normalizedNumber)
    return {
      number: String(player?.numero ?? rawNumber),
      name: (player?.nome ?? fallbackName.trim()) || 'Atleta',
    }
  }

  for (const event of match.ocorrencias ?? []) {
    const action = SCOUT_ACTION_BY_TIPO[event.tipo]
    if (!action) continue

    const parsed = parseEventDescription(event.descricao || '')
    const text = parsed.text || event.descricao || ''
    const pointMatch = text.match(/^(ACE|Ataque|Bloqueio)\s+para\s+(.+?):\s*#([^\s]+)\s+(.+?)(?:\.|$)/i)

    // O jogadorId persistido é a fonte confiável de quem pontuou: o número no texto
    // pode ter sido sobrescrito para a partida e não bater mais com o número de elenco.
    const teamIdByPlayer = event.jogadorId != null ? findTeamIdByPlayer(event.jogadorId) : null
    const teamId = teamIdByPlayer ?? (pointMatch ? findTeamId(pointMatch[2]) : null)
    if (!teamId) continue

    let key: number | string
    let player: { number: string; name: string }
    if (teamIdByPlayer && event.jogadorId != null) {
      const rosterPlayer = teams.find((item) => item.id === teamId)?.players.find((item) => item.id === event.jogadorId)
      key = event.jogadorId
      player = {
        number: String(rosterPlayer?.numero ?? pointMatch?.[3] ?? ''),
        name: rosterPlayer?.nome ?? pointMatch?.[4]?.trim() ?? 'Atleta',
      }
    } else if (pointMatch) {
      player = resolvePlayer(teamId, pointMatch[3], pointMatch[4])
      key = normalizeJerseyNumber(player.number)
    } else {
      continue
    }

    const teamStats = statsByTeam.get(teamId)
    if (!teamStats) continue

    const current = teamStats.get(key) ?? { ...player, points: 0, attacks: 0, blocks: 0, aces: 0 }
    current.points += 1
    if (action === 'ataque') current.attacks += 1
    if (action === 'bloqueio') current.blocks += 1
    if (action === 'ace') current.aces += 1
    teamStats.set(key, current)
  }

  return teams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    players: Array.from(statsByTeam.get(team.id)?.values() ?? []).sort((a, b) =>
      b.points - a.points
      || b.aces - a.aces
      || b.blocks - a.blocks
      || b.attacks - a.attacks
      || Number(normalizeJerseyNumber(a.number)) - Number(normalizeJerseyNumber(b.number)),
    ),
  }))
}

function normalizeForScout(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function normalizeJerseyNumber(value: string | number | null | undefined) {
  const text = String(value ?? '').trim()
  return text.replace(/^0+(?=\d)/, '') || text
}

function parseSubstitutionText(text: string, teamNames: string[]) {
  const cleanText = cleanLiveText(text, teamNames, { removeScore: true })
  const match = cleanText.match(/Substituição\s+([^:]+):\s*sai\s+(.+?),\s*entra\s+(.+?)\.?$/i)
  if (!match) return null
  return {
    team: match[1],
    outPlayer: match[2],
    inPlayer: match[3].replace(/\.$/, ''),
  }
}

function LiveEvent({ event, teamNames }: { event: NonNullable<LiveMatch['ocorrencias']>[number]; teamNames: string[] }) {
  const parsed = parseEventDescription(event.descricao)
  const label = liveEventTypeLabel(event.tipo, parsed.text)
  const isSubstitution = event.tipo === 'substitution' || parsed.text.toLowerCase().includes('substitui')
  const substitution = isSubstitution ? parseSubstitutionText(parsed.text, teamNames) : null
  const badgeText = isSubstitution ? label : parsed.score || label
  const cleanText = cleanLiveText(parsed.text, teamNames, { removeScore: true })
  return (
    <>
      <header>
        <span>{event.set ? `Set ${event.set}` : 'Partida'}</span>
        <div className="live-match-event-meta">
          {parsed.time && <time>{parsed.time}</time>}
        </div>
      </header>
      <b className={isSubstitution ? 'is-substitution' : ''}>{badgeText}</b>
      {substitution ? (
        <div className="live-match-substitution">
          <p>{substitution.team}</p>
          <span><LogOut size={16} /> Sai <strong>{substitution.outPlayer}</strong></span>
          <span><LogIn size={16} /> Entra <strong>{substitution.inPlayer}</strong></span>
        </div>
      ) : (
        <p>{cleanText}</p>
      )}
    </>
  )
}
