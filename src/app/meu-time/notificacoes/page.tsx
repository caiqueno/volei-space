import type { Metadata } from 'next'
import { NotificacoesComPreferencias } from '@/components/notificacoes-canais/Abas'

export const metadata: Metadata = { title: 'Notificações | Meu Time' }

export default function Page() {
  return <NotificacoesComPreferencias />
}
