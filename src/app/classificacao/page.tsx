import { CampeonatosExpansiveis } from '@/components/portal/CampeonatosExpansiveis'
import { createPageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = createPageMetadata({
  title: 'Classificação dos campeonatos',
  description: 'Abra a classificação de cada campeonato sem sair desta tela.',
  path: '/classificacao',
})

export default function ClassificacaoPage() {
  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <CampeonatosExpansiveis
        modulo="classificacao"
        kicker="Classificação"
        titulo="Campeonatos"
        descricao="Escolha um campeonato para abrir a tabela aqui. A lista reúne as competições públicas, sem filtrar pelo organizador."
        vazioLista="Nenhuma classificação disponível"
      />
    </main>
  )
}
