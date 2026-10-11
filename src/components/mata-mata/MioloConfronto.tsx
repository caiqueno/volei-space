'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Radio } from 'lucide-react'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { iniciais } from '@/lib/iniciais'
import type { LadoCartaz } from '@/lib/stories-cartaz'
import estilos from '@/components/stories/cartaz.module.css'
import mi from '@/styles/microinteracoes.module.css'

type Parcial = { numero: number; pontosA: number; pontosB: number }

type Props = {
  tom?: 'site' | 'story'
  tag: string
  status: string
  agenda?: string
  ladoA: LadoCartaz & { id?: number }
  ladoB: LadoCartaz & { id?: number }
  setsPorA: number | null
  setsPorB: number | null
  parciais: Parcial[]
  vencedor: 'A' | 'B' | null
  volta?: string | null
  ouro?: boolean
  agendada?: boolean
}

const STATUS: Record<string, string> = {
  AGENDADA: 'Agendada',
  EM_ANDAMENTO: 'Ao vivo',
  PENDENTE_APROVACAO: 'Em análise',
  ENCERRADA: 'Encerrada',
  WO: 'W.O.',
}

export function MioloConfronto({ tom = 'site', tag, status, agenda, ladoA, ladoB, setsPorA, setsPorB, parciais, vencedor, volta, ouro = false, agendada = false }: Props) {
  if (tom === 'story') {
    return (
      <article className={`${estilos.cartao} ${estilos.cartaoChave} ${ouro ? estilos.ouro : ''}`}>
        <header className={estilos.topoChave}>
          <p className={estilos.rotulo}>{tag}</p>
          <StatusStory status={status} />
        </header>
        <LinhaStory lado={ladoA} sets={setsPorA} venceu={vencedor === 'A'} />
        <LinhaStory lado={ladoB} sets={setsPorB} venceu={vencedor === 'B'} />
        {parciais.length > 0 && (
          <p className={estilos.parciaisChave}>
            {parciais.map((set) => (
              <span key={set.numero}>{set.pontosA}-{set.pontosB}</span>
            ))}
          </p>
        )}
        {volta && <p className={estilos.rotulo}>{volta}</p>}
      </article>
    )
  }

  const encerrada = status === 'ENCERRADA' || status === 'WO'
  return (
    <>
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-vs-muted">{tag}</p>
          {agenda && (
            <p className={`mt-0.5 text-xs font-semibold ${agendada ? 'text-vs-blue' : 'text-vs-muted'}`}>{agenda}</p>
          )}
        </div>
        <StatusPartida status={status} />
      </header>
      <ul>
        <LinhaTime lado={ladoA} sets={setsPorA} venceu={vencedor === 'A'} encerrada={encerrada} />
        <LinhaTime lado={ladoB} sets={setsPorB} venceu={vencedor === 'B'} encerrada={encerrada} />
      </ul>
      {parciais.length > 0 && (
        <p className="mt-2 flex flex-wrap gap-1">
          {parciais.map((set) => (
            <span key={set.numero} className="rounded-md bg-vs-elevated px-1.5 py-0.5 text-xs font-semibold tabular-nums text-vs-muted">{set.pontosA}-{set.pontosB}</span>
          ))}
        </p>
      )}
      {volta && <p className="mt-2 text-xs font-semibold text-vs-muted">{volta}</p>}
    </>
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

function StatusStory({ status }: { status: string }) {
  if (status === 'EM_ANDAMENTO') {
    return (
      <b className={estilos.aoVivo}>
        <Radio size={28} aria-hidden="true" />
        AO VIVO
      </b>
    )
  }
  if (!status) return null
  return <span className={estilos.rotulo}>{STATUS[status] ?? status}</span>
}

function LinhaTime({ lado, sets, venceu, encerrada }: { lado: LadoCartaz; sets: number | null; venceu: boolean; encerrada: boolean }) {
  const brilho = useTrocaDeTime(lado.definir ? 0 : lado.id ?? 0)
  return (
    <li data-provisorio={lado.provisorio ? 'true' : undefined} data-origem={lado.origem ?? undefined} className={`${mi.lado} flex min-h-8 items-center gap-2 rounded-md border-l-4 py-1 pl-2 ${venceu ? 'border-vs-gold' : 'border-transparent'} ${encerrada && !venceu && !lado.definir ? 'opacity-60' : ''} ${brilho ? mi.troca : ''}`}>
      <Escudo nome={lado.nome} cor={lado.cor} logoUrl={lado.logo} />
      <span className={`min-w-0 flex-1 whitespace-normal break-words text-base leading-5 text-vs-text ${venceu ? 'font-bold' : 'font-semibold'} ${lado.definir ? 'italic text-vs-muted' : ''}`}>
        <NomeEquipe nome={lado.definir ? 'A definir' : lado.nome} />
        {lado.provisorio && (
          <span className="mt-0.5 block text-[11px] font-semibold leading-4 text-vs-muted">
            {lado.origem ? `${lado.origem} · provisório` : 'provisório'}
          </span>
        )}
      </span>
      {venceu && <Check size={14} className="shrink-0 text-vs-gold" aria-label="Vencedor" />}
      <b className={`w-6 text-right font-display text-xl font-bold tabular-nums ${venceu ? 'text-vs-gold' : 'text-vs-muted'}`}>{lado.definir ? '—' : sets ?? '—'}</b>
    </li>
  )
}

function useTrocaDeTime(marca: number) {
  const anterior = useRef<number | null>(null)
  const [brilho, setBrilho] = useState(false)
  useEffect(() => {
    if (anterior.current != null && anterior.current !== marca) {
      setBrilho(true)
      const timer = window.setTimeout(() => setBrilho(false), 1400)
      anterior.current = marca
      return () => window.clearTimeout(timer)
    }
    anterior.current = marca
  }, [marca])
  return brilho
}

function LinhaStory({ lado, sets, venceu }: { lado: LadoCartaz; sets: number | null; venceu: boolean }) {
  return (
    <p className={`${estilos.linhaChave} ${venceu ? estilos.venceu : ''}`}>
      <Escudo nome={lado.nome} cor={lado.cor} logoUrl={lado.logo} grande />
      <span className={estilos.nome}>{lado.definir ? 'A definir' : <NomeEquipe nome={lado.nome} />}</span>
      {venceu && <Check size={28} aria-label="Vencedor" />}
      <b className={estilos.valor}>{lado.definir ? '—' : sets ?? '—'}</b>
    </p>
  )
}

function Escudo({ nome, cor, logoUrl, grande = false }: { nome: string; cor: string | null; logoUrl: string | null; grande?: boolean }) {
  const sigla = iniciais(nome)
  if (logoUrl) {
    return <img src={logoUrl} alt="" className={grande ? estilos.escudo : 'h-9 w-9 shrink-0 object-contain'} />
  }
  if (grande) {
    return (
      <span className={estilos.escudo} style={{ background: cor ?? 'var(--story-elevada)' }}>{sigla || '–'}</span>
    )
  }
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-vs-text" style={{ background: cor ?? '#16243D' }}>
      {sigla || '–'}
    </span>
  )
}
