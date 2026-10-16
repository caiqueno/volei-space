import type { Metadata } from 'next'
import { ListaTimes } from '@/components/meu-time/ListaTimes'

export const metadata: Metadata = { title: 'Meu Time' }

export default function MeuTimePage() {
  return <ListaTimes />
}
