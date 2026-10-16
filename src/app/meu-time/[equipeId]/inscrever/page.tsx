import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AssistenteInscricao } from '@/components/meu-time/AssistenteInscricao'
import { Carregando, Pagina } from '@/components/meu-time/ui'

export const metadata: Metadata = { title: 'Inscrever meu time' }

export default function InscreverPage({ params }: { params: { equipeId: string } }) {
  return (
    <Suspense fallback={<Pagina titulo="Inscrever meu time"><Carregando texto="Preparando a inscrição…" /></Pagina>}>
      <AssistenteInscricao equipeId={params.equipeId} />
    </Suspense>
  )
}
