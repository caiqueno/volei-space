import type { ReactNode } from 'react'
import { SeletorPerfil } from '@/components/perfil/SeletorPerfil'

// O seletor só aparece com NEXT_PUBLIC_LOGIN_SEM_SENHA_ATIVO=1; desligada, o painel segue como era.
export default function PainelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SeletorPerfil />
      {children}
    </>
  )
}
