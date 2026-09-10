import { CalendarClock, ClipboardList, ExternalLink, MapPin, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'

type Set = { numero: number; pontosA: number; pontosB: number }
type Equipe = { id: number; nome: string; corHex: string | null }
type Partida = {
  id: number
  rodada: number
  status: string
  dataHora: Date | string | null
  localNome: string | null
  equipeA: Equipe
  equipeB: Equipe
  setsPorA: number | null
  setsPorB: number | null
  sets: Set[]
  sumulaToken?: string | null
}

const statusBadge: Record<string, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'error' }> = {
  AGENDADA: { label: 'Agendada', variant: 'neutral' },
  EM_ANDAMENTO: { label: 'Ao vivo', variant: 'info' },
  PENDENTE_APROVACAO: { label: 'Em análise', variant: 'warning' },
  ENCERRADA: { label: 'Encerrada', variant: 'success' },
  WO: { label: 'W.O.', variant: 'error' },
}

export function PartidaCard({ partida, showSumulaLink = false, roundLabel }: { partida: Partida; showSumulaLink?: boolean; roundLabel?: string }) {
  const badge = statusBadge[partida.status] ?? { label: partida.status, variant: 'neutral' as const }
  const encerrada = partida.status === 'ENCERRADA' || partida.status === 'WO'
  const dataFmt = formatMatchDate(partida.dataHora)
  const liveLabel = encerrada ? 'Resumo da partida' : partida.status === 'EM_ANDAMENTO' ? 'Acompanhar ao vivo' : 'Link público'
  const sumulaHref = showSumulaLink && partida.sumulaToken ? `/sumula/${encodeURIComponent(partida.sumulaToken)}` : null

  return (
    <article className="luva-card flex min-h-[258px] flex-col rounded-2xl p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="min-w-0 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{roundLabel ?? `Rodada ${partida.rodada}`}</span>
        <span className="shrink-0"><Badge variant={badge.variant}>{badge.label}</Badge></span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_86px_minmax(0,1fr)] items-start gap-3">
        <TeamBlock equipe={partida.equipeA} align="right" />

        <div className="flex min-w-0 flex-col items-center pt-3 text-center">
          {encerrada ? (
            <>
              <div className="w-full rounded-2xl bg-slate-100 px-2 py-3 font-mono text-xl font-black text-slate-950">
                {partida.setsPorA ?? 0}<span className="px-1 text-luva-amber">x</span>{partida.setsPorB ?? 0}
              </div>
              {partida.sets?.length > 0 && (
                <p className="mt-2 max-w-[86px] text-[10px] font-bold leading-4 text-slate-500">
                  {partida.sets.map((s) => `${s.pontosA}-${s.pontosB}`).join(' / ')}
                </p>
              )}
            </>
          ) : (
            <div className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black uppercase tracking-wide text-slate-950">
              vs
            </div>
          )}
        </div>

        <TeamBlock equipe={partida.equipeB} />
      </div>

      <div className="mt-auto grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-500">
        <p className="flex min-w-0 items-center gap-2">
          <CalendarClock size={14} className="shrink-0 text-luva-amber" />
          <span className="min-w-0 truncate">{dataFmt}</span>
        </p>
        {partida.localNome && (
          <p className="flex min-w-0 items-center gap-2">
            <MapPin size={14} className="shrink-0 text-luva-amber" />
            <span className="min-w-0 truncate">{partida.localNome}</span>
          </p>
        )}
      </div>

      <div className={`mt-3 grid gap-2 ${showSumulaLink ? 'sm:grid-cols-2' : ''}`}>
        <a href={`/partidas/${partida.id}/ao-vivo`} target="_blank" rel="noreferrer" className="match-public-action">
          <Radio size={15} />
          <span>{liveLabel}</span>
          <ExternalLink size={14} />
        </a>
        {showSumulaLink && (
          sumulaHref ? (
            <a href={sumulaHref} target="_blank" rel="noreferrer" className="match-public-action is-sumula">
              <ClipboardList size={15} />
              <span>Súmula digital</span>
              <ExternalLink size={14} />
            </a>
          ) : (
            <span className="match-public-action is-disabled">
              <ClipboardList size={15} />
              <span>Súmula indisponível</span>
            </span>
          )
        )}
      </div>
    </article>
  )
}

function formatMatchDate(value: Date | string | null) {
  if (!value) return 'A definir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'A definir'

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TeamBlock({ equipe, align = 'left' }: { equipe: Equipe; align?: 'left' | 'right' }) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
      <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <TeamIdentity nome={equipe.nome} cor={equipe.corHex} compact showName={false} />
      </div>
      <p className="mt-3 min-h-[42px] overflow-hidden text-sm font-black leading-[1.35] text-slate-950 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
        {equipe.nome}
      </p>
    </div>
  )
}
