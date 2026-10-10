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
    <div className="vs-motion-fade pointer-events-none fixed inset-x-0 top-0 z-[80] h-1 overflow-hidden bg-white/10" role="progressbar" aria-label="Carregando">
      <div className="vs-skeleton h-full w-full bg-[#ffb331]" />
    </div>
  )
}
