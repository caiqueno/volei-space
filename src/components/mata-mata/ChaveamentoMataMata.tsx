'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Radio, Trophy } from 'lucide-react'
import { ActionBar } from '@/components/ui/action-bar'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'
import { abasDaChave, caminhoConector, colunasSimetricas, gradeDaChave, trechosConectores, vencedorDaPartida, type ColunaVisual } from '@/lib/chave-visual'
import { iniciais } from '@/lib/iniciais'
import { agendaDaPartida, formatFaseMataMata } from '@/lib/format-partida'
import mi from '@/styles/microinteracoes.module.css'

export type TeamOption = { id: number; nome: string; corHex: string | null; logoUrl: string | null; vaga?: boolean }

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
    dataHora?: string | null
    localNome?: string | null
  } | null
  eligibleOptions: TeamOption[] | null
  volta?: BracketSlot['partida']
}

export type BracketRoundView = { fase: string; label: string; slots: BracketSlot[] }

type Props = {
  ligaId: number
  rounds: BracketRoundView[]
  champion: TeamOption | null
  thirdPlace?: BracketSlot | null
  organizerMode: boolean
  categoriaCampeonatoId?: string | null
}

const STATUS: Record<string, string> = {
  AGENDADA: 'Agendada',
  EM_ANDAMENTO: 'Ao vivo',
  PENDENTE_APROVACAO: 'Em análise',
  ENCERRADA: 'Encerrada',
  WO: 'W.O.',
}

export function ChaveamentoMataMata({
  ligaId,
  rounds,
  champion,
  thirdPlace,
  organizerMode,
  categoriaCampeonatoId = null,
}: Props) {
  const [aba, setAba] = useState(rounds[rounds.length - 1]?.fase ?? '')
  if (rounds.length === 0) return null

  const colunas = colunasSimetricas(rounds.map((round) => ({
    fase: round.fase,
    label: round.label,
    slots: round.slots.map((slot) => ({ rodada: slot.rodada, avancou: avancou(slot) })),
  })))
  const trechos = trechosConectores(colunas)
  const abas = abasDaChave(rounds)
  const abaAtiva = abas.some((item) => item.id === aba) ? aba : abas[0]?.id

  return (
    <div>
      <div className="lg:hidden">
        <div role="tablist" aria-label="Fases do mata-mata" className="flex snap-x gap-2 overflow-x-auto pb-3">
          {abas.map((item) => (
            <button
              key={item.id}
              id={`aba-chave-${item.id}`}
              type="button"
              role="tab"
              aria-selected={abaAtiva === item.id}
              aria-controls={`painel-chave-${item.id}`}
              onClick={() => setAba(item.id)}
              className={`snap-start rounded-full px-4 py-2 font-display text-sm font-bold uppercase tracking-[0.12em] ${abaAtiva === item.id ? 'bg-vs-gold text-vs-on-gold' : 'border border-vs-border bg-vs-elevated text-vs-text'}`}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
        {rounds.filter((round) => round.fase === abaAtiva).map((round) => (
          <div key={round.fase} id={`painel-chave-${round.fase}`} role="tabpanel" aria-labelledby={`aba-chave-${round.fase}`} className="grid gap-4">
            {round.fase === 'FINAL' && <Trofeu champion={champion} />}
            <ul className="grid gap-4">
              {round.slots.map((slot) => (
                <li key={`${round.fase}-${slot.rodada}`}>
                  <CartaoJogo slot={slot} roundLabel={round.label} multiSlot={round.slots.length > 1} ligaId={ligaId} organizerMode={organizerMode} categoriaCampeonatoId={categoriaCampeonatoId} destaque={round.fase === 'FINAL'} />
                </li>
              ))}
            </ul>
            {round.fase === 'FINAL' && thirdPlace && (
              <CartaoJogo slot={thirdPlace} roundLabel={formatFaseMataMata(thirdPlace.fase) ?? '3º lugar'} multiSlot={false} ligaId={ligaId} organizerMode={organizerMode} categoriaCampeonatoId={categoriaCampeonatoId} compacto />
            )}
          </div>
        ))}
      </div>

      <div className="hidden lg:grid lg:gap-4" style={{ gridTemplateColumns: gradeDaChave(colunas.length) }}>
        <div style={{ gridColumn: colunaCentral(colunas), gridRow: 1 }}>
          <Trofeu champion={champion} />
        </div>
        <div className="relative" style={{ gridColumn: '1 / -1', gridRow: 2 }}>
          <div className="grid items-stretch" style={{ gridTemplateColumns: gradeDaChave(colunas.length) }}>
            {colunas.map((coluna, indice) => (
              <div key={coluna.id} className="min-w-0" style={{ gridColumn: indice * 2 + 1 }}>
                <ColunaJogos coluna={coluna} rounds={rounds} ligaId={ligaId} organizerMode={organizerMode} categoriaCampeonatoId={categoriaCampeonatoId} />
              </div>
            ))}
          </div>
          {trechos.length > 0 && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {trechos.map((trecho, indice) => (
                <path key={indice} d={caminhoConector(trecho)} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" className={trecho.ouro ? 'text-vs-gold' : 'text-vs-border'} />
              ))}
            </svg>
          )}
        </div>
        {thirdPlace && (
          <div className="origin-top scale-95" style={{ gridColumn: colunaCentral(colunas), gridRow: 3 }}>
            <CartaoJogo slot={thirdPlace} roundLabel={formatFaseMataMata(thirdPlace.fase) ?? '3º lugar'} multiSlot={false} ligaId={ligaId} organizerMode={organizerMode} categoriaCampeonatoId={categoriaCampeonatoId} compacto />
          </div>
        )}
      </div>
    </div>
  )
}

function colunaCentral(colunas: ColunaVisual[]) {
  const indice = Math.max(0, colunas.findIndex((coluna) => coluna.lado === 'centro'))
  return indice * 2 + 1
}

function ColunaJogos({
  coluna,
  rounds,
  ligaId,
  organizerMode,
  categoriaCampeonatoId,
}: {
  coluna: ColunaVisual
  rounds: BracketRoundView[]
  ligaId: number
  organizerMode: boolean
  categoriaCampeonatoId: string | null
}) {
  const round = rounds.find((item) => item.fase === coluna.fase)
  const jogos = round ? coluna.jogos.map((jogo) => round.slots.find((slot) => slot.rodada === jogo.rodada)).filter((slot): slot is BracketSlot => Boolean(slot)) : []
  return (
    <ul className="grid h-full min-w-0" style={{ gridTemplateRows: `repeat(${Math.max(jogos.length, 1)}, minmax(0, 1fr))` }}>
      {jogos.map((slot) => (
        <li key={slot.rodada} className="flex min-w-0 items-center">
          <div className="w-full min-w-0">
            <CartaoJogo slot={slot} roundLabel={round?.label ?? coluna.rotulo} multiSlot={(round?.slots.length ?? 0) > 1} ligaId={ligaId} organizerMode={organizerMode} categoriaCampeonatoId={categoriaCampeonatoId} destaque={coluna.lado === 'centro'} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Trofeu({ champion }: { champion: TeamOption | null }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Trophy size={64} strokeWidth={1.75} className="text-vs-gold" aria-hidden="true" />
      <p className="luva-kicker mt-2 font-display text-sm font-bold tracking-[0.12em]">Final</p>
      {champion ? (
        <b className="mt-1 font-display text-2xl font-bold text-vs-gold"><NomeEquipe nome={champion.nome} /></b>
      ) : (
        <p className="mt-1 text-sm font-semibold text-vs-muted">Definido após a final</p>
      )}
    </div>
  )
}

function avancou(slot: BracketSlot) {
  return vencedorDaPartida(slot.partida) != null
}

function CartaoJogo({
  slot,
  roundLabel,
  multiSlot,
  ligaId,
  organizerMode,
  categoriaCampeonatoId,
  destaque = false,
  compacto = false,
}: {
  slot: BracketSlot
  roundLabel: string
  multiSlot: boolean
  ligaId: number
  organizerMode: boolean
  categoriaCampeonatoId: string | null
  destaque?: boolean
  compacto?: boolean
}) {
  const tag = multiSlot ? `${roundLabel} · Jogo ${slot.rodada}` : roundLabel
  if (slot.partida) {
    return <CartaoPartida partida={slot.partida} tag={tag} volta={slot.volta} organizerMode={organizerMode} destaque={destaque} compacto={compacto} />
  }
  if (organizerMode && slot.eligibleOptions) {
    return <CriarConfrontoCard slot={slot} tag={tag} ligaId={ligaId} categoriaCampeonatoId={categoriaCampeonatoId} options={slot.eligibleOptions} destaque={destaque} />
  }
  return (
    <article aria-label={`${tag}, a definir`} className={`flex min-h-20 flex-col justify-center rounded-xl border border-dashed border-vs-border bg-vs-surface px-3 py-2 ${mi.chave}`}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-vs-muted">{tag}</p>
      <p className="mt-1 text-sm italic text-vs-muted">A definir —</p>
    </article>
  )
}

function CartaoPartida({
  partida,
  tag,
  volta,
  organizerMode,
  destaque,
  compacto,
}: {
  partida: NonNullable<BracketSlot['partida']>
  tag: string
  volta?: BracketSlot['partida']
  organizerMode: boolean
  destaque: boolean
  compacto: boolean
}) {
  const agenda = agendaDaPartida(partida, tag)
  const encerrada = partida.status === 'ENCERRADA' || partida.status === 'WO'
  const vencedorId = vencedorDaPartida(partida)
  const rotulo = `${tag}, ${partida.equipeA.nome} contra ${partida.equipeB.nome}`
  const parciais = [...partida.sets].sort((a, b) => a.numero - b.numero)

  return (
    <article aria-label={rotulo} className={`min-h-20 min-w-0 rounded-xl border bg-vs-surface px-3 py-2 ${mi.chave} ${destaque ? 'border-vs-gold' : 'border-vs-border'} ${compacto ? 'text-sm' : ''}`}>
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-vs-muted">{tag}</p>
          {(agenda.data || agenda.local) && (
            <p className={`mt-0.5 text-xs font-semibold ${partida.status === 'AGENDADA' ? 'text-vs-blue' : 'text-vs-muted'}`}>
              {[agenda.data, agenda.local].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <StatusPartida status={partida.status} />
      </header>
      <ul>
        <LinhaTime equipe={partida.equipeA} sets={partida.setsPorA} venceu={vencedorId === partida.equipeA.id && !partida.equipeA.vaga} encerrada={encerrada} />
        <LinhaTime equipe={partida.equipeB} sets={partida.setsPorB} venceu={vencedorId === partida.equipeB.id && !partida.equipeB.vaga} encerrada={encerrada} />
      </ul>
      {parciais.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-1">
          {parciais.map((set) => (
            <span key={set.numero} className="rounded-md bg-vs-elevated px-1.5 py-0.5 text-xs font-semibold tabular-nums text-vs-muted">{set.pontosA}-{set.pontosB}</span>
          ))}
        </p>
      )}
      {volta && (
        <p className="mt-2 text-xs font-semibold text-vs-muted">Volta: {volta.setsPorA ?? 0}–{volta.setsPorB ?? 0}</p>
      )}
      <a href={`/partidas/${partida.id}/ao-vivo`} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 rounded-full border border-vs-border py-2 text-xs font-bold text-vs-text transition-colors duration-vs-tap ease-vs-out hover:border-vs-gold">
        <Radio size={12} aria-hidden="true" /> Resumo da partida
      </a>
      {organizerMode && partida.sumulaToken && (
        <a href={`/sumula/${encodeURIComponent(partida.sumulaToken)}`} target="_blank" rel="noreferrer" className="mt-2 block text-center text-xs font-bold text-vs-muted underline">Abrir súmula</a>
      )}
    </article>
  )
}

function StatusPartida({ status }: { status: string }) {
  if (status === 'EM_ANDAMENTO') {
    return (
      <b className="inline-flex items-center gap-1 font-display text-xs font-bold tracking-[0.12em] text-vs-live">
        <span className="h-2 w-2 rounded-full bg-vs-live motion-safe:animate-pulse" aria-hidden="true" />
        AO VIVO
      </b>
    )
  }
  return <span className="rounded-full border border-vs-border px-2 py-0.5 text-xs font-bold text-vs-muted">{STATUS[status] ?? status}</span>
}

function LinhaTime({ equipe, sets, venceu, encerrada }: { equipe: TeamOption; sets: number | null; venceu: boolean; encerrada: boolean }) {
  const definir = equipe.vaga || equipe.id <= 0
  return (
    <li className={`flex min-h-8 items-center gap-2 border-l-4 py-1 pl-2 ${venceu ? 'border-vs-gold' : 'border-transparent'} ${encerrada && !venceu && !definir ? 'opacity-60' : ''}`}>
      <Escudo nome={equipe.nome} cor={equipe.corHex} logoUrl={equipe.logoUrl} />
      <span className={`min-w-0 flex-1 whitespace-normal break-words text-sm leading-5 text-vs-text ${venceu ? 'font-bold' : 'font-semibold'} ${definir ? 'italic text-vs-muted' : ''}`}>
        <NomeEquipe nome={definir ? 'A definir' : equipe.nome} />
      </span>
      {venceu && <Check size={14} className="shrink-0 text-vs-gold" aria-label="Vencedor" />}
      <b className={`w-6 text-right font-display text-xl font-bold tabular-nums ${venceu ? 'text-vs-gold' : 'text-vs-muted'}`}>{definir ? '—' : sets ?? '—'}</b>
    </li>
  )
}

function Escudo({ nome, cor, logoUrl }: { nome: string; cor: string | null; logoUrl: string | null }) {
  const sigla = iniciais(nome)
  if (logoUrl) {
    return <img src={logoUrl} alt="" className="h-6 w-6 shrink-0 object-contain" />
  }
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-vs-text" style={{ background: cor ?? '#16243D' }}>
      {sigla || '–'}
    </span>
  )
}

function CriarConfrontoCard({ slot, tag, ligaId, categoriaCampeonatoId, options, destaque }: { slot: BracketSlot; tag: string; ligaId: number; categoriaCampeonatoId: string | null; options: TeamOption[]; destaque: boolean }) {
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
        body: JSON.stringify({ fase: slot.fase, rodada: slot.rodada, equipeAId: Number(equipeAId), equipeBId: Number(equipeBId), categoriaCampeonatoId }),
      })
      const payload = await response.json().catch(() => ({} as { error?: string }))
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
    } finally {
      setSubmitting(false)
    }
  }

  if (options.length === 0) {
    return (
      <article aria-label={`${tag}, sem times`} className="flex min-h-20 flex-col justify-center rounded-xl border border-dashed border-vs-border bg-vs-surface px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-vs-muted">{tag}</p>
        <p className="mt-1 text-sm text-vs-muted">Sem times disponíveis</p>
      </article>
    )
  }

  return (
    <article aria-label={`${tag}, criar confronto`} className={`min-h-20 rounded-xl border bg-vs-surface px-3 py-2 ${destaque ? 'border-vs-gold' : 'border-vs-border'}`}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-vs-muted">{tag}</p>
      <div className="mt-2 grid gap-2">
        <label htmlFor={`time-a-${slot.fase}-${slot.rodada}`} className="text-xs font-bold text-vs-muted">Time A</label>
        <select id={`time-a-${slot.fase}-${slot.rodada}`} aria-label="Time A" value={equipeAId} onChange={(event) => setEquipeAId(event.target.value)} className="w-full rounded-lg border border-vs-border bg-vs-elevated px-3 py-2 text-sm font-semibold text-vs-text">
          <option value="">Time A</option>
          {options.map((team) => <option key={team.id} value={team.id} disabled={String(team.id) === equipeBId}>{normalizarNomeEquipe(team.nome)}</option>)}
        </select>
        <label htmlFor={`time-b-${slot.fase}-${slot.rodada}`} className="text-xs font-bold text-vs-muted">Time B</label>
        <select id={`time-b-${slot.fase}-${slot.rodada}`} aria-label="Time B" value={equipeBId} onChange={(event) => setEquipeBId(event.target.value)} className="w-full rounded-lg border border-vs-border bg-vs-elevated px-3 py-2 text-sm font-semibold text-vs-text">
          <option value="">Time B</option>
          {options.map((team) => <option key={team.id} value={team.id} disabled={String(team.id) === equipeAId}>{normalizarNomeEquipe(team.nome)}</option>)}
        </select>
        <ActionBar type="button" onClick={criarConfronto} loading={submitting} loadingLabel="Criando" disabled={!equipeAId || !equipeBId} className="rounded-full bg-vs-gold px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-vs-on-gold disabled:opacity-60">
          Criar confronto
        </ActionBar>
        {sessionExpired ? (
          <p className="text-xs font-bold text-vs-loss">Sua sessão expirou. <a href="/login" className="underline">Faça login novamente</a>.</p>
        ) : (
          message && <p className="text-xs font-bold text-vs-loss">{message}</p>
        )}
      </div>
    </article>
  )
}
