import type { Metadata } from 'next'
import { CompeticoesTela } from '@/components/meu-time-competicoes/Competicoes'

export const metadata: Metadata = { title: 'Competições | Meu Time' }

export default function Page() {
  return <CompeticoesTela />
}
