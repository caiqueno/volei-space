import type { Metadata } from 'next'
import PlacarOverlay from '@/components/placar/PlacarOverlay'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fundo?: string | string[] }>
}

export const metadata: Metadata = {
  title: 'Placar ao vivo',
  description: 'Placar para telão e transmissão.',
  robots: { index: false, follow: false },
}

export default async function PlacarPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { fundo } = await searchParams
  const transparente = (Array.isArray(fundo) ? fundo[0] : fundo) === 'transparente'
  return <PlacarOverlay partidaId={id} transparente={transparente} />
}
