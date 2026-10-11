'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { caminhoIsentoDeInatividade, INATIVIDADE_GESTAO_MS } from '@/lib/sessao-gestao'
import { encerrarSessaoPorInatividade } from '@/lib/sessao-publica'

const FOLGA_RENOVACAO_MS = 5 * 60 * 1000

export function SessaoGestao() {
  const pathname = usePathname()

  useEffect(() => {
    if (caminhoIsentoDeInatividade(pathname)) return
    let encerrado = false
    let ultimaInteracao = Date.now()
    let ultimaRenovacao = Date.now()

    const sair = () => {
      if (encerrado) return
      encerrado = true
      void encerrarSessaoPorInatividade()
    }

    const marcar = () => {
      ultimaInteracao = Date.now()
    }

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void conferir()
    }

    async function conferir() {
      if (encerrado || document.visibilityState === 'hidden') return
      const agora = Date.now()
      if (agora - ultimaInteracao >= INATIVIDADE_GESTAO_MS) {
        sair()
        return
      }
      try {
        const sessao = await fetch('/api/auth/sessao', { cache: 'no-store' })
        if (sessao.status === 401) {
          sair()
          return
        }
      } catch {
        return
      }
      if (encerrado) return
      if (ultimaInteracao <= ultimaRenovacao || agora - ultimaRenovacao < FOLGA_RENOVACAO_MS) return
      ultimaRenovacao = agora
      try {
        const renovacao = await fetch('/api/auth/atividade', { method: 'POST' })
        if (renovacao.status === 401) sair()
      } catch {
        ultimaRenovacao = 0
      }
    }

    const eventos = ['pointerdown', 'keydown', 'touchstart'] as const
    eventos.forEach((evento) => window.addEventListener(evento, marcar, { passive: true }))
    document.addEventListener('visibilitychange', aoVoltar)
    const intervalo = window.setInterval(() => { void conferir() }, 30_000)
    void conferir()

    return () => {
      encerrado = true
      eventos.forEach((evento) => window.removeEventListener(evento, marcar))
      document.removeEventListener('visibilitychange', aoVoltar)
      window.clearInterval(intervalo)
    }
  }, [pathname])

  return null
}
