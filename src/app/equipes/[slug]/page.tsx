export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Medal, ShieldCheck, Trophy, UsersRound } from 'lucide-react'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { ordenarJogos } from '@/lib/data-hora'
import { formatarDataPartida } from '@/lib/format-partida'
import { formatLigaFormato } from '@/lib/format-liga'
import { isSupabaseConfigured } from '@/lib/supabase'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { NomeEquipe } from '@/components/equipes/NomeEquipe'
import { normalizarNomeEquipe } from '@/lib/nome-equipe'
import { createPageMetadata } from '@/lib/seo'
import mi from '@/styles/microinteracoes.module.css'

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const fallback = createPageMetadata({
    title: 'Equipe de vôlei',
    description: 'Confira o perfil, elenco, jogos e desempenho desta equipe de vôlei.',
    path: `/equipes/${encodeURIComponent(slug)}`,
  })

  if (!isSupabaseConfigured) return fallback

  const { data: equipe } = await supabase
    .from('Equipe')
    .select('nome,categoria,serie,logoUrl')
    .eq('slug', slug)
    .maybeSingle()

  if (!equipe) return { ...fallback, robots: { index: false, follow: false } }

  const contexto = [equipe.categoria, equipe.serie].filter(Boolean).join(' · ')
  const nome = normalizarNomeEquipe(equipe.nome)
  return createPageMetadata({
    title: nome,
    description: contexto
      ? `Conheça a equipe ${nome} (${contexto}), seu elenco, jogos e desempenho nos campeonatos.`
      : `Conheça a equipe ${nome}, seu elenco, jogos e desempenho nos campeonatos.`,
    path: `/equipes/${encodeURIComponent(slug)}`,
  })
}

type Equipe = {
  id: number
  nome: string
  slug: string
  categoria?: string | null
  serie?: string | null
  corHex?: string | null
  logoUrl?: string | null
  criadoEm?: string | null
}

type Jogador = {
  id: number
  nome: string
  numero?: number | null
  posicao?: string | null
  fotoRostoUrl?: string | null
  fotoUrl?: string | null
}

export default async function EquipePublicPage({ params }: PageProps) {
  const { slug } = await params

  if (!isSupabaseConfigured) {
    return (
      <main className="luva-shell min-h-screen px-4 py-12">
        <EstadoVazio titulo="Supabase não configurado" descricao="Configure o banco para carregar os dados da equipe." />
      </main>
    )
  }

  const { data: equipe } = await supabase
    .from('Equipe')
    .select('id,nome,slug,categoria,serie,corHex,logoUrl,criadoEm')
    .eq('slug', slug)
    .maybeSingle<Equipe>()

  if (!equipe) {
    return (
      <main className="luva-shell min-h-screen px-4 py-12">
        <EstadoVazio titulo="Equipe não encontrada" descricao="Verifique o link público da equipe e tente novamente." />
      </main>
    )
  }

  const [{ data: jogadores }, { data: inscricoes }, { data: partidas }, { data: classificacao }] = await Promise.all([
    supabase
      .from('Jogador')
      .select('id, nome, numero, posicao, fotoUrl, fotoRostoUrl')
      .eq('equipeId', equipe.id)
      .order('numero', { ascending: true }),
    supabase
      .from('InscricaoCampeonato')
      .select('id,status,criadaEm,liga:Liga(id,nome,slug,status,formato)')
      .eq('equipeId', equipe.id)
      .order('criadaEm', { ascending: false }),
    supabase
      .from('Partida')
      .select('id,rodada,dataHora,status,setsPorA,setsPorB,vencedorId,liga:Liga(id,nome,slug),equipeA:Equipe!Partida_equipeAId_fkey(id,nome,slug),equipeB:Equipe!Partida_equipeBId_fkey(id,nome,slug)')
      .or(`equipeAId.eq.${equipe.id},equipeBId.eq.${equipe.id}`)
      .order('dataHora', { ascending: false })
      .limit(8),
    supabase.from('ClassificacaoEntrada').select('pontos,atualizadoEm').eq('equipeId', equipe.id).order('atualizadoEm', { ascending: false }).limit(1).maybeSingle(),
  ])

  const jogos = ordenarJogos(partidas ?? [])
  const encerradas = jogos.filter((partida: any) => partida.status === 'ENCERRADA')
  const vitorias = encerradas.filter((partida: any) => partida.vencedorId === equipe.id).length
  const derrotas = encerradas.filter((partida: any) => partida.vencedorId && partida.vencedorId !== equipe.id).length
  const participacoes = inscricoes?.length ?? 0
  const aprovadas = inscricoes?.filter((item: any) => item.status === 'APROVADA').length ?? 0

  return (
    <main className="luva-shell min-h-screen">
      <section className="orange-wave border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <Link href="/campeonatos" className="public-secondary-action inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black">
            <ArrowLeft size={16} />
            Campeonatos
          </Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="luva-kicker">Perfil público da equipe</p>
              <h1 className="type-page-title mt-3 max-w-4xl"><NomeEquipe nome={equipe.nome} /></h1>
              <p className="type-lead mt-4">
                {[equipe.categoria, equipe.serie].filter(Boolean).join(' · ') || 'Equipe cadastrada na plataforma volei.space.'}
              </p>
            </div>
            <article className={`championship-card rounded-[1.75rem] border p-6 ${mi.entrar} ${mi.cartao}`}>
              <p className="luva-kicker">Resumo</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Jogos" value={jogos.length} />
                <Metric label="Vitórias" value={vitorias} />
                <Metric label="Derrotas" value={derrotas} />
                <Metric label="Camp." value={aprovadas} />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1fr_0.8fr]">
        <article className={`championship-card rounded-[1.75rem] border p-6 ${mi.entrar}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="luva-kicker">Elenco</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Atletas cadastrados</h2>
            </div>
            <span className="text-sm font-black text-slate-200">{jogadores?.length ?? 0} atleta(s)</span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(jogadores as Jogador[] | null)?.length ? (jogadores as Jogador[]).map((jogador, index) => (
              <div key={jogador.id} className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 ${mi.linha} ${mi.entrar}`} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
                {jogador.fotoRostoUrl || jogador.fotoUrl ? (
                  <img src={jogador.fotoRostoUrl || jogador.fotoUrl || ''} alt={jogador.nome} className="h-14 w-14 rounded-2xl object-cover" />
                ) : (
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-luva-amber ${mi.numero}`}>
                    #{jogador.numero ?? '--'}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="break-words font-black text-white">{jogador.nome}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-300">
                    #{jogador.numero ?? '--'} · {jogador.posicao || 'Atleta'}
                  </p>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:col-span-2">
                <p className="font-bold text-slate-200">Elenco ainda não publicado.</p>
              </div>
            )}
          </div>
        </article>

        <div className="grid gap-6">
          <article className={`championship-card rounded-[1.75rem] border p-6 ${mi.entrar}`} style={{ animationDelay: '40ms' }}>
            <p className="luva-kicker">Histórico</p>
            <h2 className="mt-2 font-display text-3xl font-black text-white">Performance</h2>
            <div className="mt-5 grid gap-3">
              <HistoryRow icon={<Trophy size={18} />} label="Campeonatos inscritos" value={participacoes} />
              <HistoryRow icon={<ShieldCheck size={18} />} label="Inscrições aprovadas" value={aprovadas} />
              <HistoryRow icon={<Medal size={18} />} label="Pontos na tabela" value={(classificacao as any)?.pontos ?? '-'} />
              <HistoryRow icon={<UsersRound size={18} />} label="Vitórias registradas" value={vitorias} />
            </div>
          </article>

          <article className={`championship-card rounded-[1.75rem] border p-6 ${mi.entrar}`} style={{ animationDelay: '80ms' }}>
            <p className="luva-kicker">Assiduidade</p>
            <h2 className="mt-2 font-display text-3xl font-black text-white">Presença competitiva</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">
              Jogos encerrados: {encerradas.length}. Dados de W.O. e presença individual entram aqui conforme a súmula oficial for registrada.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12">
        <article className={`championship-card rounded-[1.75rem] border p-6 ${mi.entrar}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="luva-kicker">Competições</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Campeonatos da equipe</h2>
            </div>
            <span className="text-sm font-black text-slate-200">{participacoes} registro(s)</span>
          </div>
          <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
            {inscricoes?.length ? inscricoes.map((item: any) => {
              const liga = Array.isArray(item.liga) ? item.liga[0] : item.liga
              return (
                <Link key={item.id} href={liga?.slug ? `/campeonatos/${liga.slug}` : '/campeonatos'} className={`grid gap-2 bg-white/[0.03] px-4 py-4 hover:bg-white/[0.06] md:grid-cols-[1fr_auto_auto] md:items-center ${mi.linha}`}>
                  <div>
                    <p className="font-display text-lg font-black text-white">{liga?.nome ?? 'Campeonato'}</p>
                    <p className="mt-1 text-xs font-bold tracking-[0.04em] text-slate-300">{formatLigaFormato(liga?.formato)}</p>
                  </div>
                  <span className="text-sm font-black text-slate-200">{item.status?.replace(/_/g, ' ')}</span>
                  <span className="inline-flex items-center gap-2 text-sm font-black text-luva-amber">Ver campeonato <ArrowLeft className="rotate-180" size={15} /></span>
                </Link>
              )
            }) : (
              <div className="bg-white/[0.03] px-4 py-5">
                <p className="font-bold text-slate-200">Nenhum campeonato vinculado ainda.</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <article className={`championship-card rounded-[1.75rem] border p-6 ${mi.entrar}`} style={{ animationDelay: '40ms' }}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="luva-kicker">Agenda</p>
              <h2 className="mt-2 font-display text-3xl font-black text-white">Últimos jogos</h2>
            </div>
            <span className="text-sm font-black text-slate-200">{jogos.length} jogo(s)</span>
          </div>
          <div className="mt-5 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10">
            {jogos.length ? jogos.map((partida: any) => {
              const equipeA = Array.isArray(partida.equipeA) ? partida.equipeA[0] : partida.equipeA
              const equipeB = Array.isArray(partida.equipeB) ? partida.equipeB[0] : partida.equipeB
              const liga = Array.isArray(partida.liga) ? partida.liga[0] : partida.liga
              return (
                <div key={partida.id} className={`grid gap-2 bg-white/[0.03] px-4 py-4 md:grid-cols-[1fr_auto_auto] md:items-center ${mi.linha}`}>
                  <div>
                    <p className="font-display text-lg font-black text-white"><NomeEquipe nome={equipeA?.nome} vazio="Equipe A" /> x <NomeEquipe nome={equipeB?.nome} vazio="Equipe B" /></p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-300">{liga?.nome ?? 'Campeonato'} · Rodada {partida.rodada ?? '-'}</p>
                  </div>
                  <span className="text-sm font-black text-slate-200">{formatarDataPartida(partida.dataHora) ?? 'Data a definir'}</span>
                  <span className={`text-sm font-black text-luva-amber ${mi.numero}`}>{partida.setsPorA ?? 0} x {partida.setsPorB ?? 0}</span>
                </div>
              )
            }) : (
              <div className="bg-white/[0.03] px-4 py-5">
                <p className="font-bold text-slate-200">Nenhum jogo registrado ainda.</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${mi.cartao}`}>
      <p className={`text-3xl font-black text-white ${mi.numero}`}>{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">{label}</p>
    </div>
  )
}

function HistoryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 ${mi.linha}`}>
      <span className="flex items-center gap-2 text-sm font-bold text-slate-200">{icon}{label}</span>
      <strong className={`font-black text-white ${mi.numero}`}>{value}</strong>
    </div>
  )
}

