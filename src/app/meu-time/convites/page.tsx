import type { Metadata } from 'next'
import { ConvitesLider } from '@/components/meu-time-fase2/Convites'

export const metadata: Metadata = { title: 'Convites | Meu Time' }

export default function Page() {
  return <ConvitesLider />
}
