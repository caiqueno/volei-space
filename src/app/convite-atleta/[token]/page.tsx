import type { Metadata } from 'next'
import { ConviteAtleta } from '@/components/meu-time-fase2/ConviteAtleta'

// O link é a credencial: não indexar e não vazar o endereço por referrer.
export const metadata: Metadata = { title: 'Convite para o time', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default function Page({ params }: { params: { token: string } }) {
  return <ConviteAtleta token={params.token} />
}
