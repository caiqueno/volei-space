import type { Metadata } from 'next'
import { ConviteAtleta } from '@/components/meu-time-fase2/ConviteAtleta'

export const metadata: Metadata = { title: 'Convite para o time', robots: { index: false, follow: false } }

export default function Page({ params }: { params: { token: string } }) {
  return <ConviteAtleta token={params.token} />
}
