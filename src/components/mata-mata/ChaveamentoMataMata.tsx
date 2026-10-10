'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Radio, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ActionBar } from '@/components/ui/action-bar'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import mi from '@/styles/microinteracoes.module.css'

export type TeamOption = { id: number; nome: string; corHex: string | null; logoUrl: string | null }

type SetScore = { numero: number; pontosA: number; pontosB: number }

export type BracketSlot = {
  fase: string
  rodada: number
  partida: {
    id: number
    status: string
    equipeA: TeamOption
    equipeB: TeamOption
    setsPorA: number | null
    setsPorB: number | null
    sets: SetScore[]
    sumulaToken: string | null
  } | null
  eligibleOptions: TeamOption[] | null
}

export type BracketRoundView = { fase: string; label: string; slots: BracketSlot[] }

type Node = { round: BracketRoundView; slot: BracketSlot; children: Node[] }

const statusBadge: Record<string, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'error' }> = {
  AGENDADA: { label: 'Agendada', variant: 'neutral' },
  EM_ANDAMENTO: { label: 'Ao vivo', variant: 'info' },
  PENDENTE_APROVACAO: { label: 'Em análise', variant: 'warning' },
  ENCERRADA: { label: 'Encerrada', variant: 'success' },
  WO: { label: 'W.O.', variant: 'error' },
}

export function ChaveamentoMataMata({
  ligaId,
  rounds,
  champion,
  thirdPlace,
  organizerMode,
}: {
  ligaId: number
  rounds: BracketRoundView[]
  champion: TeamOption | null
  thirdPlace?: BracketSlot | null
  organizerMode: boolean
}) {
  if (rounds.length === 0) return null

  function buildNode(roundIndex: number, slotNumber: number): Node {
    const round = rounds[roundIndex]
    const slot = round.slots[slotNumber - 1]
    if (roundIndex === 0) return { round, slot, children: [] }
    return {
      round,
      slot,
      children: [buildNode(roundIndex - 1, slotNumber * 2 - 1), buildNode(roundIndex - 1, slotNumber * 2)],
    }
  }

  const root = buildNode(rounds.length - 1, 1)
  // O 3º lugar só entra encaixado entre os dois cards da semifinal quando a raiz da árvore
  // (a final) tem exatamente essas duas semifinais como filhas — que é sempre o caso quando
  // getMataMataBracket calculou um thirdPlace (só calcula quando existe rodada de SEMIFINAL).
  const showThirdPlaceInline = Boolean(thirdPlace) && root.children.length === 2

  return (
    <div className="overflow-x-auto pb-4">
      <div className="mx-auto flex min-w-max flex-col items-center">
        {showThirdPlaceInline ? (
          <>
            <div className="relative flex items-end gap-8">
              <BracketNode node={root.children[0]} ligaId={ligaId} organizerMode={organizerMode} nivel={1} />
              <SlotCard slot={thirdPlace!} roundLabel="Disputa de 3º lugar" multiSlot={false} ligaId={ligaId} organizerMode={organizerMode} nivel={1} />
              <BracketNode node={root.children[1]} ligaId={ligaId} organizerMode={organizerMode} nivel={1} />
              {/* Conector especial: com o card do 3º lugar ocupando a vaga central da linha,
                  os dois cards da semifinal ficam a 1/6.5 e 5,5/6.5 da largura total (256px de
                  card + 32px de gap, repetidos 3x) — não mais em 25%/75% como nas linhas normais. */}
              <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-full h-7 w-full">
                <path d="M15.385,0 V14 H84.615 V0" fill="none" stroke="#CBD5E1" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                <path d="M50,14 V28" fill="none" stroke="#CBD5E1" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="h-7" />
            <SlotCard slot={root.slot} roundLabel={root.round.label} multiSlot={root.round.slots.length > 1} ligaId={ligaId} organizerMode={organizerMode} highlight={root.round.fase === 'FINAL'} nivel={0} />
          </>
        ) : (
          <BracketNode node={root} ligaId={ligaId} organizerMode={organizerMode} />
        )}
        <StraightConnector />
        <div className={`border-beam flex w-56 flex-col items-center gap-2 rounded-2xl bg-luva-navy p-5 text-center shadow-[0_0_28px_rgba(239,159,39,0.4)] ${mi.campeao} ${mi.entrar}`} style={{ animationDelay: '180ms' }}>
          <Trophy size={26} className={`text-luva-amber ${mi.pop}`} />
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Campeão</p>
          {champion ? (
            <p className="font-display text-lg font-black text-white">{champion.nome}</p>
          ) : (
            <p className="text-sm font-bold text-slate-300">Definido após a final</p>
          )}
        </div>
      </div>
    </div>
  )
}

function BracketNode({ node, ligaId, organizerMode, nivel = 0 }: { node: Node; ligaId: number; organizerMode: boolean; nivel?: number }) {
  const hasChildren = node.children.length > 0
  return (
    <div className="flex flex-col items-center">
      {hasChildren && (
        <div className="relative flex items-start gap-8">
          {node.children.map((child, index) => (
            <BracketNode key={index} node={child} ligaId={ligaId} organizerMode={organizerMode} nivel={nivel + 1} />
          ))}
          {/* Spans the exact rendered width of the row above via absolute positioning, so the
              25%/75% marks land on each child's center regardless of subtree width. */}
          <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-full h-7 w-full">
            <path d="M25,0 V14 H75 V0" fill="none" stroke="#CBD5E1" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <path d="M50,14 V28" fill="none" stroke="#CBD5E1" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      )}
      {hasChildren && <div className="h-7" />}
      <SlotCard slot={node.slot} roundLabel={node.round.label} multiSlot={node.round.slots.length > 1} ligaId={ligaId} organizerMode={organizerMode} highlight={node.round.fase === 'FINAL'} nivel={nivel} />
    </div>
  )
}

function StraightConnector() {
  return <div className="h-7 w-0.5 bg-slate-300" />
}

function SlotCard({
  slot,
  roundLabel,
  multiSlot,
  ligaId,
  organizerMode,
  highlight = false,
  nivel = 0,
}: {
  slot: BracketSlot
  roundLabel: string
  multiSlot: boolean
  ligaId: number
  organizerMode: boolean
  highlight?: boolean
  nivel?: number
}) {
  const tag = multiSlot ? `${roundLabel} · Jogo ${slot.rodada}` : roundLabel
  const revelacao = { animationDelay: `${Math.max(0, 3 - nivel) * 50}ms` }

  if (slot.partida) {
    const { partida } = slot
    const badge = statusBadge[partida.status] ?? { label: partida.status, variant: 'neutral' as const }
    const encerrada = partida.status === 'ENCERRADA' || partida.status === 'WO'
    const winnerId = encerrada ? (Number(partida.setsPorA ?? 0) > Number(partida.setsPorB ?? 0) ? partida.equipeA.id : Number(partida.setsPorB ?? 0) > Number(partida.setsPorA ?? 0) ? partida.equipeB.id : null) : null

    return (
      <div className={`w-64 rounded-2xl bg-white p-4 ${mi.chave} ${mi.cartao} ${highlight ? `border-beam shadow-[0_0_22px_rgba(239,159,39,0.35)] ${mi.campeao}` : 'border border-slate-200 shadow-[0_16px_40px_rgba(15,23,42,0.08)]'}`} style={revelacao}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{tag}</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <TeamRow team={partida.equipeA} score={partida.setsPorA} isWinner={winnerId === partida.equipeA.id} />
        <TeamRow team={partida.equipeB} score={partida.setsPorB} isWinner={winnerId === partida.equipeB.id} />
        {partida.sets.length > 0 && (
          <p className={`mt-2 border-t border-slate-100 pt-2 text-[11px] font-bold text-slate-400 ${mi.numero}`}>
            {partida.sets.map((s) => `${s.pontosA}-${s.pontosB}`).join(' · ')}
          </p>
        )}
        <a href={`/sumula/${encodeURIComponent(partida.sumulaToken || String(partida.id))}`} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 rounded-full border border-slate-200 py-2 text-xs font-black text-slate-600 transition hover:border-luva-amber hover:text-luva-navy">
          Abrir súmula <ExternalLink size={12} />
        </a>
        <a href={`/partidas/${partida.id}/ao-vivo`} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-1.5 rounded-full border border-slate-200 py-2 text-xs font-black text-slate-600 transition hover:border-luva-amber hover:text-luva-navy">
          <Radio size={12} /> Link público
        </a>
        <a href={`/partidas/${partida.id}/ao-vivo`} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-1.5 rounded-full border border-slate-200 py-2 text-xs font-black text-slate-600 transition hover:border-luva-amber hover:text-luva-navy">
          {encerrada ? 'Resumo da partida' : partida.status === 'EM_ANDAMENTO' ? 'Acompanhar ao vivo' : 'Resumo da partida'}
        </a>
      </div>
    )
  }

  if (organizerMode && slot.eligibleOptions) {
    return <CriarConfrontoCard slot={slot} tag={tag} ligaId={ligaId} options={slot.eligibleOptions} highlight={highlight} revelacao={revelacao} />
  }

  return (
    <div className={`flex w-64 flex-col items-center justify-center gap-1 rounded-2xl bg-slate-50 p-4 text-center ${mi.chave} ${highlight ? `border-beam shadow-[0_0_22px_rgba(239,159,39,0.35)] ${mi.campeao}` : 'border border-dashed border-slate-300'}`} style={revelacao}>
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{tag}</span>
      <span className="text-sm font-bold text-slate-400">A definir</span>
    </div>
  )
}

function TeamRow({ team, score, isWinner }: { team: TeamOption; score: number | null; isWinner: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1.5 ${isWinner ? mi.lider : 'opacity-70'}`}>
      <TeamIdentity nome={team.nome} cor={team.corHex} logoUrl={team.logoUrl} compact />
      {score != null && <span className={`text-sm font-black ${mi.numero} ${isWinner ? 'text-emerald-600' : 'text-slate-400'}`}>{score}</span>}
    </div>
  )
}

function CriarConfrontoCard({ slot, tag, ligaId, options, highlight = false, revelacao }: { slot: BracketSlot; tag: string; ligaId: number; options: TeamOption[]; highlight?: boolean; revelacao?: { animationDelay: string } }) {
  const router = useRouter()
  const [equipeAId, setEquipeAId] = useState('')
  const [equipeBId, setEquipeBId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  async function criarConfronto() {
    if (!equipeAId || !equipeBId || equipeAId === equipeBId) {
      setMessage('Selecione dois times diferentes.')
      return
    }
    setSubmitting(true)
    setMessage('')
    setSessionExpired(false)
    try {
      const response = await fetch(`/api/organizador/ligas/${ligaId}/mata-mata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: slot.fase, rodada: slot.rodada, equipeAId: Number(equipeAId), equipeBId: Number(equipeBId) }),
      })
      const payload = await response.json()
      if (!response.ok) {
        if (response.status === 401) {
          setSessionExpired(true)
          throw new Error('Sua sessão expirou.')
        }
        throw new Error(payload.error ?? 'Não foi possível criar o confronto.')
      }
      router.refresh()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível criar o confronto.')
      setSubmitting(false)
    }
  }

  if (options.length === 0) {
    return (
      <div className={`flex w-64 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center ${mi.chave}`} style={revelacao}>
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{tag}</span>
        <span className="text-sm font-bold text-slate-400">Sem times disponíveis</span>
      </div>
    )
  }

  return (
    <div className={`w-64 rounded-2xl bg-amber-50/40 p-4 ${mi.chave} ${highlight ? `border-beam shadow-[0_0_22px_rgba(239,159,39,0.35)] ${mi.campeao}` : 'border border-luva-amber/40'}`} style={revelacao}>
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{tag}</span>
      <div className="mt-2 grid gap-2">
        <select value={equipeAId} onChange={(event) => setEquipeAId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900">
          <option value="">Time A</option>
          {options.map((team) => <option key={team.id} value={team.id} disabled={String(team.id) === equipeBId}>{team.nome}</option>)}
        </select>
        <select value={equipeBId} onChange={(event) => setEquipeBId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900">
          <option value="">Time B</option>
          {options.map((team) => <option key={team.id} value={team.id} disabled={String(team.id) === equipeAId}>{team.nome}</option>)}
        </select>
        <ActionBar
          type="button"
          onClick={criarConfronto}
          loading={submitting}
          loadingLabel="Criando"
          disabled={!equipeAId || !equipeBId}
          className="rounded-full bg-[#ffb331] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Criar confronto
        </ActionBar>
        {sessionExpired ? (
          <p className="text-xs font-bold text-red-500">
            Sua sessão expirou. <a href="/login" className="underline hover:text-red-600">Faça login novamente</a> e repita a criação do confronto.
          </p>
        ) : (
          message && <p className="text-xs font-bold text-red-500">{message}</p>
        )}
      </div>
    </div>
  )
}
