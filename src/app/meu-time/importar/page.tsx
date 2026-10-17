import type { Metadata } from 'next'
import { ImportarPlanilha } from '@/components/meu-time-fase2/Importar'

export const metadata: Metadata = { title: 'Importar atletas | Meu Time' }

export default function Page() {
  return <ImportarPlanilha />
}
