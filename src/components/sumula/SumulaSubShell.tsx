'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

const SAIDA_MS = 180

export function SumulaSubShell({ aberto, children }: { aberto: boolean; children: ReactNode }) {
  const [visivel, setVisivel] = useState(aberto)
  const [saindo, setSaindo] = useState(false)
  const ultimo = useRef(children)
  if (aberto) ultimo.current = children

  useEffect(() => {
    if (aberto) {
      setVisivel(true)
      setSaindo(false)
      return
    }
    if (!visivel) return
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduzir) {
      setVisivel(false)
      setSaindo(false)
      return
    }
    setSaindo(true)
    const timer = window.setTimeout(() => {
      setVisivel(false)
      setSaindo(false)
    }, SAIDA_MS)
    return () => window.clearTimeout(timer)
  }, [aberto, visivel])

  const reduzir = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!aberto && (reduzir || !visivel)) return null

  return (
    <div className={saindo && !aberto ? 'sumula-sub-shell is-leaving' : 'sumula-sub-shell'} aria-hidden={saindo && !aberto ? true : undefined}>
      {aberto ? children : ultimo.current}
    </div>
  )
}
