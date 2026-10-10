export const dynamic = 'force-dynamic'

import { unstable_noStore as noStore } from 'next/cache'
import { CalendarDays, RotateCcw } from 'lucide-react'
import { PageHero } from '@/components/layout/PageHero'
import { PartidaCard } from '@/components/partidas/PartidaCard'
import { buscarAgendaCampeonato } from '@/lib/agenda-publica'
import { JogosPublicos } from '@/components/portal/JogosPublicos'
import { PortalAgenda } from '@/components/portal/PortalAgenda'
import { CreatorEmptyState, LeagueScopeBar } from '@/components/organizador/LeagueScope'
import { CollapseBar } from '@/components/ui/collapse-bar'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { FASES_ELIMINATORIAS, formatEliminatoryPhase, getRequiredEliminatoryTeams } from '@/lib/eliminatorias'
import { formatCategoriaLabel } from '@/lib/equipe-categoria'
import { getCreatorLeagueScope } from '@/lib/league-scope'
import { isSupabaseConfigured } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PARTIDA_PUBLICA_COLUNAS } from '@/lib/partida-publica'
import { ensureEquipeForCandidatura } from '@/lib/team-activation'
import { createPageMetadata } from '@/lib/seo'
import mi from '@/styles/microinteracoes.module.css'

export const metadata = createPageMetadata({
  title: 'Jogos de vôlei',
  description: 'Veja a agenda, os confrontos, horários, locais, placares e resultados dos campeonatos de vôlei.',
  path: '/jogos',
})

const equipes = [
  { id: 1, nome: 'Kimura Vôlei', corHex: '#0F2C52' },
  { id: 2, nome: 'Ultra Volleyball', corHex: '#EF9F27' },
  { id: 3, nome: 'Atlética Norte', corHex: '#185FA5' },
  { id: 4, nome: 'Arena Sul', corHex: '#1D9E75' },
]

const demoPartidas = [
  { id: 1, rodada: 1, status: 'AGENDADA', dataHora: new Date().toISOString(), localNome: 'Arena volei.space', equipeA: equipes[0], equipeB: equipes[1], setsPorA: null, setsPorB: null, sets: [], sumulaToken: 'token-demo-1-luv2026' },
  { id: 2, rodada: 1, status: 'ENCERRADA', dataHora: new Date(Date.now() - 86400000).toISOString(), localNome: 'Ginásio Central', equipeA: equipes[2], equipeB: equipes[3], setsPorA: 2, setsPorB: 1, sets: [{ numero: 1, pontosA: 25, pontosB: 21 }, { numero: 2, pontosA: 22, pontosB: 25 }, { numero: 3, pontosA: 15, pontosB: 12 }], sumulaToken: 'token-demo-1-luva2026' },
  { id: 3, rodada: 2, status: 'AGENDADA', dataHora: new Date(Date.now() + 172800000).toISOString(), localNome: 'Arena Norte', equipeA: equipes[0], equipeB: equipes[3], setsPorA: null, setsPorB: null, sets: [], sumulaToken: 'token-demo-1-luv2026' },
]

type PageProps = {
  searchParams?: Promise<{ organizador?: string; ligaId?: string; candidaturaId?: string; filtro?: string; pagina?: string }>
}

export default async function JogosPage({ searchParams }: PageProps) {
  noStore()
  const params = searchParams ? await searchParams : {}
  if (!params.candidaturaId && !params.ligaId) return <JogosPublicos filtro={params.filtro} pagina={params.pagina} />
  const retryParams = new URLSearchParams()
  if (params.organizador) retryParams.set('organizador', params.organizador)
  if (params.ligaId) retryParams.set('ligaId', params.ligaId)
  if (params.candidaturaId) retryParams.set('candidaturaId', params.candidaturaId)
  const retryHref = `/jogos${retryParams.toString() ? `?${retryParams.toString()}` : ''}`

  let scope = { organizadorId: null as string | null, ligas: [] as any[], selectedLiga: null as any | null }
  let partidas = isSupabaseConfigured ? [] as any[] : demoPartidas as any[]
  let totalPartidas = 0
  let agenda: { aoVivo: any[]; proximos: any[]; encerradas: any[]; analise: any[]; outras: any[] } | null = null
  let temMais = { aoVivo: false, proximos: false, encerradas: false }
  let equipeCapitao: any | null = null
  let loadError = false
  let escolherCampeonato = false

  if (isSupabaseConfigured) {
    try {
      scope = await getCreatorLeagueScope(params)
      if (params.candidaturaId) {
        equipeCapitao = await ensureEquipeForCandidatura(params.candidaturaId)
        if (equipeCapitao) {
          let query = supabaseAdmin
            .from('Partida')
            .select(`${PARTIDA_PUBLICA_COLUNAS},liga:Liga!Partida_ligaId_fkey(id,nome,simulacao)`)
            .or(`equipeAId.eq.${equipeCapitao.id},equipeBId.eq.${equipeCapitao.id}`)
            .order('rodada', { ascending: true })
            .order('dataHora', { ascending: true })

          if (params.ligaId) query = query.eq('ligaId', Number(params.ligaId))
          query = query.limit(24)

          const { data, error } = await query
          if (error) throw error
          partidas = normalizePartidas(data).filter((partida) => partida.liga?.simulacao !== true)
        } else {
          partidas = []
        }
      } else if (scope.organizadorId && !scope.selectedLiga) {
        partidas = []
      } else if (scope.selectedLiga) {
        const busca = await buscarAgendaCampeonato(scope.selectedLiga.id, { campeonatoInformado: Boolean(params.ligaId) })
        if (busca.erro) throw new Error('agenda')
        const contagem = await supabaseAdmin.from('Partida').select('id', { count: 'exact', head: true }).eq('ligaId', scope.selectedLiga.id)
        totalPartidas = contagem.count ?? 0
        agenda = { aoVivo: busca.aoVivo.partidas, proximos: busca.proximos.partidas, encerradas: busca.encerradas.partidas, analise: [], outras: [] }
        temMais = { aoVivo: busca.aoVivo.temMais, proximos: busca.proximos.temMais, encerradas: busca.encerradas.temMais }
        partidas = [...agenda.aoVivo, ...agenda.proximos, ...agenda.encerradas]
      } else {
        escolherCampeonato = true
        partidas = []
      }
    } catch (err) {
      console.error('[jogos] erro ao carregar partidas', err)
      loadError = true
      partidas = []
    }
  }

  const tabelas = buildGameTree(partidas)
  const totalRodadas = tabelas.reduce((total, tabela) => total + tabela.rodadas.length, 0)

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <PageHero
        eyebrow={<><CalendarDays size={16} /> Calendário oficial</>}
        title={equipeCapitao ? `Jogos de ${equipeCapitao.nome}` : scope.selectedLiga ? `Jogos de ${scope.selectedLiga.nome}` : 'Jogos do campeonato'}
        description={equipeCapitao ? 'Agenda das partidas da sua equipe.' : scope.organizadorId ? 'Agenda dos campeonatos da sua conta.' : 'Rodadas, horários, locais e placares do campeonato.'}
        aside={
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Partidas" value={totalPartidas || partidas.length} />
            <Metric label="Rodadas" value={totalRodadas} />
            <Metric label="Locais" value={new Set(partidas.map((p) => p.localNome).filter(Boolean)).size} />
          </div>
        }
      />

      {!equipeCapitao && <LeagueScopeBar ligas={scope.ligas} selected={scope.selectedLiga} organizadorId={scope.organizadorId} basePath="/jogos" />}

      <section className="mx-auto max-w-7xl px-4 py-8">
        {scope.organizadorId && !scope.selectedLiga ? (
          <CreatorEmptyState organizadorId={scope.organizadorId} title="Nenhum campeonato com agenda." description="Crie um campeonato no painel do criador. Os jogos ficarão vazios até você montar as rodadas." />
        ) : loadError ? (
          <EstadoVazio
            titulo="Não foi possível carregar os jogos"
            descricao="Tivemos uma falha temporária ao buscar a agenda. Tente novamente em instantes."
            acao={
              <a href={retryHref} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ffb331]">
                <RotateCcw size={16} />
                Tentar novamente
              </a>
            }
          />
        ) : escolherCampeonato ? (
          <EstadoVazio titulo="Escolha um campeonato" descricao="A agenda abre dentro do campeonato, sem carregar os jogos de todas as competições." acao={<a href="/portal" className="inline-flex rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950">Ir ao portal</a>} />
        ) : agenda && scope.selectedLiga ? (
          <PortalAgenda ligaId={scope.selectedLiga.id} inicial={agenda} temMaisInicial={temMais} falhaInicial={false} />
        ) : partidas.length === 0 ? (
          <EstadoVazio titulo={equipeCapitao ? 'Nenhum jogo para sua equipe' : 'Nenhum jogo cadastrado'} descricao={equipeCapitao ? 'As partidas do seu time aparecerão aqui quando o campeonato montar o calendário.' : 'As partidas aparecerão aqui quando a organização montar o calendário.'} />
        ) : !scope.selectedLiga && !equipeCapitao ? (
          <div className="grid gap-8">
            <GradeJogos titulo="Em andamento" partidas={partidas.filter((partida) => partida.status === 'EM_ANDAMENTO')} />
            <GradeJogos titulo="Próximos jogos" partidas={partidas.filter((partida) => partida.status === 'AGENDADA' || partida.status === 'PENDENTE')} />
            <GradeJogos titulo="Resultados" partidas={partidas.filter((partida) => partida.status === 'ENCERRADA' || partida.status === 'WO')} />
          </div>
        ) : (
          <>
            {tabelas.map((tabela) => (
              <CollapseBar key={tabela.key} title={tabela.nome}>
                <div className="grid gap-3 border-l border-white/10 pl-4 sm:pl-6">
                  {tabela.rodadas.map((rodada) => (
                    <CollapseBar key={rodada.key} title={rodada.title}>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {rodada.partidas.map((partida) => <PartidaCard key={partida.id} partida={partida} />)}
                      </div>
                    </CollapseBar>
                  ))}
                  {tabela.fases.map((fase) => (
                    <CollapseBar key={fase.key} title={fase.title}>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {fase.partidas.map((partida) => (
                          <PartidaCard key={partida.id} partida={partida} roundLabel={fase.partidas.length > 1 ? `${fase.title} · Jogo ${partida.rodada}` : fase.title} />
                        ))}
                      </div>
                    </CollapseBar>
                  ))}
                </div>
              </CollapseBar>
            ))}
          </>
        )}
      </section>
    </main>
  )
}

function GradeJogos({ titulo, partidas }: { titulo: string; partidas: any[] }) {
  if (partidas.length === 0) return null
  const primeiros = partidas.slice(0, 8)
  const resto = partidas.slice(8)
  return (
    <section>
      <h2 className="font-display text-2xl font-black text-white">{titulo}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {primeiros.map((partida, index) => <PartidaCard key={`${titulo}-${partida.id}`} partida={partida} atraso={`${Math.min(index, 8) * 30}ms`} />)}
      </div>
      {resto.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-black text-[#ffb331]">Ver mais {resto.length} jogos</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resto.map((partida) => <PartidaCard key={`${titulo}-mais-${partida.id}`} partida={partida} />)}
          </div>
        </details>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4 text-center shadow-sm backdrop-blur-xl">
      <p className={`type-stat ${mi.numero}`}>{value}</p>
      <p className="type-kicker mt-1">{label}</p>
    </div>
  )
}

function normalizePartidas(data: any[] | null) {
  return (data ?? []).filter((partida) => {
    const valida = Boolean(
      partida
      && Number.isFinite(Number(partida.id))
      && Number.isFinite(Number(partida.rodada))
      && partida.equipeA?.id
      && partida.equipeB?.id,
    )

    if (!valida) console.error('[jogos] partida incompleta ignorada', partida?.id)
    return valida
  }).map((partida) => {
    const liga = Array.isArray(partida.liga) ? partida.liga[0] : partida.liga
    return {
      ...partida,
      id: Number(partida.id),
      rodada: Number(partida.rodada),
      liga: liga ?? null,
      ligaId: Number(partida.ligaId ?? liga?.id ?? 0),
      dataHora: normalizeDateValue(partida.dataHora),
      sets: Array.isArray(partida.sets) ? partida.sets : [],
    }
  })
}

type RoundGroup = {
  key: string
  title: string
  partidas: any[]
  ordem: number
}

type TabelaTree = {
  key: string
  nome: string
  rodadas: RoundGroup[]
  fases: RoundGroup[]
}

function buildGameTree(partidas: any[]): TabelaTree[] {
  const knockoutFases = new Set<string>(FASES_ELIMINATORIAS.filter((fase) => fase !== 'NENHUMA'))
  const categoriasPorLiga = new Map<number, Set<string>>()
  for (const partida of partidas) {
    const ligaId = Number(partida.ligaId ?? 0)
    const categorias = categoriasPorLiga.get(ligaId) ?? new Set<string>()
    categorias.add(categoryKey(partida))
    categoriasPorLiga.set(ligaId, categorias)
  }

  const tabelas = new Map<string, TabelaTree>()
  for (const partida of partidas) {
    const ligaId = Number(partida.ligaId ?? 0)
    const categoria = categoryKey(partida)
    const key = `${ligaId}:${categoria}`
    const nomeCampeonato = partida.liga?.nome || 'Campeonato'
    const varias = (categoriasPorLiga.get(ligaId)?.size ?? 0) > 1
    const [cat, serie] = categoria.split(':')
    const nome = varias
      ? `${nomeCampeonato} · ${formatCategoriaLabel(cat, serie === 'UNICA' ? null : serie)}`
      : nomeCampeonato
    const tabela = tabelas.get(key) ?? { key, nome, rodadas: [], fases: [] }
    const fase = String(partida.fase ?? '')
    const destino = knockoutFases.has(fase) ? tabela.fases : tabela.rodadas
    const roundKey = knockoutFases.has(fase) ? `${key}:${fase}` : `${key}:${partida.rodada}`
    const roundTitle = knockoutFases.has(fase) ? formatEliminatoryPhase(fase) : `Rodada ${partida.rodada}`
    const ordem = knockoutFases.has(fase) ? getRequiredEliminatoryTeams(fase) : Number(partida.rodada)
    const grupo = destino.find((item) => item.key === roundKey) ?? { key: roundKey, title: roundTitle, partidas: [], ordem }
    if (!destino.includes(grupo)) destino.push(grupo)
    grupo.partidas.push(partida)
    tabelas.set(key, tabela)
  }

  return Array.from(tabelas.values())
    .map((tabela) => ({
      ...tabela,
      rodadas: [...tabela.rodadas].sort((a, b) => a.ordem - b.ordem),
      fases: [...tabela.fases].sort((a, b) => b.ordem - a.ordem),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function categoryKey(partida: any) {
  return `${partida.categoria || 'GERAL'}:${partida.serie || 'UNICA'}`
}

function normalizeDateValue(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
