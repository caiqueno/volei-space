import { CampeonatosExpansiveis } from '@/components/portal/CampeonatosExpansiveis'
import { createPageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = createPageMetadata({
  title: 'Rankings de vôlei',
  description: 'Classificação geral dos atletas por ataque, bloqueio e saque da súmula, atualizada durante o campeonato.',
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
        descricao="A classificação geral lista todos os atletas, pelos pontos de ataque, bloqueio e saque da súmula. O MVP aparece quando o campeonato termina."
        vazioLista="Nenhum ranking disponível"
      />
    </main>
  )
}
