'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ErroMeuTime } from './cliente'
import { falhaDeRede, type Falha } from '@/lib/meu-time-ui/respostas'

// Classes compartilhadas. Cores vêm dos tokens --vs-*; alvos de toque >= 44 px.
export const botaoPrimario =
  'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--vs-gold)] px-5 py-3 text-base font-black text-[var(--vs-on-gold)] transition hover:bg-[var(--vs-gold-hover)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none sm:w-auto'
export const botaoSecundario =
  'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--vs-border-strong)] bg-transparent px-4 py-2 text-base font-bold text-[var(--vs-text)] transition hover:bg-[var(--vs-elevated)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none sm:w-auto'
export const botaoPerigo =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--vs-error-border)] px-4 py-2 text-sm font-bold text-[var(--vs-error-fg)] hover:bg-[var(--vs-error-bg)]'
export const campoEstilo =
  'min-h-[48px] w-full rounded-xl border border-[var(--vs-border-strong)] bg-[var(--vs-bg)] px-3 py-2 text-base text-[var(--vs-text)] placeholder:text-[var(--vs-muted)]'
export const cartao = 'rounded-2xl border border-[var(--vs-border)] bg-[var(--vs-surface)] p-4'

export function Pagina({ titulo, voltar, children }: { titulo: string; voltar?: { href: string; texto: string }; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 pb-28 pt-6 text-[var(--vs-text)]">
      {voltar && (
        <Link href={voltar.href} className="mb-3 inline-flex min-h-[44px] items-center text-sm font-bold text-[var(--vs-gold)] underline">
          {voltar.texto}
        </Link>
      )}
      <h1 className="mb-5 font-display text-3xl font-black leading-tight">{titulo}</h1>
      <div className="flex flex-col gap-4">{children}</div>
    </main>
  )
}

export function Campo({ id, rotulo, ajuda, erro, children }: { id: string; rotulo: string; ajuda?: string; erro?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-[var(--vs-text)]">{rotulo}</label>
      {children}
      {ajuda && !erro && <p id={`${id}-ajuda`} className="text-sm text-[var(--vs-muted)]">{ajuda}</p>}
      {erro && <p id={`${id}-erro`} role="alert" className="text-sm font-bold text-[var(--vs-error-fg)]">{erro}</p>}
    </div>
  )
}

export function descreve(id: string, ajuda?: string, erro?: string | null) {
  const ids = [ajuda && !erro ? `${id}-ajuda` : '', erro ? `${id}-erro` : ''].filter(Boolean).join(' ')
  return { 'aria-describedby': ids || undefined, 'aria-invalid': erro ? true : undefined } as const
}

export function Aviso({ tom = 'info', children, alerta }: { tom?: 'info' | 'is-warning' | 'is-error' | 'is-success'; children: ReactNode; alerta?: boolean }) {
  const classe = tom === 'info' ? 'vs-state' : `vs-state ${tom}`
  return <div className={classe} role={alerta ? 'alert' : 'status'}>{children}</div>
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div role="status" aria-live="polite" className={`${cartao} animate-pulse motion-reduce:animate-none`}>
      <span className="text-sm font-bold text-[var(--vs-muted)]">{texto}</span>
      <div className="mt-3 h-4 w-2/3 rounded bg-[var(--vs-elevated)]" />
      <div className="mt-2 h-4 w-1/2 rounded bg-[var(--vs-elevated)]" />
    </div>
  )
}

export function falhaDe(erro: unknown): Falha {
  if (erro instanceof ErroMeuTime) return erro.falha
  return falhaDeRede()
}

/** Mostra a falha com saída: tentar de novo, entrar ou voltar. O 503 vira aviso, não erro. */
export function FalhaTela({ falha, aoTentar }: { falha: Falha; aoTentar?: () => void }) {
  if (falha.tipo === 'nao-habilitado') {
    return (
      <div className="flex flex-col gap-3">
        <Aviso>
          <strong className="block">Meu Time ainda não está habilitado</strong>
          {falha.mensagem}
        </Aviso>
        <Link href="/" className={botaoSecundario}>Voltar ao início</Link>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <Aviso tom="is-error" alerta>
        {falha.mensagem}
        {falha.detalhes && falha.detalhes.length > 0 && (
          <ul className="mt-2 list-disc pl-5">{falha.detalhes.map((d) => <li key={d}>{d}</li>)}</ul>
        )}
      </Aviso>
      {falha.tipo === 'sem-sessao' && <Link href="/login" className={botaoPrimario}>Entrar na conta</Link>}
      {aoTentar && falha.tipo !== 'sem-sessao' && <button type="button" onClick={aoTentar} className={botaoPrimario}>Tentar de novo</button>}
      {falha.tipo === 'nao-encontrado' && <Link href="/meu-time" className={botaoSecundario}>Ver meus times</Link>}
    </div>
  )
}

export type Carga<T> = { estado: 'carregando' } | { estado: 'pronto'; dados: T } | { estado: 'falha'; falha: Falha }

/** Carrega dados uma vez e permite recarregar sem piscar a tela inteira. */
export function useCarregar<T>(buscar: () => Promise<T>) {
  const [carga, setCarga] = useState<Carga<T>>({ estado: 'carregando' })
  const buscarRef = useRef(buscar)
  buscarRef.current = buscar
  const ativo = useRef(true)

  const recarregar = useCallback(async () => {
    try {
      const dados = await buscarRef.current()
      if (ativo.current) setCarga({ estado: 'pronto', dados })
    } catch (erro) {
      if (ativo.current) setCarga({ estado: 'falha', falha: falhaDe(erro) })
    }
  }, [])

  const tentarDeNovo = useCallback(() => {
    setCarga({ estado: 'carregando' })
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    ativo.current = true
    void recarregar()
    return () => {
      ativo.current = false
    }
  }, [recarregar])

  return { carga, recarregar, tentarDeNovo }
}
