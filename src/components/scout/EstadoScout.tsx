'use client'

import { TEXTO_TELA_SCOUT, type TelaScout } from '@/lib/scout-ui/textos'

export function EstadoScout({ tela, onTentar, aviso }: { tela: TelaScout; onTentar?: () => void; aviso?: string | null }) {
  const t = TEXTO_TELA_SCOUT[tela]
  return (
    <section role="alert" className="mx-auto mt-16 w-full max-w-md rounded-3xl border border-vs-border bg-vs-surface p-6 text-center text-vs-text">
      <h1 className="font-display text-3xl font-bold">{t.titulo}</h1>
      <p className="mt-3 text-base leading-7">{t.texto}</p>
      {aviso ? <p className="mt-3 text-base font-bold leading-7 text-vs-gold">{aviso}</p> : null}
      {t.tentar && onTentar ? (
        <button
          type="button"
          onClick={onTentar}
          className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-vs-gold px-5 py-2 text-base font-bold text-vs-on-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Tentar de novo
        </button>
      ) : null}
    </section>
  )
}

export function CarregandoScout() {
  return (
    <p role="status" className="mt-16 text-center text-base font-bold text-vs-text">
      Carregando o scout...
    </p>
  )
}
