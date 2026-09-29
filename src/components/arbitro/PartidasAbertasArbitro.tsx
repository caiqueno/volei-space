'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, MapPin, ShieldCheck, Trophy } from 'lucide-react'

type PartidaDesignada = {
  id: number
  rodada?: number | null
  status?: string | null
  dataHora?: string | null
  localNome?: string | null
  sumulaToken?: string | null
  setsPorA?: number | null
  setsPorB?: number | null
  pontosPorA?: number | null
  pontosPorB?: number | null
  liga?: { nome?: string | null; simulacao?: boolean | null } | { nome?: string | null; simulacao?: boolean | null }[] | null
  equipeA?: { nome?: string | null } | null
  equipeB?: { nome?: string | null } | null
}

const STATUS: Record<string, string> = {
  AGENDADA: 'Aguardando',
  PENDENTE: 'Aguardando',
  PENDENTE_APROVACAO: 'Aguardando',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
  WO: 'W.O.',
}

function nomeLiga(partida: PartidaDesignada) {
  const liga = Array.isArray(partida.liga) ? partida.liga[0] : partida.liga
  return liga?.nome || 'Campeonato'
}

function horario(valor?: string | null) {
  if (!valor) return 'Horário a definir'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Horário a definir'
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function PartidasAbertasArbitro({ compact = false }: { compact?: boolean }) {
  const [isArbitro, setIsArbitro] = useState<boolean | null>(null)
  const [partidas, setPartidas] = useState<PartidaDesignada[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [elegivel, setElegivel] = useState(true)
  const [motivo, setMotivo] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      try {
        const session = JSON.parse(window.localStorage.getItem('luva_session') ?? 'null')
        if (session?.tipo !== 'arbitro') {
          if (ativo) {
            setIsArbitro(false)
            setLoading(false)
          }
          return
        }
        if (ativo) setIsArbitro(true)
        const response = await fetch('/api/arbitro/partidas-abertas', { cache: 'no-store' })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(json.error ?? 'Não foi possível carregar as partidas.')
        if (!ativo) return
        setElegivel(json.data?.elegivel !== false)
        setMotivo(json.data?.motivo ?? null)
        setPartidas(json.data?.partidas ?? [])
        setFeedback(null)
      } catch (err) {
        if (ativo) setFeedback(err instanceof Error ? err.message : 'Não foi possível carregar as partidas.')
      } finally {
        if (ativo) setLoading(false)
      }
    }
    carregar()
    const timer = window.setInterval(carregar, 8000)
    return () => {
      ativo = false
      window.clearInterval(timer)
    }
  }, [])

  if (isArbitro === false) return null

  return (
    <section className={compact ? 'referee-open-section compact' : 'referee-open-section'}>
      <div className="referee-open-head">
        <div>
          <p className="luva-kicker">Escala</p>
          <h2>Partidas designadas</h2>
          <p>Você opera somente os jogos em que o organizador vinculou o seu nome. Não é possível escolher outra partida.</p>
        </div>
      </div>

      {feedback && <p className="referee-open-feedback">{feedback}</p>}
      {loading ? (
        <div className="referee-open-empty">Carregando as partidas designadas...</div>
      ) : !elegivel ? (
        <div className="referee-open-empty">{motivo ?? 'Seu cadastro ainda não está liberado.'}</div>
      ) : partidas.length === 0 ? (
        <div className="referee-open-empty">Nenhuma partida designada para você.</div>
      ) : (
        <div className="referee-open-grid">
          {partidas.map((partida) => {
            const status = String(partida.status || 'AGENDADA').toUpperCase()
            const podeOperar = status === 'AGENDADA' || status === 'EM_ANDAMENTO' || status === 'PENDENTE'
            const placar = status === 'ENCERRADA' || status === 'EM_ANDAMENTO'
              ? `${partida.setsPorA ?? 0} × ${partida.setsPorB ?? 0}`
              : null
            return (
              <article key={partida.id} className="referee-open-card">
                <div className="referee-open-card-top">
                  <span><Trophy size={16} /> {nomeLiga(partida)}</span>
                  <strong>{STATUS[status] ?? status}</strong>
                </div>
                <h3>{partida.equipeA?.nome ?? 'Equipe A'} × {partida.equipeB?.nome ?? 'Equipe B'}</h3>
                <p><CalendarClock size={14} /> Rodada {partida.rodada || '—'} · {horario(partida.dataHora)}</p>
                {partida.localNome && <p><MapPin size={14} /> {partida.localNome}</p>}
                {placar && <p><ShieldCheck size={14} /> Sets {placar}{status === 'EM_ANDAMENTO' ? ` · ${partida.pontosPorA ?? 0} a ${partida.pontosPorB ?? 0}` : ''}</p>}
                {podeOperar && partida.sumulaToken ? (
                  <Link href={`/arbitro/partida/${partida.id ?? partida.sumulaToken}`} className="referee-primary mt-4 inline-flex rounded-full px-4 py-2 text-sm font-black">
                    Operar partida
                  </Link>
                ) : (
                  <p className="mt-4 text-sm font-bold">Esta partida não aceita novos lançamentos.</p>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
