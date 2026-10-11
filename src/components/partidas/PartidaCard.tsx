'use client'

import { CalendarClock, ClipboardList, ExternalLink, MapPin, Radio } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { BotaoStoriesInstagram } from '@/components/stories/BotaoStoriesInstagram'
import mi from '@/styles/microinteracoes.module.css'
import { agendaDaPartida } from '@/lib/format-partida'
import { cartazJogo } from '@/lib/stories-cartaz'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'

type Set = { numero: number; pontosA: number; pontosB: number }
type Equipe = { id: number; nome: string; corHex: string | null; logoUrl?: string | null; vaga?: boolean }
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
export function PartidaCard({ partida, roundLabel, showSumulaLink = false, atraso = '0ms', compartilhar = false }: { partida: Partida; showSumulaLink?: boolean; roundLabel?: string; atraso?: string; compartilhar?: boolean }) {
  const badge = statusBadge[partida.status] ?? { label: partida.status || 'Status não informado', variant: 'neutral' as const }
  const emAndamento = partida.status === 'EM_ANDAMENTO'
  const encerrada = partida.status === 'ENCERRADA' || partida.status === 'WO'
  const mostraPlacar = emAndamento || encerrada
  const setAtual = emAndamento ? [...(partida.sets ?? [])].sort((a, b) => a.numero - b.numero).at(-1) : null
  const agenda = agendaDaPartida(partida, roundLabel)
  const mostraData = Boolean(agenda.data)
  const mostraLocal = Boolean(agenda.local)
  const liveLabel = encerrada ? 'Resumo da partida' : emAndamento ? 'Acompanhar ao vivo' : 'Link público'
  const sumulaHref = `/sumula/${encodeURIComponent(partida.sumulaToken || String(partida.id))}`
  const publicoHref = `/partidas/${partida.id}/ao-vivo`

  return (
    <article className={`luva-card flex min-h-[258px] flex-col rounded-2xl p-5 ${mi.entrar} ${mi.toque}`} style={{ animationDelay: atraso }}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="min-w-0 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          {partida.liga?.nome && <span className="mb-1 block normal-case tracking-normal text-slate-400">{partida.liga.nome}</span>}
          <span className="normal-case tracking-normal">{agenda.rotulo}</span>
        </span>
        <span className="shrink-0"><Badge variant={badge.variant}>{badge.label}</Badge></span>
      </div>

      <div className="match-board">
        <TeamBlock equipe={partida.equipeA} align="right" />

        <div className="flex min-w-0 flex-col items-center pt-3 text-center">
          {mostraPlacar ? (
            <>
              <div className={`w-full rounded-2xl px-2 py-3 text-xl font-black text-slate-950 ${mi.numero} ${emAndamento ? 'bg-sky-100' : 'bg-slate-100'}`}>
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
        <div className="match-meta mt-auto grid gap-2 rounded-2xl p-4 text-xs font-bold">
          {mostraData && (
            <p className="flex min-w-0 items-center gap-2">
              <CalendarClock size={14} className="shrink-0" />
              <span className="min-w-0 truncate">{agenda.data}</span>
            </p>
          )}
          {mostraLocal && (
            <p className="flex min-w-0 items-center gap-2">
              <MapPin size={14} className="shrink-0" />
              <span className="min-w-0 truncate">{agenda.local}</span>
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
        <div className="flex items-center gap-2">
          <a href={publicoHref} target="_blank" rel="noreferrer" className="match-public-action min-w-0 flex-1">
            <Radio size={15} />
            <span>{liveLabel}</span>
            <ExternalLink size={14} />
          </a>
          {compartilhar && (
            <BotaoStoriesInstagram
              variante="linha"
              titulo={agenda.rotulo}
              versao={`${partida.status}-${partida.setsPorA ?? ''}-${partida.setsPorB ?? ''}-${partida.sets?.length ?? 0}`}
              montar={({ link }) => cartazJogo({
                nomeA: partida.equipeA?.nome || 'A definir',
                nomeB: partida.equipeB?.nome || 'A definir',
                corA: partida.equipeA?.corHex ?? null,
                corB: partida.equipeB?.corHex ?? null,
                logoA: partida.equipeA?.logoUrl ?? null,
                logoB: partida.equipeB?.logoUrl ?? null,
                status: partida.status,
                setsPorA: partida.setsPorA,
                setsPorB: partida.setsPorB,
                parciais: (partida.sets ?? []).map((set) => ({ numero: set.numero, pontosA: set.pontosA, pontosB: set.pontosB })),
                campeonato: partida.liga?.nome ?? null,
                rotulo: agenda.rotulo,
                data: agenda.data,
                local: agenda.local,
              }, link)}
            />
          )}
        </div>
      </div>
    </article>
  )
}

function TeamBlock({ equipe, align = 'left' }: { equipe: Equipe | null; align?: 'left' | 'right' }) {
  if (equipe?.vaga) {
    return (
      <div className={`match-team min-w-0 ${align === 'right' ? 'is-away text-right' : ''}`}>
        <p className="mt-3 min-h-[42px] text-sm font-black leading-[1.35] text-slate-950">{equipe.nome}</p>
      </div>
    )
  }
  const nome = equipe?.nome || 'Equipe'
  return (
    <div className={`match-team min-w-0 ${align === 'right' ? 'is-away text-right' : ''}`}>
      <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        <TeamIdentity nome={nome} cor={equipe?.corHex} compact showName={false} />
      </div>
      <p className="mt-3 min-h-[42px] overflow-hidden text-sm font-black leading-[1.35] text-slate-950 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
        <NomeEquipe nome={nome} />
      </p>
    </div>
  )
}
