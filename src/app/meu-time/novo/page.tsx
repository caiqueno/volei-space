import type { Metadata } from 'next'
import { CriarTime } from '@/components/meu-time/CriarTime'

export const metadata: Metadata = { title: 'Criar meu time' }

export default function NovoTimePage() {
  return <CriarTime />
}
