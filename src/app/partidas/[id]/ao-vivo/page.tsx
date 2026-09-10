import LiveMatchView from './LiveMatchView'

export default async function PartidaAoVivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <LiveMatchView partidaId={id} />
}
