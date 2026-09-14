export const dynamic = 'force-dynamic'

import { unstable_noStore as noStore } from 'next/cache'
import { Award, Star, Vote } from 'lucide-react'
import { PageHero } from '@/components/layout/PageHero'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { CreatorEmptyState, LeagueScopeBar } from '@/components/organizador/LeagueScope'
import { getApprovedTeams } from '@/lib/championship-operations'
import { getCreatorLeagueScope } from '@/lib/league-scope'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { createPageMetadata } from '@/lib/seo'

export const metadata = createPageMetadata({
  title: 'Rankings de vôlei',
  description: 'Confira os rankings, destaques e desempenho dos atletas nos campeonatos de vôlei.',
  path: '/rankings',
})

const demoJogadores = [
  { jogador: { id: 1, nome: 'Lucas Andrade', posicao: 'Ponteiro', equipe: { nome: 'Kimura Vôlei', corHex: '#0F2C52' } }, total: 3, votos: 42 },
  { jogador: { id: 2, nome: 'Marcos Lima', posicao: 'Levantador', equipe: { nome: 'Ultra Volleyball', corHex: '#EF9F27' } }, total: 2, votos: 31 },
  { jogador: { id: 3, nome: 'Rafael Souza', posicao: 'Central', equipe: { nome: 'Atlética Norte', corHex: '#185FA5' } }, total: 1, votos: 24 },
]

type PageProps = {
  searchParams?: Promise<{ organizador?: string; ligaId?: string }>
}

function RankingRow({ posicao, jogador, total, suffix }: { posicao: number; jogador: any; total: number; suffix: string }) {
  return (
    <div className="ranking-row flex items-center gap-3 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black ${posicao === 1 ? 'bg-luva-amber text-[#050914]' : 'bg-white/8 text-slate-100'}`}>{posicao}</span>
      <TeamIdentity nome={jogador?.nome ?? 'Atleta'} cor={jogador?.equipe?.corHex ?? '#185FA5'} compact showName={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-white">{jogador?.nome ?? 'Atleta'}</p>
        <p className="mt-1 truncate text-xs font-bold text-slate-200">{jogador?.equipe?.nome ?? 'Equipe'} {jogador?.posicao ? `- ${jogador.posicao}` : ''}</p>
      </div>
      <p className="text-right text-xl font-black text-luva-amber">{total}<span className="ml-1 text-xs text-slate-200">{suffix}</span></p>
    </div>
  )
}

export default async function RankingsPage({ searchParams }: PageProps) {
  noStore()
  const params = searchParams ? await searchParams : {}
  const scope = isSupabaseConfigured ? await getCreatorLeagueScope(params) : { organizadorId: null, ligas: [], selectedLiga: null }
  let rankingMVP: any[] = demoJogadores
  let votos: any[] = demoJogadores.map(({ jogador, votos }) => ({ jogador, votos }))

  if (isSupabaseConfigured) {
    if (scope.organizadorId && !scope.selectedLiga) {
      rankingMVP = []
      votos = []
    } else {
      let destaquesQuery = supabase
        .from('DestaquesPartida')
        .select('*, partida:Partida!inner(*), jogador:Jogador(*, equipe:Equipe(*))')

      let votosQuery: PromiseLike<{ data: any[] | null }> = supabase
        .from('VotoMVP')
        .select('jogadorId, jogador:Jogador!inner(*, equipe:Equipe(*))')

      if (scope.selectedLiga) {
        destaquesQuery = destaquesQuery.eq('partida.ligaId', scope.selectedLiga.id).eq('partida.status', 'ENCERRADA')
        // Equipe.ligaId reflete só a última liga em que o time foi aprovado, não serve
        // para filtrar "times desta liga" quando um time joga em mais de um campeonato.
        const approved = await getApprovedTeams(scope.selectedLiga.id)
        const approvedIds = approved.map((equipe) => equipe.id)
        votosQuery = approvedIds.length > 0
          ? (votosQuery as any).in('jogador.equipeId', approvedIds)
          : Promise.resolve({ data: [] })
      } else {
        destaquesQuery = destaquesQuery.eq('partida.status', 'ENCERRADA')
      }

      const [{ data: destaques }, { data: votosRaw }] = await Promise.all([destaquesQuery, votosQuery])

      const mvps = (destaques ?? []).filter((d: any) => d.tipo === 'MVP' && d.partida)
      const mvpCount: Record<number, { jogador: any; total: number }> = {}
      for (const destaque of mvps as any[]) {
        if (!mvpCount[destaque.jogadorId]) mvpCount[destaque.jogadorId] = { jogador: destaque.jogador, total: 0 }
        mvpCount[destaque.jogadorId].total++
      }
      rankingMVP = Object.values(mvpCount).sort((a, b) => b.total - a.total)

      const votoCount: Record<number, { jogador: any; votos: number }> = {}
      for (const voto of (votosRaw ?? []) as any[]) {
        if (!votoCount[voto.jogadorId]) votoCount[voto.jogadorId] = { jogador: voto.jogador, votos: 0 }
        votoCount[voto.jogadorId].votos++
      }
      votos = Object.values(votoCount).sort((a, b) => b.votos - a.votos).slice(0, 10)
    }
  }

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <PageHero
        eyebrow={<><Award size={16} /> Performance</>}
        title={scope.selectedLiga ? `Rankings - ${scope.selectedLiga.nome}` : 'Rankings da liga'}
        description={scope.organizadorId ? 'Destaques filtrados pelo campeonato selecionado.' : 'Destaques individuais, MVPs por partida e votação da torcida.'}
      />

      <LeagueScopeBar ligas={scope.ligas} selected={scope.selectedLiga} organizadorId={scope.organizadorId} basePath="/rankings" />

      {scope.organizadorId && !scope.selectedLiga ? (
        <CreatorEmptyState organizadorId={scope.organizadorId} title="Nenhum ranking disponível." description="Crie um campeonato e aprove súmulas para gerar MVPs, votos e destaques da temporada." />
      ) : (
        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-2">
          <RankingPanel icon={<Star size={20} />} title="Top MVP por partida" count={`${rankingMVP.length} atletas`}>
            {rankingMVP.length === 0 ? <EstadoVazio titulo="Nenhum destaque registrado" descricao="Os MVPs aparecerão aqui após a aprovação das súmulas." /> : rankingMVP.slice(0, 10).map((item, index) => <RankingRow key={item.jogador?.id ?? index} posicao={index + 1} jogador={item.jogador} total={item.total} suffix="x" />)}
          </RankingPanel>
          <RankingPanel icon={<Vote size={20} />} title="MVP da torcida" count="Temporada">
            {votos.length === 0 ? <EstadoVazio titulo="Nenhum voto registrado" descricao="A votação da torcida aparecerá aqui quando estiver ativa." /> : votos.map((item, index) => <RankingRow key={item.jogador?.id ?? index} posicao={index + 1} jogador={item.jogador} total={item.votos} suffix="votos" />)}
          </RankingPanel>
        </section>
      )}
    </main>
  )
}

function RankingPanel({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: string; children: React.ReactNode }) {
  return (
    <section className="ranking-panel overflow-hidden rounded-[1.5rem] border">
      <div className="ranking-panel-head flex items-center justify-between p-5">
        <h2 className="flex items-center gap-2 font-display text-xl font-black text-white">{icon}{title}</h2>
        <span className="rounded-full px-3 py-1 text-xs font-black text-slate-100">{count}</span>
      </div>
      <div className="ranking-panel-body">{children}</div>
    </section>
  )
}
