'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { rotaSemMicroInteracao } from '@/lib/motion-rotas'

export function TransicaoDeTela({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (rotaSemMicroInteracao(pathname)) return children

  return (
    <div key={pathname} className="vs-motion-on vs-motion-screen">
      {children}
    </div>
  )
}
