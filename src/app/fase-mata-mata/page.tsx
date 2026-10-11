export const dynamic = 'force-dynamic'

import { unstable_noStore as noStore } from 'next/cache'
import { Trophy } from 'lucide-react'
import { PageHero } from '@/components/layout/PageHero'
import { CreatorEmptyState, LeagueScopeBar } from '@/components/organizador/LeagueScope'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { ChaveamentoMataMata, type BracketRoundView, type BracketSlot, type TeamOption } from '@/components/mata-mata/ChaveamentoMataMata'
import { BotaoChaveStories } from '@/components/stories/BotaoStoriesInstagram'
import { GeradorChave } from '@/components/mata-mata/GeradorChave'
import { AgendarVagas } from '@/components/mata-mata/AgendarVagas'
import { getMataMataBracket } from '@/lib/mata-mata'
import { colunasDeVagaAtivas } from '@/lib/consulta-vaga'
import { LinksCategoriaPublica } from '@/components/portal/LinksCategoriaPublica'
import { listarCategoriasDoCampeonato } from '@/lib/categorias-do-campeonato'
import { escolherCategoria } from '@/lib/isolamento-categoria'
import { getCreatorLeagueScope } from '@/lib/league-scope'
import { isSupabaseConfigured } from '@/lib/supabase'
import { createPageMetadata } from '@/lib/seo'
import mi from '@/styles/microinteracoes.module.css'

export const metadata = createPageMetadata({
  title: 'Fase mata-mata',
  description: 'Acompanhe as chaves, confrontos e resultados das fases eliminatórias dos campeonatos de vôlei.',
  path: '/fase-mata-mata',
})

type PageProps = {
  searchParams?: Promise<{ organizador?: string; ligaId?: string; categoria?: string }>
}

export default async function FaseMataMataPage({ searchParams }: PageProps) {
  noStore()
  const params = searchParams ? await searchParams : {}
  const scope = isSupabaseConfigured ? await getCreatorLeagueScope(params) : { organizadorId: null, ligas: [], selectedLiga: null }
  const organizerMode = Boolean(scope.organizadorId && scope.selectedLiga)

  let rounds: BracketRoundView[] = []
  let champion: TeamOption | null = null
  let thirdPlace: BracketSlot | null = null
  let categoriasPublicas: { id: string; nome: string }[] = []
  let categoriaId: string | null = null
  let vagasDisponiveis = false

  if (isSupabaseConfigured && scope.selectedLiga) {
    const lista = await listarCategoriasDoCampeonato(scope.selectedLiga.id)
    categoriasPublicas = lista.categorias
    categoriaId = escolherCategoria(params.categoria, lista.categorias)
    const bracket = await getMataMataBracket(scope.selectedLiga.id, scope.selectedLiga.faseEliminatoria, organizerMode, categoriaId)
    rounds = bracket.rounds
    champion = bracket.champion
    thirdPlace = bracket.thirdPlace
    vagasDisponiveis = organizerMode && Boolean(categoriaId) && await colunasDeVagaAtivas()
  }

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <PageHero
        eyebrow={<><Trophy size={16} /> Mata-mata</>}
        title={scope.selectedLiga ? `Chaveamento - ${scope.selectedLiga.nome}` : 'Chaveamento do mata-mata'}
        description="Acompanhe os confrontos eliminatórios até a decisão do campeão."
      />

      <LeagueScopeBar ligas={scope.ligas} selected={scope.selectedLiga} organizadorId={scope.organizadorId} basePath="/fase-mata-mata" />

      <section className={`mx-auto max-w-7xl px-4 py-8 ${mi.entrar}`}>
        {scope.selectedLiga && (
          <div className="mb-6">
            <LinksCategoriaPublica
              categorias={categoriasPublicas}
              atual={categoriaId}
              href={(id) => {
                const consulta = new URLSearchParams()
                if (params.organizador) consulta.set('organizador', params.organizador)
                consulta.set('ligaId', params.ligaId || String(scope.selectedLiga.id))
                consulta.set('categoria', id)
                return `/fase-mata-mata?${consulta.toString()}`
              }}
            />
          </div>
        )}
        {scope.organizadorId && !scope.selectedLiga ? (
          <CreatorEmptyState organizadorId={scope.organizadorId} title="Nenhum campeonato selecionado." description="Escolha um campeonato para ver o chaveamento do mata-mata." />
        ) : !scope.selectedLiga ? (
          <EstadoVazio titulo="Nenhum campeonato selecionado" descricao="Acesse esta página a partir da tela de classificação de um campeonato." />
        ) : rounds.length === 0 ? (
          <EstadoVazio titulo="Sem fase eliminatória configurada" descricao="Este campeonato não tem uma fase de mata-mata configurada." />
        ) : (
          <>
            {organizerMode ? <GeradorChave ligaId={scope.selectedLiga.id} categoriaId={categoriaId} /> : null}
            {vagasDisponiveis && categoriaId ? <AgendarVagas ligaId={scope.selectedLiga.id} categoriaId={categoriaId} /> : null}
            {!organizerMode && (
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-3xl font-black text-white">Chave</h2>
                <BotaoChaveStories chave={{ rounds, thirdPlace }} campeonato={scope.selectedLiga.nome} />
              </div>
            )}
            <ChaveamentoMataMata ligaId={scope.selectedLiga.id} rounds={rounds} champion={champion} thirdPlace={thirdPlace} organizerMode={organizerMode} categoriaCampeonatoId={categoriaId} />
          </>
        )}
      </section>
    </main>
  )
}
