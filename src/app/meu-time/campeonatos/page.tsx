import type { Metadata } from 'next'
import { CampeonatosTela } from '@/components/meu-time-campeonatos/Campeonatos'

export const metadata: Metadata = { title: 'Campeonatos | Meu Time' }

export default function Page() {
  return <CampeonatosTela />
}
