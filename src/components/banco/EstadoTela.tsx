'use client'

import { TEXTO_TELA, type TelaEstado } from '@/lib/banco-ui/falhas'
import { BTN_PRIMARIO } from './Dialogo'

export function EstadoTela({ tela, onTentar }: { tela: TelaEstado; onTentar?: () => void }) {
  const t = TEXTO_TELA[tela]
  return (
    <section role="alert" className="mx-auto mt-16 w-full max-w-md rounded-3xl border border-vs-border bg-vs-surface p-6 text-center">
      <h1 className="font-display text-3xl font-bold text-vs-text">{t.titulo}</h1>
      <p className="mt-3 text-base leading-7 text-vs-text/90">{t.texto}</p>
      {t.tentar && onTentar ? (
        <button type="button" onClick={onTentar} className={`${BTN_PRIMARIO} mt-5 w-full`}>
          Tentar de novo
        </button>
      ) : null}
    </section>
  )
}

export function CarregandoTela() {
  return (
    <p role="status" className="mt-16 text-center text-base font-bold text-vs-text">
      Carregando o banco...
    </p>
  )
}
