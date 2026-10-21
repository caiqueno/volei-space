import type { Metadata } from 'next'
import { InicioTela } from '@/components/perfil/Inicio'

export const metadata: Metadata = { title: 'Início | Meu Time' }

export default function Page() {
  return <InicioTela />
}
