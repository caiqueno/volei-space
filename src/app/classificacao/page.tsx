export const dynamic = 'force-dynamic'

import { unstable_noStore as noStore } from 'next/cache'
import { BarChart3, Trophy } from 'lucide-react'
import { PageHero } from '@/components/layout/PageHero'
import { ClassificacaoTable, type ClassificacaoGroup } from '@/components/classificacao/ClassificacaoTable'
import { ScoutsGeraisTable } from '@/components/classificacao/ScoutsGeraisTable'
import { TopScoutsCards } from '@/components/classificacao/TopScoutsCards'
import { ChaveamentoMataMata, type BracketRoundView, type BracketSlot, type TeamOption } from '@/components/mata-mata/ChaveamentoMataMata'
import { PodioFinal } from '@/components/classificacao/PodioFinal'
import { CreatorEmptyState, LeagueScopeBar } from '@/components/organizador/LeagueScope'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { getChampionshipPodium, type PodiumTeam } from '@/lib/championship-podium'
import { recalculateLeagueClassification } from '@/lib/championship-operations'
import { getRequiredEliminatoryTeams } from '@/lib/eliminatorias'
import { getCreatorLeagueScope } from '@/lib/league-scope'
import { getMataMataBracket } from '@/lib/mata-mata'
import { getLeaguePlayerScouts, type PlayerScoutRow } from '@/lib/player-scouts'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const demoClassificacao = [
  { posicao: 1, equipe: { id: 1, nome: 'Kimura Vôlei', corHex: '#0F2C52', logoUrl: null }, pontos: 9, jogos: 3, vitorias: 3, derrotas: 0, setsPro: 6, setsContra: 1, pontosPro: 170, pontosContra: 132, punicoes: 0 },
  { posicao: 2, equipe: { id: 2, nome: 'Ultra Volleyball', corHex: '#EF9F27', logoUrl: null }, pontos: 7, jogos: 3, vitorias: 2, derrotas: 1, setsPro: 5, setsContra: 3, pontosPro: 164, pontosContra: 151, punicoes: 0 },
  { posicao: 3, equipe: { id: 3, nome: 'Atlética Norte', corHex: '#185FA5', logoUrl: null }, pontos: 4, jogos: 3, vitorias: 1, derrotas: 2, setsPro: 3, setsContra: 5, pontosPro: 146, pontosContra: 159, punicoes: 0 },
  { posicao: 4, equipe: { id: 4, nome: 'Arena Sul', corHex: '#1D9E75', logoUrl: null }, pontos: 1, jogos: 3, vitorias: 0, derrotas: 3, setsPro: 1, setsContra: 6, pontosPro: 128, pontosContra: 166, punicoes: 0 },
]

type PageProps = {
  searchParams?: Promise<{ organizador?: string; ligaId?: string }>
}

export default async function ClassificacaoPage({ searchParams }: PageProps) {
  noStore()
  const params = searchParams ? await searchParams : {}
  const scope = isSupabaseConfigured ? await getCreatorLeagueScope(params) : { organizadorId: null, ligas: [], selectedLiga: null }
  let dados: any[] = isSupabaseConfigured ? [] : demoClassificacao
  let groups: ClassificacaoGroup[] = []
  let manualClassifiedIds: number[] = []
  let knockoutLocked = false
  let groupStageFinished = false
  let scouts: PlayerScoutRow[] = []
  let mataMataRounds: BracketRoundView[] = []
  let mataMataChampion: TeamOption | null = null
  let mataMataThirdPlace: BracketSlot | null = null
  let podium: PodiumTeam[] = []

  if (isSupabaseConfigured) {
    if (scope.organizadorId && !scope.selectedLiga) {
      dados = []
    } else {
      if (scope.selectedLiga) {
        try {
          await recalculateLeagueClassification(scope.selectedLiga.id)
        } catch (err) {
          console.error('[classificacao] erro ao recalcular tabela', err)
        }
      }

      // ClassificacaoEntrada tem uma linha por (ligaId, equipeId), então filtrar
      // direto por ligaId já isola corretamente times que jogam em mais de uma liga.
      let query = supabase
        .from('ClassificacaoEntrada')
        .select('*, equipe:Equipe(id,nome,corHex,logoUrl,ligaId)')
        .order('posicao', { ascending: true })

      if (scope.selectedLiga) query = query.eq('ligaId', scope.selectedLiga.id)

      const { data } = await query
      dados = data ?? []

      if (scope.selectedLiga) {
        const [
          { data: manualRows },
          { count: knockoutCount },
          { data: groupRows },
          { data: groupLinks },
          { count: totalGruposCount },
          { count: finishedGruposCount },
          scoutsResult,
        ] = await Promise.all([
          supabase
            .from('ClassificacaoEliminatoria')
            .select('equipeId')
            .eq('ligaId', scope.selectedLiga.id)
            .then((result) => result.error ? { data: [] } : result),
          supabase
            .from('Partida')
            .select('id', { count: 'exact', head: true })
            .eq('ligaId', scope.selectedLiga.id)
            .not('fase', 'is', null)
            .neq('fase', 'GRUPOS'),
          supabase
            .from('GrupoCampeonato')
            .select('id,nome,ordem,classificados')
            .eq('ligaId', scope.selectedLiga.id)
            .order('ordem', { ascending: true })
            .then((result) => result.error ? { data: [] } : result),
          supabase
            .from('GrupoEquipeCampeonato')
            .select('grupoId,equipeId,posicao')
            .eq('ligaId', scope.selectedLiga.id)
            .then((result) => result.error ? { data: [] } : result),
          supabase
            .from('Partida')
            .select('id', { count: 'exact', head: true })
            .eq('ligaId', scope.selectedLiga.id)
            .eq('fase', 'GRUPOS'),
          supabase
            .from('Partida')
            .select('id', { count: 'exact', head: true })
            .eq('ligaId', scope.selectedLiga.id)
            .eq('fase', 'GRUPOS')
            .in('status', ['ENCERRADA', 'WO']),
          getLeaguePlayerScouts(scope.selectedLiga.id).catch((err) => {
            console.error('[classificacao] erro ao calcular scouts gerais', err)
            return [] as PlayerScoutRow[]
          }),
        ])

        scouts = scoutsResult
        manualClassifiedIds = (manualRows ?? []).map((row: any) => Number(row.equipeId))
        knockoutLocked = (knockoutCount ?? 0) > 0
        groupStageFinished = (totalGruposCount ?? 0) > 0 && totalGruposCount === finishedGruposCount
        groups = buildClassificationGroups(
          dados,
          groupRows ?? [],
          groupLinks ?? [],
          Number(scope.selectedLiga.classificadosPorGrupo ?? 0),
        )

        if (knockoutLocked) {
          const bracket = await getMataMataBracket(scope.selectedLiga.id, scope.selectedLiga.faseEliminatoria, Boolean(scope.organizadorId))
          mataMataRounds = bracket.rounds
          mataMataChampion = bracket.champion
          mataMataThirdPlace = bracket.thirdPlace
        }

        podium = await getChampionshipPodium(scope.selectedLiga.id)
      }
    }
  }

  const equipeInfoById = new Map<number, { nome: string; corHex: string | null; logoUrl: string | null }>()
  for (const entrada of dados) {
    if (entrada.equipe?.id != null) {
      equipeInfoById.set(Number(entrada.equipe.id), {
        nome: entrada.equipe.nome,
        corHex: entrada.equipe.corHex,
        logoUrl: entrada.equipe.logoUrl,
      })
    }
  }

  const lider = dados[0]
  const requiredClassified = getRequiredEliminatoryTeams(scope.selectedLiga?.faseEliminatoria)
  const automaticLimit = Math.min(
    requiredClassified || 4,
    Number(scope.selectedLiga?.quantidadeGrupos ?? 1) * Number(scope.selectedLiga?.classificadosPorGrupo ?? 0),
  )

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <PageHero
        eyebrow={<><BarChart3 size={16} /> Classificação geral</>}
        title={scope.selectedLiga ? `Tabela - ${scope.selectedLiga.nome}` : 'Tabela da liga'}
        description={scope.organizadorId ? 'Filtre a classificação por campeonato criado na sua conta.' : 'Pontos, vitórias, saldo de sets, punições e campanha da categoria Masculino Ouro.'}
        aside={
          <div className="luva-surface rounded-2xl p-5">
            <p className="luva-kicker flex items-center gap-2"><Trophy size={16} /> Líder</p>
            <p className="mt-3 font-display text-2xl font-black text-white">{lider?.equipe?.nome ?? 'A definir'}</p>
            <p className="mt-1 text-sm font-bold text-slate-200">{lider ? `${lider.pontos} pontos em ${lider.jogos} jogos` : 'Sem jogos registrados'}</p>
          </div>
        }
      />

      <LeagueScopeBar ligas={scope.ligas} selected={scope.selectedLiga} organizadorId={scope.organizadorId} basePath="/classificacao" />

      <section className="mx-auto max-w-7xl px-4 py-8">
        {scope.organizadorId && !scope.selectedLiga ? (
          <CreatorEmptyState organizadorId={scope.organizadorId} title="Nenhum campeonato para classificar." description="Crie um campeonato no painel do criador. A tabela ficará vazia até equipes, jogos e resultados serem registrados." />
        ) : dados.length === 0 ? (
          <EstadoVazio titulo="Nenhuma partida registrada" descricao="A classificação aparecerá aqui após o primeiro resultado aprovado." />
        ) : (
          <>
            {podium.length > 0 && (
              <div className="mb-10">
                <p className="luva-kicker">Resultado final</p>
                <h2 className="mt-2 font-display text-2xl font-black text-white">Pódio do campeonato</h2>
                <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                  <PodioFinal podium={podium} variant="default" />
                </div>
              </div>
            )}
            {mataMataRounds.length > 0 && (
              <div className="mb-10">
                <p className="luva-kicker">Mata-mata</p>
                <h2 className="mt-2 font-display text-2xl font-black text-white">Chaveamento eliminatório</h2>
                <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <ChaveamentoMataMata
                    ligaId={scope.selectedLiga!.id}
                    rounds={mataMataRounds}
                    champion={mataMataChampion}
                    thirdPlace={mataMataThirdPlace}
                    organizerMode={Boolean(scope.organizadorId && scope.selectedLiga)}
                  />
                </div>
              </div>
            )}
            {scope.selectedLiga && (
              <div className="mb-10 grid gap-5">
                <TopScoutsCards dados={scouts} equipeInfoById={equipeInfoById} />
                <ScoutsGeraisTable dados={scouts} equipeInfoById={equipeInfoById} />
              </div>
            )}
            <ClassificacaoTable
              dados={dados as any}
              groups={groups}
              ligaId={scope.selectedLiga?.id}
              requiredClassified={requiredClassified}
              automaticLimit={requiredClassified > 0 ? automaticLimit : 0}
              initialManualClassifiedIds={manualClassifiedIds}
              organizerMode={Boolean(scope.organizadorId && scope.selectedLiga)}
              organizadorId={scope.organizadorId}
              locked={knockoutLocked}
              groupStageFinished={groupStageFinished}
            />
            <div className="mt-4 grid gap-3 text-xs font-black uppercase tracking-[0.12em] sm:grid-cols-2 lg:grid-cols-4">
              <span className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">P = pontos</span>
              <span className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">J, V, D = jogos, vitórias, derrotas</span>
              <span className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">DS = saldo de sets</span>
              <span className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-100">DP = saldo de pontos</span>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

function buildClassificationGroups(dados: any[], groupRows: any[], groupLinks: any[], defaultClassifiedPerGroup: number) {
  if (!groupRows.length || !groupLinks.length) return []

  const groupById = new Map<number, ClassificacaoGroup>()
  const linkByTeam = new Map<number, any>()

  groupRows.forEach((group) => {
    groupById.set(Number(group.id), {
      id: String(group.id),
      nome: String(group.nome || 'Grupo'),
      dados: [],
      automaticLimit: Number(group.classificados ?? defaultClassifiedPerGroup ?? 0),
    })
  })

  groupLinks.forEach((link) => {
    linkByTeam.set(Number(link.equipeId), link)
  })

  dados.forEach((entrada) => {
    const link = linkByTeam.get(Number(entrada.equipe?.id))
    const group = link ? groupById.get(Number(link.grupoId)) : null
    if (group) group.dados.push(entrada)
  })

  return Array.from(groupById.values()).filter((group) => group.dados.length > 0)
}
