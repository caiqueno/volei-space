import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DetalheTime } from '@/components/meu-time/DetalheTime'
import { Carregando, Pagina } from '@/components/meu-time/ui'

export const metadata: Metadata = { title: 'Meu time' }

export default function DetalheTimePage({ params }: { params: { equipeId: string } }) {
  return (
    <Suspense fallback={<Pagina titulo="Meu time"><Carregando texto="Carregando o time…" /></Pagina>}>
      <DetalheTime equipeId={params.equipeId} />
    </Suspense>
  )
}
