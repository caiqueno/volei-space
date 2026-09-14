export const dynamic = 'force-dynamic'

import { unstable_noStore as noStore } from 'next/cache'
import { CalendarDays, MapPin, Radio, RotateCcw, Trophy } from 'lucide-react'
import { PageHero } from '@/components/layout/PageHero'
import { PartidaCard } from '@/components/partidas/PartidaCard'
import { PartidasAbertasArbitro } from '@/components/arbitro/PartidasAbertasArbitro'
import { CreatorEmptyState, LeagueScopeBar } from '@/components/organizador/LeagueScope'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { FASES_ELIMINATORIAS, formatEliminatoryPhase, getRequiredEliminatoryTeams } from '@/lib/eliminatorias'
import { getCreatorLeagueScope } from '@/lib/league-scope'
import { isSupabaseConfigured } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ensureEquipeForCandidatura } from '@/lib/team-activation'
import { createPageMetadata } from '@/lib/seo'

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
  searchParams?: Promise<{ organizador?: string; ligaId?: string; candidaturaId?: string }>
}

export default async function JogosPage({ searchParams }: PageProps) {
  noStore()
  const params = searchParams ? await searchParams : {}
  const retryParams = new URLSearchParams()
  if (params.organizador) retryParams.set('organizador', params.organizador)
  if (params.ligaId) retryParams.set('ligaId', params.ligaId)
  if (params.candidaturaId) retryParams.set('candidaturaId', params.candidaturaId)
  const retryHref = `/jogos${retryParams.toString() ? `?${retryParams.toString()}` : ''}`

  let scope = { organizadorId: null as string | null, ligas: [] as any[], selectedLiga: null as any | null }
  let partidas = isSupabaseConfigured ? [] as any[] : demoPartidas as any[]
  let equipeCapitao: any | null = null
  let loadError = false

  if (isSupabaseConfigured) {
    try {
      scope = await getCreatorLeagueScope(params)
      if (params.candidaturaId) {
        equipeCapitao = await ensureEquipeForCandidatura(params.candidaturaId)
        if (equipeCapitao) {
          let query = supabaseAdmin
            .from('Partida')
            .select('id,rodada,fase,status,dataHora,localNome,setsPorA,setsPorB,equipeA:Equipe!equipeAId(id,nome,corHex),equipeB:Equipe!equipeBId(id,nome,corHex),sets:SetPartida(numero,pontosA,pontosB)')
            .or(`equipeAId.eq.${equipeCapitao.id},equipeBId.eq.${equipeCapitao.id}`)
            .order('rodada', { ascending: true })
            .order('dataHora', { ascending: true })

          if (params.ligaId) query = query.eq('ligaId', Number(params.ligaId))

          const { data, error } = await query
          if (error) throw error
          partidas = normalizePartidas(data)
        } else {
          partidas = []
        }
      } else if (scope.organizadorId && !scope.selectedLiga) {
        partidas = []
      } else {
        let query = supabaseAdmin
          .from('Partida')
          .select('*, equipeA:Equipe!equipeAId(*), equipeB:Equipe!equipeBId(*), sets:SetPartida(*)')
          .order('rodada', { ascending: true })
          .order('dataHora', { ascending: true })

        if (scope.selectedLiga) query = query.eq('ligaId', scope.selectedLiga.id)

        const { data, error } = await query
        if (error) throw error
        partidas = normalizePartidas(data)
      }
    } catch (err) {
      console.error('[jogos] erro ao carregar partidas', err)
      loadError = true
      partidas = []
    }
  }

  const knockoutFases = new Set(FASES_ELIMINATORIAS.filter((fase) => fase !== 'NENHUMA'))
  const partidasGrupos = partidas.filter((partida) => !knockoutFases.has(partida.fase))
  const partidasMataMata = partidas.filter((partida) => knockoutFases.has(partida.fase))

  const porRodada = partidasGrupos.reduce<Record<number, typeof partidas>>((acc, partida) => {
    if (!acc[partida.rodada]) acc[partida.rodada] = []
    acc[partida.rodada].push(partida)
    return acc
  }, {})

  const porFaseMataMata = partidasMataMata.reduce<Record<string, typeof partidas>>((acc, partida) => {
    if (!acc[partida.fase]) acc[partida.fase] = []
    acc[partida.fase].push(partida)
    return acc
  }, {})
  const fasesMataMataOrdenadas = Object.keys(porFaseMataMata).sort(
    (a, b) => getRequiredEliminatoryTeams(b) - getRequiredEliminatoryTeams(a),
  )

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <PageHero
        eyebrow={<><CalendarDays size={16} /> Calendário oficial</>}
        title={equipeCapitao ? `Jogos do ${equipeCapitao.nome}` : scope.selectedLiga ? `Jogos - ${scope.selectedLiga.nome}` : 'Jogos da temporada'}
        description={equipeCapitao ? 'Agenda filtrada pelas partidas da sua equipe.' : scope.organizadorId ? 'Agenda filtrada pelos campeonatos criados na sua conta.' : 'Rodadas, horários, locais e placares da competição em uma visão direta.'}
        aside={
          <div className="grid grid-cols-3 gap-3">
            <Metric label="partidas" value={partidas.length} />
            <Metric label="rodadas" value={Object.keys(porRodada).length} />
            <Metric label="locais" value={new Set(partidas.map((p) => p.localNome).filter(Boolean)).size} />
          </div>
        }
      />

      {!equipeCapitao && <LeagueScopeBar ligas={scope.ligas} selected={scope.selectedLiga} organizadorId={scope.organizadorId} basePath="/jogos" />}

      <section className="mx-auto max-w-7xl px-4 pt-8">
        <PartidasAbertasArbitro />
      </section>

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
        ) : partidas.length === 0 ? (
          <EstadoVazio titulo={equipeCapitao ? 'Nenhum jogo para sua equipe' : 'Nenhum jogo cadastrado'} descricao={equipeCapitao ? 'As partidas do seu time aparecerão aqui quando o campeonato montar o calendário.' : 'As partidas aparecerão aqui quando a organização montar o calendário.'} />
        ) : (
          <>
            {fasesMataMataOrdenadas.map((fase) => {
              const lista = porFaseMataMata[fase]
              const label = formatEliminatoryPhase(fase)
              const multiJogo = lista.length > 1
              return (
                <section key={fase} className="mb-9">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-luva-amber text-lg font-black text-slate-950">
                        <Trophy size={20} />
                      </span>
                      <div>
                        <h2 className="font-display text-2xl font-black text-white">{label}</h2>
                        <p className="flex items-center gap-2 text-sm font-bold text-slate-200">
                          <Radio size={14} />
                          {lista.length} partida(s)
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-100">
                      <MapPin size={14} />
                      Mata-mata
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {lista.map((partida) => (
                      <PartidaCard key={partida.id} partida={partida} roundLabel={multiJogo ? `${label} · Jogo ${partida.rodada}` : label} />
                    ))}
                  </div>
                </section>
              )
            })}

            {Object.entries(porRodada).map(([rodada, lista]) => (
              <section key={rodada} className="mb-9">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-luva-amber text-lg font-black text-slate-950">{rodada}</span>
                    <div>
                      <h2 className="font-display text-2xl font-black text-white">Rodada {rodada}</h2>
                      <p className="flex items-center gap-2 text-sm font-bold text-slate-200">
                        <Radio size={14} />
                        {lista.length} partida(s)
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-100">
                    <MapPin size={14} />
                    Agenda
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {lista.map((partida) => <PartidaCard key={partida.id} partida={partida} />)}
                </div>
              </section>
            ))}
          </>
        )}
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4 text-center shadow-sm backdrop-blur-xl">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-200">{label}</p>
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
  }).map((partida) => ({
    ...partida,
    id: Number(partida.id),
    rodada: Number(partida.rodada),
    dataHora: normalizeDateValue(partida.dataHora),
    sets: Array.isArray(partida.sets) ? partida.sets : [],
  }))
}

function normalizeDateValue(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
