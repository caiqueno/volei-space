'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { getPerfil, getPasso, navegacao, rotaPasso } from '@/lib/prototipo/roteiro'
import { AVISO_EXEMPLO } from '@/lib/prototipo/exemplo'
import { useProto } from './ProtoContext'

export const BTN =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vs-gold disabled:cursor-not-allowed disabled:opacity-50'
export const BTN_PRIMARIO = `${BTN} bg-vs-gold text-vs-on-gold hover:bg-vs-gold-hover`
export const BTN_SECUNDARIO = `${BTN} border border-vs-border bg-vs-elevated text-vs-text hover:border-vs-blue`
export const CARTAO = 'rounded-2xl border border-vs-border bg-vs-surface p-4'
export const CAMPO =
  'min-h-[44px] w-full rounded-xl border border-vs-border bg-vs-bg px-3 text-vs-text placeholder:text-vs-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-vs-gold'

export function Selo() {
  return (
    <p className="inline-block rounded-full border border-vs-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-vs-gold">
      {AVISO_EXEMPLO}
    </p>
  )
}

export function BotaoReiniciar() {
  const { reiniciar } = useProto()
  return (
    <button type="button" onClick={reiniciar} className={BTN_SECUNDARIO}>
      Reiniciar protótipo
    </button>
  )
}

export function Moldura({ perfilId, passoId, children }: { perfilId: string; passoId: string; children: ReactNode }) {
  const perfil = getPerfil(perfilId)
  const passo = getPasso(perfilId, passoId)
  const nav = navegacao(perfilId, passoId)
  if (!perfil || !passo || !nav) return null
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-4 px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Selo />
        <BotaoReiniciar />
      </header>
      <nav aria-label="Navegação do protótipo" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/prototipo" className="inline-flex min-h-[44px] items-center text-vs-blue underline">
          Todos os perfis
        </Link>
        <span aria-hidden className="text-vs-muted">/</span>
        <span className="text-vs-muted">{perfil.nome}</span>
      </nav>
      <div>
        <p className="text-sm text-vs-muted" aria-live="polite">
          Passo {nav.indice + 1} de {nav.total}
        </p>
        <h1 className="text-2xl font-bold text-vs-text">{passo.titulo}</h1>
        <p className="text-vs-muted">{passo.resumo}</p>
      </div>
      <ol className="flex flex-wrap gap-2" aria-label="Passos do percurso">
        {perfil.passos.map((p, i) => (
          <li key={p.id}>
            <Link
              href={rotaPasso(perfilId, p.id)}
              aria-current={p.id === passoId ? 'step' : undefined}
              className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border px-3 text-sm font-semibold ${
                p.id === passoId ? 'border-vs-gold bg-vs-gold text-vs-on-gold' : 'border-vs-border bg-vs-surface text-vs-text'
              }`}
              title={p.titulo}
            >
              <span className="sr-only">{p.titulo}: passo </span>
              {i + 1}
            </Link>
          </li>
        ))}
      </ol>
      <main className="flex flex-1 flex-col gap-4">{children}</main>
      <footer className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-vs-border bg-vs-bg py-3">
        {nav.anterior ? (
          <Link href={nav.anterior} className={BTN_SECUNDARIO}>
            Anterior
          </Link>
        ) : (
          <span />
        )}
        {nav.proximo ? (
          <Link href={nav.proximo} className={BTN_PRIMARIO}>
            Próximo
          </Link>
        ) : (
          <Link href="/prototipo" className={BTN_PRIMARIO}>
            Concluir e escolher outro perfil
          </Link>
        )}
      </footer>
    </div>
  )
}
