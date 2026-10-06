import { CampeonatosExpansiveis } from '@/components/portal/CampeonatosExpansiveis'
import { createPageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = createPageMetadata({
  title: 'Galeria dos campeonatos',
  description: 'Fotos de cada campeonato, separadas pela competição.',
  path: '/galeria',
})

export default function GaleriaPage() {
  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <CampeonatosExpansiveis
        modulo="galeria"
        kicker="Galeria"
        titulo="Campeonatos"
        descricao="As fotos ficam dentro do campeonato, mesmo quando as competições são de organizadores diferentes."
        vazioLista="Nenhuma imagem disponível"
      />
    </main>
  )
}
