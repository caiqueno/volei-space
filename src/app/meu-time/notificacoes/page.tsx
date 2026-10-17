import type { Metadata } from 'next'
import { NotificacoesTela } from '@/components/meu-time-fase2/Notificacoes'

export const metadata: Metadata = { title: 'Notificações | Meu Time' }

export default function Page() {
  return <NotificacoesTela />
}
