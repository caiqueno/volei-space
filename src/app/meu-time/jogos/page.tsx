import type { Metadata } from 'next'
import { JogosTela } from '@/components/meu-time-campeonatos/Jogos'

export const metadata: Metadata = { title: 'Jogos | Meu Time' }

export default function Page() {
  return <JogosTela />
}
