import { CampeonatosExpansiveis } from '@/components/portal/CampeonatosExpansiveis'
import { createPageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = createPageMetadata({
  title: 'Rankings de vôlei',
  description: 'MVP do campeonato, pelo atleta com mais pontos de saque, ataque e bloqueio.',
  path: '/rankings',
})

type PageProps = {
  searchParams?: Promise<{ ligaId?: string; categoria?: string }>
}

export default async function RankingsPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {}
  const ligaId = Number(params.ligaId)
  const ligaIdInicial = Number.isInteger(ligaId) && ligaId > 0 ? ligaId : null

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <CampeonatosExpansiveis
        ligaIdInicial={ligaIdInicial}
        categoriaInicial={params.categoria ?? null}
        modulo="rankings"
        kicker="Rankings"
        titulo="Campeonatos"
        descricao="No campeonato concluído, o MVP é quem somou mais pontos de saque, ataque e bloqueio."
        vazioLista="Nenhum ranking disponível"
      />
    </main>
  )
}
