'use client'

import { cloneElement, isValidElement, useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react'
import { createPortal } from 'react-dom'

type Burst = { id: number; x: number; y: number }

type ClickableProps = {
  onClick?: (event: MouseEvent<HTMLElement>) => void
}

export type VolleyballBurstProps = {
  /** Um único elemento clicável. O onClick dele roda na hora; a bola é decorativa. */
  children: ReactElement<ClickableProps>
  /** Quando false, o clique do filho segue e a bola não aparece. */
  enabled?: boolean
}

function lerDuracaoBurst() {
  const bruto = getComputedStyle(document.documentElement).getPropertyValue('--vs-motion-burst').trim()
  if (bruto.endsWith('ms')) return Number.parseFloat(bruto)
  if (bruto.endsWith('s')) return Number.parseFloat(bruto) * 1000
  return 480
}

function Bola() {
  return (
    <svg viewBox="0 0 32 32" focusable="false" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="#F5F7FB" />
      <path
        d="M16 3.2c1.8 4.4 1.8 21.2 0 25.6M4.2 11.2c5.4 1.5 18.2 1.5 23.6 0M4.2 20.8c5.4-1.5 18.2-1.5 23.6 0"
        fill="none"
        stroke="#1A1205"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7.2 7.4c3.6 3.2 5.2 7 4.6 11.2"
        fill="none"
        stroke="#FFB331"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Solta uma bola no clique do filho. Não atrasa o onClick:
 * o handler original termina antes do setState da animação.
 */
export function VolleyballBurst({ children, enabled = true }: VolleyballBurstProps) {
  const [bursts, setBursts] = useState<Burst[]>([])
  const [pronto, setPronto] = useState(false)
  const seq = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    setPronto(true)
    const pendentes = timers.current
    return () => {
      pendentes.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  if (!isValidElement(children)) return null

  const filho = children

  function soltar(event: MouseEvent<HTMLElement>) {
    const avisar = filho.props.onClick
    avisar?.(event)
    if (!enabled) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const duracao = lerDuracaoBurst()
    if (!Number.isFinite(duracao) || duracao <= 0) return
    const caixa = event.currentTarget.getBoundingClientRect()
    const teclado = event.detail === 0
    const id = ++seq.current
    setBursts((lista) => [...lista, {
      id,
      x: teclado ? caixa.left + caixa.width / 2 : event.clientX,
      y: teclado ? caixa.top + caixa.height / 2 : event.clientY,
    }])
    const timer = window.setTimeout(() => {
      setBursts((lista) => lista.filter((item) => item.id !== id))
    }, duracao + 40)
    timers.current.push(timer)
  }

  return (
    <>
      {cloneElement(filho, { onClick: soltar })}
      {pronto && bursts.map((burst) => createPortal(
        <span key={burst.id} className="vs-ball-burst" style={{ left: burst.x, top: burst.y }} aria-hidden="true">
          <Bola />
        </span>,
        document.body,
      ))}
    </>
  )
}
