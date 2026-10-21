import type { ReactNode } from 'react'
import { SeletorPerfil } from '@/components/perfil/SeletorPerfil'
import { NavMeuTime } from '@/components/meu-time-fase2/NavMeuTime'

export default function MeuTimeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeletorPerfil />
      <NavMeuTime />
      {children}
    </>
  )
}
