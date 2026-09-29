'use client'

import { useEffect, useState } from 'react'
import { assinarCarregamento, haCarregamentoLento } from '@/lib/api-cliente'

export function IndicadorDemora() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    return assinarCarregamento(() => setVisivel(haCarregamentoLento()))
  }, [])

  if (!visivel) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-1 overflow-hidden bg-white/10" role="progressbar" aria-label="Carregando">
      <div className="h-full w-full animate-pulse bg-[#ffb331]" />
    </div>
  )
}
