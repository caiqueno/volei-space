import { CalendarClock, ClipboardList, ExternalLink, MapPin, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { rotuloConfronto, textoLocalAusente } from '@/lib/format-partida'

type Set = { numero: number; pontosA: number; pontosB: number }
type Equipe = { id: number; nome: string; corHex: string | null }
type Partida = {
  id: number
  rodada: number
  status: string
  dataHora: Date | string | null
  localNome: string | null
  equipeA: Equipe | null
  equipeB: Equipe | null
  setsPorA: number | null
  setsPorB: number | null
  sets: Set[]
  sumulaToken?: string | null
  fase?: string | null
  liga?: { id?: number; nome?: string | null } | null
}

const statusBadge: Record<string, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'error' }> = {
  AGENDADA: { label: 'Agendada', variant: 'neutral' },
  EM_ANDAMENTO: { label: 'Em andamento', variant: 'info' },
  CANCELADA: { label: 'Cancelada', variant: 'neutral' },
  PENDENTE_APROVACAO: { label: 'Em análise', variant: 'warning' },
  ENCERRADA: { label: 'Encerrada', variant: 'success' },
  WO: { label: 'W.O.', variant: 'error' },
}

// A súmula completa pede sessão de organizador ou de árbitro do jogo.
// Na vitrine pública fica só o acompanhamento, que abre sem login.
export function PartidaCard({ partida, roundLabel, showSumulaLink = false }: { partida: Partida; showSumulaLink?: boolean; roundLabel?: string }) {
  const badge = statusBadge[partida.status] ?? { label: partida.status || 'Status não informado', variant: 'neutral' as const }
  const emAndamento = partida.status === 'EM_ANDAMENTO'
  const encerrada = partida.status === 'ENCERRADA' || partida.status === 'WO'
  const mostraPlacar = emAndamento || encerrada
  const setAtual = emAndamento ? [...(partida.sets ?? [])].sort((a, b) => a.numero - b.numero).at(-1) : null
  const dataAusente = !partida.dataHora || Number.isNaN(new Date(partida.dataHora).getTime())
  const localAusente = textoLocalAusente(partida.localNome)
  const mostraData = !(encerrada && dataAusente)
  const mostraLocal = Boolean(partida.localNome) && !(encerrada && localAusente)
  const dataFmt = formatMatchDate(partida.dataHora)
  const liveLabel = encerrada ? 'Resumo da partida' : emAndamento ? 'Acompanhar ao vivo' : 'Link público'
  const sumulaHref = `/sumula/${encodeURIComponent(partida.sumulaToken || String(partida.id))}`
  const publicoHref = `/partidas/${partida.id}/ao-vivo`

  return (
    <article className="luva-card flex min-h-[258px] flex-col rounded-2xl p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="min-w-0 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          {partida.liga?.nome && <span className="mb-1 block normal-case tracking-normal text-slate-400">{partida.liga.nome}</span>}
          <span className="normal-case tracking-normal">{rotuloConfronto(partida, roundLabel)}</span>
        </span>
        <span className="shrink-0"><Badge variant={badge.variant}>{badge.label}</Badge></span>
      </div>

      <div className="match-board">
        <TeamBlock equipe={partida.equipeA} align="right" />

        <div className="flex min-w-0 flex-col items-center pt-3 text-center">
          {mostraPlacar ? (
            <>
              <div className={`w-full rounded-2xl px-2 py-3 font-mono text-xl font-black text-slate-950 ${emAndamento ? 'bg-sky-100' : 'bg-slate-100'}`}>
                {partida.setsPorA ?? 0}<span className="px-1 text-luva-amber">x</span>{partida.setsPorB ?? 0}
              </div>
              {setAtual && (
                <p className="mt-2 max-w-[86px] text-[10px] font-bold leading-4 text-slate-500">
                  Set {setAtual.numero}: {setAtual.pontosA}-{setAtual.pontosB}
                </p>
              )}
              {encerrada && partida.sets?.length > 0 && (
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

      {(mostraData || mostraLocal) && (
        <div className="mt-auto grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-500">
          {mostraData && (
            <p className="flex min-w-0 items-center gap-2">
              <CalendarClock size={14} className="shrink-0 text-luva-amber" />
              <span className="min-w-0 truncate">{dataFmt}</span>
            </p>
          )}
          {mostraLocal && (
            <p className="flex min-w-0 items-center gap-2">
              <MapPin size={14} className="shrink-0 text-luva-amber" />
              <span className="min-w-0 truncate">{partida.localNome}</span>
            </p>
          )}
        </div>
      )}

      <div className={`${mostraData || mostraLocal ? 'mt-3' : 'mt-auto'} grid gap-2`}>
        {showSumulaLink && (
          <a href={sumulaHref} target="_blank" rel="noreferrer" className="match-public-action is-sumula">
            <ClipboardList size={15} />
            <span>Súmula digital</span>
            <ExternalLink size={14} />
          </a>
        )}
        <a href={publicoHref} target="_blank" rel="noreferrer" className="match-public-action">
          <Radio size={15} />
          <span>{liveLabel}</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </article>
  )
}

function formatMatchDate(value: Date | string | null) {
  if (!value) return 'A definir'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'A definir'

  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TeamBlock({ equipe, align = 'left' }: { equipe: Equipe | null; align?: 'left' | 'right' }) {
  const nome = equipe?.nome || 'Equipe'
  return (
    <div className={`match-team min-w-0 ${align === 'right' ? 'is-away text-right' : ''}`}>
      <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <TeamIdentity nome={nome} cor={equipe?.corHex} compact showName={false} />
      </div>
      <p className="mt-3 min-h-[42px] overflow-hidden text-sm font-black leading-[1.35] text-slate-950 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
        {nome}
      </p>
    </div>
  )
}
