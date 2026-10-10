export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Trophy, UsersRound } from 'lucide-react'
import { CampeonatoActions } from '@/components/campeonatos/CampeonatoActions'
import { CampeonatoMataMata } from '@/components/campeonatos/CampeonatoMataMata'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import type { BracketRoundView, BracketSlot, TeamOption } from '@/components/mata-mata/ChaveamentoMataMata'
import { getChampionshipPodium, type PodiumTeam } from '@/lib/championship-podium'
import { formatLigaFormato, formatLigaStatus } from '@/lib/format-liga'
import { isCampeonatoFinalizado } from '@/lib/championship-finalization'
import { getMataMataBracket } from '@/lib/mata-mata'
import { isSupabaseConfigured } from '@/lib/supabase'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { createPageMetadata } from '@/lib/seo'

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  noStore()
  const { slug } = await params
  const fallback = createPageMetadata({
    title: 'Campeonato de vôlei',
    description: 'Confira informações, participantes, jogos e resultados deste campeonato de vôlei.',
    path: `/campeonatos/${encodeURIComponent(slug)}`,
  })

  if (!isSupabaseConfigured) return fallback

  const { data: liga } = await supabase
    .from('Liga')
    .select('nome,descricao,subtitulo,simulacao')
    .eq('slug', slug)
    .maybeSingle()

  if (!liga || liga.simulacao === true) return { ...fallback, robots: { index: false, follow: false } }

  return createPageMetadata({
    title: liga.nome,
    description: liga.descricao || liga.subtitulo || `Acompanhe jogos, equipes e resultados do campeonato ${liga.nome}.`,
    path: `/campeonatos/${encodeURIComponent(slug)}`,
  })
}

export default async function CampeonatoPage({ params }: PageProps) {
  noStore()
  const { slug } = await params

  if (!isSupabaseConfigured) {
    return (
      <main className="luva-shell min-h-screen px-4 py-12">
        <EstadoVazio titulo="Supabase não configurado" descricao="Configure o banco para carregar os dados do campeonato." />
      </main>
    )
  }

  const { data: liga } = await supabase
    .from('Liga')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!liga || liga.simulacao === true) {
    return (
      <main className="luva-shell min-h-screen px-4 py-12">
        <EstadoVazio titulo="Campeonato não encontrado" descricao="Verifique o link público do campeonato e tente novamente." />
      </main>
    )
  }

  const finalizado = isCampeonatoFinalizado(liga.status)
  const faseChave = await faseDaChave(liga.id, liga.faseEliminatoria)
  const chaveVazia = { rounds: [] as BracketRoundView[], champion: null as TeamOption | null, thirdPlace: null as BracketSlot | null }
  const [{ count: equipesCount }, { count: jogosCount }, { data: equipesConfirmadas }, bracket, podium] = await Promise.all([
    supabase.from('InscricaoCampeonato').select('*', { count: 'exact', head: true }).eq('ligaId', liga.id).eq('status', 'APROVADA'),
    supabase.from('Partida').select('*', { count: 'exact', head: true }).eq('ligaId', liga.id),
    supabase
      .from('InscricaoCampeonato')
      .select('id,status,equipe:Equipe(id,nome,slug,categoria,serie)')
      .eq('ligaId', liga.id)
      .eq('status', 'APROVADA')
      .order('criadaEm', { ascending: true }),
    faseChave ? getMataMataBracket(liga.id, faseChave, false) : Promise.resolve(chaveVazia),
    finalizado ? getChampionshipPodium(liga.id) : Promise.resolve([] as PodiumTeam[]),
  ])
  const vagasLimite = liga.quantidadeEquipes ?? null
  const vagasDisponiveis = vagasLimite ? Math.max(vagasLimite - (equipesCount ?? 0), 0) : null
  const inscricoesAbertas = !finalizado && liga.inscricoesAbertas !== false && (vagasDisponiveis === null || vagasDisponiveis > 0)

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <section className="orange-wave">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <p className="luva-kicker flex flex-wrap items-center gap-2">
              <Trophy size={16} /> {formatLigaStatus(liga.status)}
            </p>
            {finalizado && (
              <p className="mt-4 max-w-2xl text-sm font-bold text-slate-100">Este campeonato está finalizado e disponível apenas para consulta.</p>
            )}
            <h1 className="type-page-title mt-3 max-w-4xl">{liga.nome}</h1>
            <p className="type-lead mt-4 max-w-2xl">
              {liga.descricao || liga.subtitulo || 'Acompanhe informações, inscrições, agenda, classificação e cobertura deste campeonato.'}
            </p>
          </div>
          <CampeonatoActions ligaId={liga.id} inscricoesAbertas={inscricoesAbertas} vagasDisponiveis={vagasDisponiveis} finalizado={finalizado} />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-8 md:grid-cols-4">
        <InfoCard icon={<UsersRound size={22} />} label="Equipes previstas" value={liga.quantidadeEquipes ?? '-'} />
        <InfoCard icon={<Trophy size={22} />} label="Formato" value={formatLigaFormato(liga.formato)} />
        <InfoCard icon={<UsersRound size={22} />} label="Equipes aprovadas" value={equipesCount ?? 0} />
        <InfoCard icon={<CalendarDays size={22} />} label="Jogos" value={jogosCount ?? 0} />
      </section>

      <CampeonatoMataMata
        ligaId={liga.id}
        rounds={bracket.rounds}
        champion={bracket.champion}
        thirdPlace={bracket.thirdPlace}
        podium={podium}
        finalizado={finalizado}
      />

      {Boolean(equipesConfirmadas?.length) && (
        <section className="mx-auto max-w-7xl px-4 pb-8">
          <article className="championship-card rounded-[1.75rem] border p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="luva-kicker">Equipes confirmadas</p>
                <h2 className="mt-2 font-display text-3xl font-black text-white">Participantes</h2>
              </div>
              <span className="text-sm font-black text-slate-200">{equipesConfirmadas?.length ?? 0} equipe(s)</span>
            </div>
            <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
              {equipesConfirmadas?.map((item: any) => {
                const equipe = Array.isArray(item.equipe) ? item.equipe[0] : item.equipe
                if (!equipe) return null
                return (
                  <Link key={item.id} href={`/equipes/${equipe.slug}`} className="grid gap-2 bg-white/[0.03] px-4 py-4 transition hover:bg-white/[0.06] sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="font-display text-lg font-black text-white">{equipe.nome}</p>
                      <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-300">
                        {[equipe.categoria, equipe.serie].filter(Boolean).join(' · ') || 'Equipe inscrita'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-black text-luva-amber">
                      Ver perfil <ArrowRight size={15} />
                    </span>
                  </Link>
                )
              })}
            </div>
          </article>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 lg:grid-cols-[1fr_0.9fr]">
        <article className="championship-card rounded-[1.75rem] border p-6">
          <p className="luva-kicker">Informações importantes</p>
          <h2 className="mt-3 font-display text-3xl font-black text-white">Como participar</h2>
          <div className="mt-5 grid gap-3">
            {liga.regulamento && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="luva-kicker">Regulamento</p>
                <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-slate-100">{liga.regulamento}</p>
              </div>
            )}
            {liga.premiacao && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="luva-kicker">Premiação</p>
                <p className="mt-2 whitespace-pre-line text-sm font-bold leading-6 text-slate-100">{liga.premiacao}</p>
              </div>
            )}
            {[
              'Equipes podem solicitar inscrição diretamente por este link.',
              'Equipes já cadastradas podem entrar e solicitar inscrição no campeonato.',
              'A organização valida as inscrições antes de liberar elenco, jogos e QR Codes.',
              'O portal público mostra agenda, classificação, rankings e galeria deste campeonato.',
            ].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-luva-amber text-sm font-black text-slate-950">{index + 1}</span>
                <p className="text-sm font-bold leading-6 text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="championship-card rounded-[1.75rem] border p-6">
          <p className="luva-kicker">Portal</p>
          <h2 className="mt-3 font-display text-3xl font-black text-white">Acompanhe a competição</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">
            Use os atalhos abaixo para ver somente dados deste campeonato.
          </p>
          <div className="mt-5 grid gap-3">
            <Link href={`/portal?ligaId=${liga.id}`} className="creator-mini-action justify-center">Portal</Link>
            <Link href={`/jogos?ligaId=${liga.id}`} className="creator-mini-action justify-center">Jogos</Link>
            <Link href={`/classificacao?ligaId=${liga.id}`} className="creator-mini-action justify-center">Classificação</Link>
            <Link href={`/rankings?ligaId=${liga.id}`} className="creator-mini-action justify-center">Rankings</Link>
            <Link href={`/galeria?ligaId=${liga.id}`} className="creator-mini-action justify-center">Galeria <ArrowRight size={16} /></Link>
          </div>
        </article>
      </section>
    </main>
  )
}

const FASES_DA_CHAVE = ['DEZESSEIS_AVOS', 'OITAVAS', 'QUARTAS', 'SEMIFINAL', 'FINAL']

async function faseDaChave(ligaId: number, faseEliminatoria?: string | null) {
  const configurada = String(faseEliminatoria ?? '').trim().toUpperCase()
  if (configurada && configurada !== 'NENHUMA') return configurada
  const { data } = await supabase.from('Partida').select('fase').eq('ligaId', ligaId).in('fase', FASES_DA_CHAVE)
  const presentes = new Set((data ?? []).map((partida) => String(partida.fase ?? '')))
  return FASES_DA_CHAVE.find((fase) => presentes.has(fase)) ?? null
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <article className="championship-card rounded-[1.5rem] border p-5">
      <span className="championship-card-icon flex h-11 w-11 items-center justify-center rounded-2xl">{icon}</span>
      <p className="mt-4 text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-200">{label}</p>
    </article>
  )
}
