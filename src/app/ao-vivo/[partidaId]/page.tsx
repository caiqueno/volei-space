import type { Metadata } from 'next'
import { PlacarAoVivo } from '@/components/ao-vivo/PlacarAoVivo'
import { aoVivoAtivo, partidaIdValido } from '@/lib/ao-vivo-ui/polling'

type PageProps = { params: Promise<{ partidaId: string }> }

export const metadata: Metadata = {
  title: 'Placar ao vivo | volei.space',
  description: 'Placar de vôlei em tempo real, em tela cheia.',
  robots: { index: false, follow: false },
}

/** Placar público em tela cheia. Desligado (NEXT_PUBLIC_AO_VIVO_ATIVO diferente de "1"), mostra "Em breve". */
export default async function PlacarAoVivoPage({ params }: PageProps) {
  const { partidaId } = await params
  const id = partidaIdValido(partidaId)

  if (!aoVivoAtivo(process.env.NEXT_PUBLIC_AO_VIVO_ATIVO)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-luva-bg p-6 text-center">
        <div>
          <h1 className="text-4xl font-black text-white sm:text-6xl">Em breve</h1>
          <p className="mt-4 text-lg text-slate-200">O placar ao vivo em tela cheia ainda não está disponível.</p>
          <a href="/jogos" className="mt-8 inline-flex min-h-[48px] items-center rounded-xl bg-luva-amber px-6 text-lg font-bold text-luva-bg focus:outline-none focus-visible:ring-4 focus-visible:ring-white">
            Ver jogos
          </a>
        </div>
      </main>
    )
  }

  if (id === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-luva-bg p-6 text-center">
        <div>
          <h1 className="text-3xl font-black text-white sm:text-5xl">Partida não encontrada</h1>
          <a href="/jogos" className="mt-8 inline-flex min-h-[48px] items-center rounded-xl bg-luva-amber px-6 text-lg font-bold text-luva-bg focus:outline-none focus-visible:ring-4 focus-visible:ring-white">
            Ver jogos
          </a>
        </div>
      </main>
    )
  }

  return <PlacarAoVivo partidaId={id} />
}
