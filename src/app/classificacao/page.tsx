export const dynamic = 'force-dynamic'

import { unstable_noStore as noStore } from 'next/cache'
import { BarChart3, Trophy } from 'lucide-react'
import { PageHero } from '@/components/layout/PageHero'
import { type ClassificacaoGroup } from '@/components/classificacao/ClassificacaoTable'
import { ChampionshipTableSection } from '@/components/classificacao/ChampionshipTableSection'
import { ScoutsGeraisTable } from '@/components/classificacao/ScoutsGeraisTable'
import { TopScoutsCards } from '@/components/classificacao/TopScoutsCards'
import { ChaveamentoMataMata, type BracketRoundView, type BracketSlot, type TeamOption } from '@/components/mata-mata/ChaveamentoMataMata'
import { PodioFinal } from '@/components/classificacao/PodioFinal'
import { CreatorEmptyState, LeagueScopeBar } from '@/components/organizador/LeagueScope'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { getChampionshipPodium, type PodiumTeam } from '@/lib/championship-podium'
import { getRequiredEliminatoryTeams } from '@/lib/eliminatorias'
import { getCreatorLeagueScope } from '@/lib/league-scope'
import { getMataMataBracket } from '@/lib/mata-mata'
import { getLeaguePlayerScouts, type PlayerScoutRow } from '@/lib/player-scouts'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { formatCategoriaLabel } from '@/lib/equipe-categoria'
import { formatoPulaClassificacao } from '@/lib/championship-setup-status'
import { createPageMetadata } from '@/lib/seo'

export const metadata = createPageMetadata({
  title: 'Classificação dos campeonatos',
  description: 'Consulte tabelas, pontuação, vitórias, sets, destaques e classificação dos campeonatos de vôlei.',
  path: '/classificacao',
})

const demoClassificacao = [
  { posicao: 1, equipe: { id: 1, nome: 'Kimura Vôlei', corHex: '#0F2C52', logoUrl: null }, pontos: 9, jogos: 3, vitorias: 3, derrotas: 0, setsPro: 6, setsContra: 1, pontosPro: 170, pontosContra: 132, punicoes: 0 },
  { posicao: 2, equipe: { id: 2, nome: 'Ultra Volleyball', corHex: '#EF9F27', logoUrl: null }, pontos: 7, jogos: 3, vitorias: 2, derrotas: 1, setsPro: 5, setsContra: 3, pontosPro: 164, pontosContra: 151, punicoes: 0 },
  { posicao: 3, equipe: { id: 3, nome: 'Atlética Norte', corHex: '#185FA5', logoUrl: null }, pontos: 4, jogos: 3, vitorias: 1, derrotas: 2, setsPro: 3, setsContra: 5, pontosPro: 146, pontosContra: 159, punicoes: 0 },
  { posicao: 4, equipe: { id: 4, nome: 'Arena Sul', corHex: '#1D9E75', logoUrl: null }, pontos: 1, jogos: 3, vitorias: 0, derrotas: 3, setsPro: 1, setsContra: 6, pontosPro: 128, pontosContra: 166, punicoes: 0 },
]

type PageProps = {
  searchParams?: Promise<{ organizador?: string; ligaId?: string; categoria?: string; serie?: string }>
}

export default async function ClassificacaoPage({ searchParams }: PageProps) {
  noStore()
  const params = searchParams ? await searchParams : {}
  const categoriaFiltro = params.categoria?.trim() || null
  const serieFiltro = params.serie?.trim() || null
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
  let championshipTables: ChampionshipTable[] = []

  if (isSupabaseConfigured) {
    if (scope.organizadorId && !scope.selectedLiga) {
      dados = []
    } else if (!scope.selectedLiga) {
      dados = []
    } else {
      // ClassificacaoEntrada tem uma linha por (ligaId, equipeId), então filtrar
      // direto por ligaId já isola corretamente times que jogam em mais de uma liga.
      let query = supabase
        .from('ClassificacaoEntrada')
        .select('*, categoriaCampeonato:CategoriaCampeonato(id,nome), equipe:Equipe(id,nome,corHex,logoUrl,ligaId,categoria,categoriaCampeonatoId)')
        .order('posicao', { ascending: true })

      if (scope.selectedLiga) query = query.eq('ligaId', scope.selectedLiga.id)

      const { data } = await query
      dados = data ?? []

      // Filtro opcional por categoria/série (badges do card de campeonato na
      // home do organizador) — só afeta a tabela principal de classificação
      // (e, por consequência, os grupos calculados a partir dela). Mata-mata,
      // pódio e scouts continuam por liga inteira: essas visões não têm hoje
      // um recorte por categoria no modelo de dados, e não é papel desta
      // tarefa inventar um — nenhuma regra de cálculo muda, só a listagem.
      if (categoriaFiltro) {
        dados = dados.filter((entrada: any) => {
          const equipeCategoria = entrada.equipe?.categoria ?? null
          const equipeSerie = entrada.equipe?.serie ?? null
          if (equipeCategoria !== categoriaFiltro) return false
          if (serieFiltro && equipeSerie !== serieFiltro) return false
          return true
        })
      }

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

      if (!formatoPulaClassificacao(scope.selectedLiga.formato)) {
        championshipTables = [{
          id: scope.selectedLiga.id,
          nome: scope.selectedLiga.nome,
          dados,
          groups: groups.length ? groups : categoryGroups(dados, parseCriterios(scope.selectedLiga.criteriosClassificacao)),
          regra: REGRA_VIGENTE,
        }]
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

  const semTabela = formatoPulaClassificacao(scope.selectedLiga?.formato)
  const lider = semTabela ? undefined : dados[0]
  const requiredClassified = getRequiredEliminatoryTeams(scope.selectedLiga?.faseEliminatoria)
  const automaticLimit = Math.min(
    requiredClassified || 4,
    Number(scope.selectedLiga?.quantidadeGrupos ?? 1) * Number(scope.selectedLiga?.classificadosPorGrupo ?? 0),
  )

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <PageHero
        eyebrow={<><BarChart3 size={16} /> Classificação geral</>}
        title={championshipTables.length > 1 ? 'Tabelas dos campeonatos' : scope.selectedLiga ? `Tabela de ${scope.selectedLiga.nome}` : 'Tabela do campeonato'}
        description={
          championshipTables.length > 1
            ? 'Cada campeonato fica na própria tabela, só com as equipes e os jogos daquela competição.'
            : categoriaFiltro
            ? `Categoria ${formatCategoriaLabel(categoriaFiltro, serieFiltro)} de ${scope.selectedLiga?.nome ?? 'campeonato'}.`
            : semTabela
              ? 'Este campeonato é mata-mata. A campanha fica na chave, sem tabela de pontos.'
            : scope.organizadorId
              ? 'Filtre a classificação pelo campeonato da sua conta.'
              : 'Pontos, vitórias, saldo de sets e campanha das equipes.'
        }
        aside={
          <div className="luva-surface rounded-2xl p-5">
            <p className="luva-kicker flex items-center gap-2"><Trophy size={16} /> Líder</p>
            <p className="mt-3 font-display text-2xl font-black text-white">{championshipTables.length > 1 ? `${championshipTables.length} campeonatos` : lider?.equipe?.nome ?? 'A definir'}</p>
            <p className="mt-1 text-sm font-bold text-slate-200">{championshipTables.length > 1 ? 'Tabelas separadas pela regra de cada um.' : lider ? `${lider.pontos} pontos em ${lider.jogos} jogos` : 'Sem jogos registrados'}</p>
          </div>
        }
      />

      <LeagueScopeBar ligas={scope.ligas} selected={scope.selectedLiga} organizadorId={scope.organizadorId} basePath="/classificacao" />

      <section className="mx-auto max-w-7xl px-4 py-8">
        {scope.organizadorId && !scope.selectedLiga ? (
          <CreatorEmptyState organizadorId={scope.organizadorId} title="Nenhum campeonato para classificar." description="Crie um campeonato no painel do criador. A tabela ficará vazia até equipes, jogos e resultados serem registrados." />
        ) : !scope.selectedLiga ? (
          <EstadoVazio titulo="Escolha um campeonato" descricao="A classificação abre dentro do campeonato." acao={<a href="/portal" className="inline-flex rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950">Ir ao portal</a>} />
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
            {championshipTables.map((table) => (
              <ChampionshipTableSection
                key={table.id}
                nome={table.nome}
                regra={table.regra}
                dados={table.dados as any}
                groups={table.groups}
                ligaId={table.id}
                requiredClassified={championshipTables.length > 1 ? 0 : requiredClassified}
                automaticLimit={championshipTables.length > 1 ? 0 : requiredClassified > 0 ? automaticLimit : 0}
                initialManualClassifiedIds={championshipTables.length > 1 ? [] : manualClassifiedIds}
                organizerMode={Boolean(scope.organizadorId && scope.selectedLiga && scope.selectedLiga.id === table.id)}
                organizadorId={scope.organizadorId}
                locked={knockoutLocked}
                groupStageFinished={groupStageFinished}
              />
            ))}
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

type ChampionshipTable = {
  id: number
  nome: string
  dados: any[]
  groups: ClassificacaoGroup[]
  regra: string
}

const REGRA_VIGENTE = 'Vitória por 2 sets a 0 vale 3 pontos. Vitória por 2 sets a 1 vale 2 pontos para o vencedor e 1 para o perdedor.'

const CLASSIFICATION_SELECT = '*, categoriaCampeonato:CategoriaCampeonato(id,nome), equipe:Equipe(id,nome,corHex,logoUrl,ligaId,categoria,categoriaCampeonatoId)'

async function loadChampionshipTables(): Promise<ChampionshipTable[]> {
  const { data: ligas, error } = await supabase
    .from('Liga')
    .select('id,nome,formato,criteriosClassificacao')
    .eq('simulacao', false)
    .in('status', ['ATIVA', 'EM_BREVE', 'ENCERRADA'])
    .order('nome', { ascending: true })

  if (error || !ligas?.length) {
    if (error) console.error('[classificacao] erro ao listar campeonatos', error)
    return []
  }

  const ids = ligas.map((liga) => liga.id)
  const { data, error: rowsError } = await supabase
    .from('ClassificacaoEntrada')
    .select(CLASSIFICATION_SELECT)
    .in('ligaId', ids)
    .order('posicao', { ascending: true })

  if (rowsError) {
    console.error('[classificacao] erro ao ler tabelas', rowsError)
    return []
  }

  const byLiga = new Map<number, any[]>()
  for (const row of data ?? []) {
    const ligaId = Number(row.ligaId)
    const list = byLiga.get(ligaId) ?? []
    list.push(row)
    byLiga.set(ligaId, list)
  }

  return ligas.flatMap((liga) => {
    const rows = byLiga.get(liga.id) ?? []
    if (!rows.length || formatoPulaClassificacao(liga.formato)) return []
    return [{
      id: liga.id,
      nome: liga.nome,
      dados: rows,
      groups: categoryGroups(rows, parseCriterios(liga.criteriosClassificacao)),
      regra: REGRA_VIGENTE,
    }]
  })
}

function parseCriterios(raw: string | null | undefined) {
  if (!raw) return ['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS']
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.map(String) : ['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS']
  } catch {
    return ['PONTOS', 'VITORIAS', 'SALDO_SETS', 'SALDO_PONTOS']
  }
}

function categoryGroups(dados: any[], criterios: string[]): ClassificacaoGroup[] {
  const buckets = new Map<string, any[]>()
  for (const row of dados) {
    const categoriaId = String(row.categoriaCampeonatoId || row.equipe?.categoriaCampeonatoId || row.categoria || 'GERAL')
    const key = categoriaId
    const list = buckets.get(key) ?? []
    list.push(row)
    buckets.set(key, list)
  }

  if (buckets.size <= 1) return []

  return Array.from(buckets.entries()).map(([key, rows]) => {
    const nome = rows[0]?.categoriaCampeonato?.nome || formatCategoriaLabel(String(rows[0]?.categoria || rows[0]?.equipe?.categoria || 'Categoria'), null)
    return {
      id: key,
      nome,
      dados: [...rows].sort((a, b) => compareClassificacao(a, b, criterios)),
      automaticLimit: 0,
    }
  })
}

function compareClassificacao(a: any, b: any, criterios: string[]) {
  for (const criterio of criterios) {
    const left = classificationMetric(a, criterio)
    const right = classificationMetric(b, criterio)
    const diff = criterio === 'DERROTAS' ? left - right : right - left
    if (diff) return diff
  }
  return 0
}

function classificationMetric(entrada: any, criterio: string) {
  if (criterio === 'PONTOS') return Number(entrada.pontos ?? 0)
  if (criterio === 'VITORIAS') return Number(entrada.vitorias ?? 0)
  if (criterio === 'DERROTAS') return Number(entrada.derrotas ?? 0)
  if (criterio === 'SALDO_SETS') return Number(entrada.setsPro ?? 0) - Number(entrada.setsContra ?? 0)
  if (criterio === 'SALDO_PONTOS') return Number(entrada.pontosPro ?? 0) - Number(entrada.pontosContra ?? 0)
  if (criterio === 'SETS_PRO') return Number(entrada.setsPro ?? 0)
  if (criterio === 'PONTOS_PRO') return Number(entrada.pontosPro ?? 0)
  return 0
}
