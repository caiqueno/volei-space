'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Filter, MapPin, Radio, ShieldCheck, Trophy, UsersRound } from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'

type PartidaAberta = {
  id: number
  rodada?: number | null
  status?: string | null
  dataHora?: string | null
  localNome?: string | null
  localEndereco?: string | null
  categoria?: string | null
  serie?: string | null
  ligaId?: number | null
  liga?: { id?: number | null; nome?: string | null; subtitulo?: string | null } | null
  equipeA?: { nome?: string | null } | null
  equipeB?: { nome?: string | null } | null
  minhaCandidatura?: { status?: string | null } | null
}

type Props = {
  compact?: boolean
}

const periodos = [
  { label: 'Próximos 30 dias', value: '30' },
  { label: 'Próximos 60 dias', value: '60' },
  { label: 'Todas abertas', value: 'all' },
]

export function PartidasAbertasArbitro({ compact = false }: Props) {
  const [isArbitro, setIsArbitro] = useState<boolean | null>(null)
  const [elegivel, setElegivel] = useState(true)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [partidas, setPartidas] = useState<PartidaAberta[]>([])
  const [periodo, setPeriodo] = useState('30')
  const [ligaId, setLigaId] = useState('todas')
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  async function loadPartidas(nextPeriodo = periodo, nextLigaId = ligaId) {
    setLoading(true)
    setFeedback(null)

    try {
      const params = new URLSearchParams({
        periodo: nextPeriodo,
        limit: nextPeriodo === 'all' ? '24' : '12',
      })
      if (nextLigaId !== 'todas') params.set('ligaId', nextLigaId)

      const response = await fetch(`/api/arbitro/partidas-abertas?${params.toString()}`, { cache: 'no-store' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Erro ao buscar partidas.')

      setElegivel(json.data?.elegivel !== false)
      setMotivo(json.data?.motivo ?? null)
      setPartidas(json.data?.partidas ?? [])
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Não foi possível carregar as partidas abertas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    try {
      const session = JSON.parse(window.localStorage.getItem('luva_session') ?? 'null')
      const allowed = session?.tipo === 'arbitro'
      setIsArbitro(allowed)
      if (allowed) loadPartidas('30', 'todas')
      else setLoading(false)
    } catch {
      setIsArbitro(false)
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function candidatar(partidaId: number) {
    setSubmittingId(partidaId)
    setFeedback(null)

    try {
      const response = await fetch('/api/arbitro/partidas-abertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partidaId }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Erro ao registrar candidatura.')

      setFeedback('Candidatura registrada. A organização poderá confirmar sua escala.')
      await loadPartidas()
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Não foi possível registrar a candidatura.')
    } finally {
      setSubmittingId(null)
    }
  }

  function changePeriodo(value: string) {
    setPeriodo(value)
    loadPartidas(value, ligaId)
  }

  function changeLiga(value: string) {
    setLigaId(value)
    loadPartidas(periodo, value)
  }

  const ligas = useMemo(() => {
    const map = new Map<string, string>()
    partidas.forEach((partida) => {
      const id = String(partida.liga?.id ?? partida.ligaId ?? '')
      if (id) map.set(id, partida.liga?.nome ?? 'Campeonato')
    })
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }))
  }, [partidas])

  const abertas = useMemo(() => partidas.filter((partida) => !partida.minhaCandidatura), [partidas])
  const solicitadas = partidas.length - abertas.length

  if (isArbitro === false) return null

  return (
    <section className={compact ? 'referee-open-section compact' : 'referee-open-section'}>
      <div className="referee-open-head">
        <div>
          <p className="luva-kicker">Escalas abertas</p>
          <h2>Partidas disponíveis para arbitragem</h2>
          <p>Candidate-se a jogos sem árbitro escalado. Por padrão, mostramos poucas oportunidades próximas para manter a lista objetiva.</p>
        </div>
        <div className="referee-open-metrics">
          <span><Radio size={16} /> {abertas.length} abertas</span>
          <span><CheckCircle2 size={16} /> {solicitadas} solicitada(s)</span>
        </div>
      </div>

      {!loading && !elegivel ? (
        <div className="referee-open-empty">{motivo ?? 'Seu cadastro precisa ser aprovado antes de se candidatar para partidas.'}</div>
      ) : (
        <>
          <div className="referee-open-filters" aria-label="Filtros de partidas abertas">
            <label>
              <span><Filter size={14} /> Período</span>
              <select value={periodo} onChange={(event) => changePeriodo(event.target.value)}>
                {periodos.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label>
              <span><Trophy size={14} /> Campeonato</span>
              <select value={ligaId} onChange={(event) => changeLiga(event.target.value)}>
                <option value="todas">Todos os campeonatos</option>
                {ligas.map((liga) => (
                  <option key={liga.id} value={liga.id}>{liga.nome}</option>
                ))}
              </select>
            </label>
          </div>

          {feedback && <p className="referee-open-feedback">{feedback}</p>}

          {loading ? (
            <div className="referee-open-empty">Carregando partidas abertas...</div>
          ) : partidas.length === 0 ? (
            <div className="referee-open-empty">Nenhuma partida sem árbitro encontrada com esses filtros.</div>
          ) : (
            <div className="referee-open-grid">
              {partidas.map((partida) => {
                const candidaturaStatus = partida.minhaCandidatura?.status
                return (
                  <article key={partida.id} className="referee-open-card">
                    <div className="referee-open-card-top">
                      <span><Trophy size={15} /> {partida.liga?.nome ?? 'Campeonato'}</span>
                      <strong>{candidaturaStatus ? formatStatus(candidaturaStatus) : 'Aberta'}</strong>
                    </div>

                    <h3>{partida.equipeA?.nome ?? 'Equipe A'} x {partida.equipeB?.nome ?? 'Equipe B'}</h3>

                    <div className="referee-open-info">
                      <span><CalendarClock size={15} /> {formatDateTime(partida.dataHora)}</span>
                      <span><UsersRound size={15} /> {formatCategoria(partida.categoria, partida.serie)}</span>
                      <span><MapPin size={15} /> {partida.localNome || partida.localEndereco || 'Local a definir'}</span>
                    </div>

                    <ActionBar
                      type="button"
                      onClick={() => candidatar(partida.id)}
                      loading={submittingId === partida.id}
                      loadingLabel="Enviando"
                      disabled={Boolean(candidaturaStatus)}
                      className="referee-open-action"
                    >
                      <ShieldCheck size={17} />
                      {candidaturaStatus ? 'Candidatura enviada' : 'Candidatar-me'}
                    </ActionBar>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Data e horário a definir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data e horário a definir'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatCategoria(categoria?: string | null, serie?: string | null) {
  return [categoria, serie].filter(Boolean).join(' · ') || 'Categoria a definir'
}

function formatStatus(status?: string | null) {
  const map: Record<string, string> = {
    SOLICITADA: 'Solicitada',
    APROVADA: 'Aprovada',
    REJEITADA: 'Rejeitada',
  }
  return status ? map[status] ?? status.toLowerCase().replace(/_/g, ' ') : 'Solicitada'
}
