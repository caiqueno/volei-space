import type { ReactNode } from 'react'
import { NavMeuTime } from '@/components/meu-time-fase2/NavMeuTime'

export default function MeuTimeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <NavMeuTime />
      {children}
    </>
  )
}
