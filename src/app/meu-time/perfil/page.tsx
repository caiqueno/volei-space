import type { Metadata } from 'next'
import { PerfilTela } from '@/components/perfil/PerfilTela'

export const metadata: Metadata = { title: 'Perfil | Meu Time' }

export default function Page() {
  return <PerfilTela />
}
