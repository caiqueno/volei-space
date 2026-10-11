'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useBancoAoVivo } from '@/lib/use-banco-ao-vivo'
import { Activity, CalendarDays, Clock, LogIn, LogOut, Radio, ShieldCheck, Trophy } from 'lucide-react'
import { lerJogadorPonto, lerRotuloPonto } from '@/lib/ponto-sumula'
import { numeroNaPartida } from '@/lib/numero-camisa-partida'
import { agendaDaPartida } from '@/lib/format-partida'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { PlacarJogo } from '@/components/partidas/PlacarJogo'
import { BotaoStoriesInstagram } from '@/components/stories/BotaoStoriesInstagram'
import { cartazPartida, montarSumulaPublica } from '@/lib/stories-cartaz'
import { ocorrenciaOperacional } from '@/lib/sumula-sessao'

type LiveMatch = {
  id: number
  rodada: number
  fase?: string | null
  dataHora: string | null
  localNome: string | null
  status: string
  setsPorA?: number | null
  setsPorB?: number | null
  pontosPorA?: number | null
  pontosPorB?: number | null
  atualizadoEm?: string
  equipeA: { id: number; nome: string; vaga?: boolean; corHex?: string | null; logoUrl?: string | null; jogadores?: LivePlayer[] } | null
  equipeB: { id: number; nome: string; vaga?: boolean; corHex?: string | null; logoUrl?: string | null; jogadores?: LivePlayer[] } | null
  liga?: { nome?: string | null; logoUrl?: string | null } | null
  sets?: Array<{ id: number; numero: number; pontosA: number; pontosB: number }>
  presencas?: Array<{ id: number; presente: boolean; equipeId: number; jogadorId: number; numero?: number | null; jogador?: LivePlayer | null }>
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

function NomeLado({ equipe }: { equipe: { nome?: string | null; vaga?: boolean; corHex?: string | null; logoUrl?: string | null } | null }) {
  const nome = equipe?.nome || (equipe?.vaga ? 'A definir' : 'Equipe')
  return (
    <span className="inline-flex min-w-0 max-w-full flex-col items-center gap-1 text-center">
      <TeamIdentity nome={nome} cor={equipe?.corHex} logoUrl={equipe?.logoUrl} compact showName={false} />
      <NomeEquipe nome={nome} className="font-black leading-tight [overflow-wrap:anywhere]" />
    </span>
  )
}

export default function LiveMatchView({ partidaId, embutido = false }: { partidaId: string; embutido?: boolean }) {
  const [match, setMatch] = useState<LiveMatch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const recarregar = useRef<() => void>(() => {})
  const partidaNumero = Number(partidaId)

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
    recarregar.current = () => { void load() }
    load()
    function handleStorage(event: StorageEvent) {
      if (event.key === demoStorageKey) syncStoredDemo()
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      alive = false
      window.removeEventListener('storage', handleStorage)
    }
  }, [partidaId])

  useBancoAoVivo(
    Number.isInteger(partidaNumero) && partidaNumero > 0 ? `ao-vivo-${partidaNumero}` : '',
    Number.isInteger(partidaNumero) && partidaNumero > 0
      ? [
          { tabela: 'Partida', filtro: `id=eq.${partidaNumero}` },
          { tabela: 'SetPartida', filtro: `partidaId=eq.${partidaNumero}` },
        ]
      : [],
    () => recarregar.current(),
  )

  const timeline = useMemo(() => orderLiveEvents(match?.ocorrencias ?? []).filter(shouldShowLiveEvent), [match])
  const scout = useMemo(() => match ? buildIndividualScout(match) : [], [match])

  const Root = embutido ? 'section' : 'main'
  const classe = embutido ? 'live-match-page is-dock' : 'live-match-page'

  if (loading) {
    return (
      <Root className={classe}>
        <section className="live-match-state"><Activity size={22} /><h1>Carregando partida</h1><p>Buscando placar e movimentações ao vivo.</p></section>
      </Root>
    )
  }

  if (error || !match || !match.equipeA || !match.equipeB) {
    return (
      <Root className={classe}>
        <section className="live-match-state is-error"><ShieldCheck size={24} /><h1>Partida indisponível</h1><p>{error || 'Não foi possível encontrar esta partida.'}</p></section>
      </Root>
    )
  }

  const scoreA = latestSet(match)?.pontosA ?? match.pontosPorA ?? 0
  const scoreB = latestSet(match)?.pontosB ?? match.pontosPorB ?? 0
  const finished = ['encerrada', 'finalizada', 'finished'].includes(normalizeStatus(match.status))
  const agenda = agendaDaPartida(match)

  return (
    <Root className={classe}>
      <section className="live-match-hero">
        <div>
          <div className="live-match-hero-top">
            <span><Radio size={15} /> {finished && match.oficial ? 'Súmula oficial' : 'Placar em tempo real'}</span>
            <span className="ml-auto flex items-center gap-2">
              {!embutido && (
                <BotaoStoriesInstagram
                  titulo={finished ? 'Fim de jogo' : 'Ao vivo'}
                  oferecerSumula={match.oficial === true}
                  versao={`${match.setsPorA ?? 0}-${match.setsPorB ?? 0}-${scoreA}-${scoreB}-${match.oficial ? 1 : 0}`}
                  montar={({ incluirSumula, link }) => cartazPartida(resultadoDoPlacar(match, scoreA, scoreB, finished), link, incluirSumula && match.oficial ? sumulaDoPlacar(match) : null, match.liga?.nome ?? undefined, match.liga?.logoUrl)}
                />
              )}
              <em>{formatStatus(match.status)}</em>
            </span>
          </div>
          <h1 className="live-match-hero-times"><NomeLado equipe={match.equipeA} /> <small>vs</small> <NomeLado equipe={match.equipeB} /></h1>
          <p><CalendarDays size={16} /> {agenda.rotulo}{agenda.data ? ` · ${agenda.data}` : ''}</p>
          {agenda.local ? <p><Clock size={16} /> {agenda.local}</p> : null}
          {finished && match.oficial ? <p>Resultado oficial, visível sem login.</p> : null}
        </div>
        <PlacarJogo
          ladoA={<NomeLado equipe={match.equipeA} />}
          ladoB={<NomeLado equipe={match.equipeB} />}
          valorA={scoreA}
          valorB={scoreB}
          centro={<>{match.setsPorA ?? 0} x {match.setsPorB ?? 0}<em>sets</em></>}
        />
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
                <h3 className="inline-flex items-center gap-2">
                  <TeamIdentity nome={team.teamName} cor={team.corHex} logoUrl={team.logoUrl} compact showName={false} />
                  <NomeEquipe nome={team.teamName} className="text-lg font-black leading-tight [overflow-wrap:anywhere]" />
                </h3>
                {team.players.length ? (
                  <div className="live-match-scout-table">
                    <div><span>Atleta</span><span>Pts</span><span>Ataque</span><span>Bloqueio</span><span>Saque</span></div>
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
    </Root>
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


function resultadoDoPlacar(match: LiveMatch, pontosA: number, pontosB: number, encerrado: boolean) {
  const setsA = Number(match.setsPorA ?? 0)
  const setsB = Number(match.setsPorB ?? 0)
  const nomeA = match.equipeA?.nome || 'Equipe A'
  const nomeB = match.equipeB?.nome || 'Equipe B'
  const mvp = (match.destaques ?? []).find((item) => String(item.tipo).toUpperCase() === 'MVP')?.jogador?.nome ?? null
  return {
    nomeA,
    nomeB,
    setsPorA: setsA,
    setsPorB: setsB,
    parciais: (match.sets ?? []).map((set) => ({ numero: set.numero, pontosA: set.pontosA, pontosB: set.pontosB })),
    vencedor: !encerrado || setsA === setsB ? null : setsA > setsB ? nomeA : nomeB,
    mvp,
    aoVivo: !encerrado,
    pontosA,
    pontosB,
    logoA: match.equipeA?.logoUrl ?? null,
    logoB: match.equipeB?.logoUrl ?? null,
    corA: match.equipeA?.corHex ?? null,
    corB: match.equipeB?.corHex ?? null,
  }
}

function sumulaDoPlacar(match: LiveMatch) {
  return montarSumulaPublica({
    nomeA: match.equipeA?.nome || 'Equipe A',
    nomeB: match.equipeB?.nome || 'Equipe B',
    logoA: match.equipeA?.logoUrl ?? null,
    logoB: match.equipeB?.logoUrl ?? null,
    corA: match.equipeA?.corHex ?? null,
    corB: match.equipeB?.corHex ?? null,
    parciais: (match.sets ?? []).map((set) => ({ numero: set.numero, pontosA: set.pontosA, pontosB: set.pontosB })),
    ocorrencias: match.ocorrencias ?? [],
    jogadoresA: (match.equipeA?.jogadores ?? []).map((jogador) => ({ id: jogador.id, nome: jogador.nome })),
    jogadoresB: (match.equipeB?.jogadores ?? []).map((jogador) => ({ id: jogador.id, nome: jogador.nome })),
  })
}

function latestSet(match: LiveMatch) {
  return [...(match.sets ?? [])].sort((a, b) => b.numero - a.numero)[0]
}

function orderLiveEvents(events: NonNullable<LiveMatch['ocorrencias']>) {
  return [...events].sort((a, b) => Number(a.id) - Number(b.id))
}

function shouldShowLiveEvent(event: NonNullable<LiveMatch['ocorrencias']>[number]) {
  if (ocorrenciaOperacional(event)) return false
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
  const rotulo = lerRotuloPonto(text)
  if (rotulo) return rotulo
  const normalized = normalizeStatus(tipo)
  const lowerText = text.toLowerCase()
  if (normalized.includes('substitution') || normalized.includes('substituicao') || lowerText.includes('substitui')) return 'Substituição'
  if (normalized.includes('ace') || lowerText.includes('ace para')) return 'ACE'
  if (normalized.includes('block')) return 'Bloqueio'
  if (normalized.includes('attack')) return 'Ataque'
  if (normalized.includes('point') && lowerText.includes('bloqueio para')) return 'Bloqueio'
  if (normalized.includes('point') && lowerText.includes('ataque para')) return 'Ataque'
  if (lowerText.includes('tempo de equipe')) return 'Tempo de equipe'
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
    { id: 'A', name: match.equipeA?.nome ?? 'Equipe A', corHex: match.equipeA?.corHex, logoUrl: match.equipeA?.logoUrl, players: match.equipeA?.jogadores ?? [] },
    { id: 'B', name: match.equipeB?.nome ?? 'Equipe B', corHex: match.equipeB?.corHex, logoUrl: match.equipeB?.logoUrl, players: match.equipeB?.jogadores ?? [] },
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
    const pointMatch = text.match(/(ACE|Ataque|Bloqueio)\s+para\s+(.+?):\s*#([^\s]+)\s+(.+?)(?:\.|$)/i)

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
      const numeroPartida = rosterPlayer ? numeroNaPartida(rosterPlayer, match.presencas ?? []) : null
      player = {
        number: numeroPartida == null ? String(pointMatch?.[3] ?? rosterPlayer?.numero ?? '') : String(numeroPartida),
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
    corHex: team.corHex,
    logoUrl: team.logoUrl,
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
  const rotuloDePonto = lerRotuloPonto(parsed.text)
  const jogadorDoPonto = lerJogadorPonto(parsed.text)
  const isSubstitution = event.tipo === 'substitution' || parsed.text.toLowerCase().includes('substitui')
  const substitution = isSubstitution ? parseSubstitutionText(parsed.text, teamNames) : null
  const badgeText = isSubstitution ? label : rotuloDePonto || parsed.score || label
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
      ) : rotuloDePonto ? (
        <p>{jogadorDoPonto ?? cleanText}</p>
      ) : (
        <p>{cleanText}</p>
      )}
    </>
  )
}
