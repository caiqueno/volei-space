export const dynamic = 'force-dynamic'

import { unstable_noStore as noStore } from 'next/cache'
import { Trophy } from 'lucide-react'
import { PageHero } from '@/components/layout/PageHero'
import { CreatorEmptyState, LeagueScopeBar } from '@/components/organizador/LeagueScope'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { ChaveamentoMataMata, type BracketRoundView, type BracketSlot, type TeamOption } from '@/components/mata-mata/ChaveamentoMataMata'
import { getMataMataBracket } from '@/lib/mata-mata'
import { getCreatorLeagueScope } from '@/lib/league-scope'
import { isSupabaseConfigured } from '@/lib/supabase'
import { createPageMetadata } from '@/lib/seo'

export const metadata = createPageMetadata({
  title: 'Fase mata-mata',
  description: 'Acompanhe as chaves, confrontos e resultados das fases eliminatórias dos campeonatos de vôlei.',
  path: '/fase-mata-mata',
})

type PageProps = {
  searchParams?: Promise<{ organizador?: string; ligaId?: string }>
}

export default async function FaseMataMataPage({ searchParams }: PageProps) {
  noStore()
  const params = searchParams ? await searchParams : {}
  const scope = isSupabaseConfigured ? await getCreatorLeagueScope(params) : { organizadorId: null, ligas: [], selectedLiga: null }
  const organizerMode = Boolean(scope.organizadorId && scope.selectedLiga)

  let rounds: BracketRoundView[] = []
  let champion: TeamOption | null = null
  let thirdPlace: BracketSlot | null = null

  if (isSupabaseConfigured && scope.selectedLiga) {
    const bracket = await getMataMataBracket(scope.selectedLiga.id, scope.selectedLiga.faseEliminatoria, organizerMode)
    rounds = bracket.rounds
    champion = bracket.champion
    thirdPlace = bracket.thirdPlace
  }

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <PageHero
        eyebrow={<><Trophy size={16} /> Mata-mata</>}
        title={scope.selectedLiga ? `Chaveamento - ${scope.selectedLiga.nome}` : 'Chaveamento do mata-mata'}
        description="Acompanhe os confrontos eliminatórios até a decisão do campeão."
      />

      <LeagueScopeBar ligas={scope.ligas} selected={scope.selectedLiga} organizadorId={scope.organizadorId} basePath="/fase-mata-mata" />

      <section className="mx-auto max-w-7xl px-4 py-8">
        {scope.organizadorId && !scope.selectedLiga ? (
          <CreatorEmptyState organizadorId={scope.organizadorId} title="Nenhum campeonato selecionado." description="Escolha um campeonato para ver o chaveamento do mata-mata." />
        ) : !scope.selectedLiga ? (
          <EstadoVazio titulo="Nenhum campeonato selecionado" descricao="Acesse esta página a partir da tela de classificação de um campeonato." />
        ) : rounds.length === 0 ? (
          <EstadoVazio titulo="Sem fase eliminatória configurada" descricao="Este campeonato não tem uma fase de mata-mata configurada." />
        ) : (
          <ChaveamentoMataMata ligaId={scope.selectedLiga.id} rounds={rounds} champion={champion} thirdPlace={thirdPlace} organizerMode={organizerMode} />
        )}
      </section>
    </main>
  )
}
