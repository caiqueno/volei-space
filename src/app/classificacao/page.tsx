import { CampeonatosExpansiveis } from '@/components/portal/CampeonatosExpansiveis'
import { createPageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = createPageMetadata({
  title: 'Classificação dos campeonatos',
  description: 'Abra a classificação de cada campeonato sem sair desta tela.',
  path: '/classificacao',
})

type PageProps = {
  searchParams?: Promise<{ ligaId?: string; categoria?: string }>
}

export default async function ClassificacaoPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {}
  const ligaId = Number(params.ligaId)
  const ligaIdInicial = Number.isInteger(ligaId) && ligaId > 0 ? ligaId : null

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <CampeonatosExpansiveis
        ligaIdInicial={ligaIdInicial}
        categoriaInicial={params.categoria ?? null}
        modulo="classificacao"
        kicker="Classificação"
        titulo="Campeonatos"
        descricao="Escolha um campeonato para abrir a tabela aqui. A lista reúne as competições públicas, sem filtrar pelo organizador."
        vazioLista="Nenhuma classificação disponível"
      />
    </main>
  )
}
