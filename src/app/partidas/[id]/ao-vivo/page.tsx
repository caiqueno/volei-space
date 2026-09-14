import type { Metadata } from 'next'
import LiveMatchView from './LiveMatchView'
import { createPageMetadata } from '@/lib/seo'

type PageProps = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  return createPageMetadata({
    title: 'Partida de vôlei ao vivo',
    description: 'Acompanhe o placar e os acontecimentos desta partida de vôlei em tempo real.',
    path: `/partidas/${encodeURIComponent(id)}/ao-vivo`,
  })
}

export default async function PartidaAoVivoPage({ params }: PageProps) {
  const { id } = await params
  return <LiveMatchView partidaId={id} />
}
