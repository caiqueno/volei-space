'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity } from 'lucide-react'
import { criarFilaAvisos, type AvisoSumula } from '@/lib/sumula-toasts'

export function useAvisosSumula() {
  const [avisos, setAvisos] = useState<AvisoSumula[]>([])
  const filaRef = useRef<ReturnType<typeof criarFilaAvisos> | null>(null)

  useEffect(() => {
    const fila = criarFilaAvisos({
      marcar: (callback, ms) => window.setTimeout(callback, ms),
      cancelar: (id) => window.clearTimeout(id),
    })
    filaRef.current = fila
    const cancelarInscricao = fila.inscrever(setAvisos)
    return () => {
      cancelarInscricao()
      fila.desmontar()
      if (filaRef.current === fila) filaRef.current = null
    }
  }, [])

  const addToast = useCallback((message: string) => {
    filaRef.current?.publicar(message)
  }, [])

  return { avisos, addToast }
}

export function AvisosSumula({ avisos }: { avisos: AvisoSumula[] }) {
  if (avisos.length === 0) return null
  return (
    <div className="official-toasts" role="status" aria-live="polite">
      {avisos.map((aviso) => (
        <div key={aviso.id}>
          <Activity size={14} aria-hidden="true" />
          <span>{aviso.message}</span>
        </div>
      ))}
    </div>
  )
}
