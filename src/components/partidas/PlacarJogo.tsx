import type { ReactNode } from 'react'
import estilos from '@/components/stories/cartaz.module.css'

type Props = {
  tom?: 'site' | 'story'
  ladoA: ReactNode
  ladoB: ReactNode
  valorA: ReactNode
  valorB: ReactNode
  centro: ReactNode
  destaqueA?: boolean
  destaqueB?: boolean
}

export function PlacarJogo({ tom = 'site', ladoA, ladoB, valorA, valorB, centro, destaqueA = false, destaqueB = false }: Props) {
  if (tom === 'story') {
    return (
      <div className={estilos.placar}>
        <div className={destaqueA ? estilos.ladoDestaque : estilos.lado}>
          <span className={estilos.nome}>{ladoA}</span>
          <b className={estilos.placarGrande}>{valorA}</b>
        </div>
        <span className={estilos.centroPlacar}>{centro}</span>
        <div className={destaqueB ? estilos.ladoDestaque : estilos.lado}>
          <span className={estilos.nome}>{ladoB}</span>
          <b className={estilos.placarGrande}>{valorB}</b>
        </div>
      </div>
    )
  }

  return (
    <div className="live-match-scoreboard">
      <div><strong>{ladoA}</strong><b>{valorA}</b></div>
      <span>{centro}</span>
      <div><strong>{ladoB}</strong><b>{valorB}</b></div>
    </div>
  )
}
