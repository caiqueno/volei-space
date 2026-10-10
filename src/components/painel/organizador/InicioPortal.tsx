'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Trophy } from 'lucide-react'
import { EquipeCard } from '@/components/equipes/EquipeCard'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { PartidaCard } from '@/components/partidas/PartidaCard'
import { PodioFinal } from '@/components/classificacao/PodioFinal'
import mi from '@/styles/microinteracoes.module.css'
import { CreatorEmptyState } from '@/components/organizador/LeagueScope'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { ConsultaCancelada, consultar } from '@/lib/api-cliente'

type PortalData = {
  scope: { organizadorId: string | null; ligas: Array<{ id: number; nome: string; slug: string; status?: string }>; selectedLiga: { id: number; nome: string; slug: string; status?: string } | null }
  liga: { nome?: string; subtitulo?: string; descricao?: string } | null
  equipes: any[]
  partidas: any[]
  partidaDestaque: any
  emAndamento: boolean
  podium: any[]
  mensagens: any[]
  premiacoes: any[]
}

type ResumoCampeonato = { id: number; nome: string; slug: string; capaUrl: string | null; subtitulo: string | null }

export function InicioPortal({ organizadorId, ativo = true }: { organizadorId: string; ativo?: boolean }) {
  const [resumos, setResumos] = useState<ResumoCampeonato[]>([])
  const [data, setData] = useState<PortalData | null>(null)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [falha, setFalha] = useState(false)

  useEffect(() => {
    if (!ativo) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const payload = await consultar<{ data?: { slides?: ResumoCampeonato[] } }>('/api/portal-home?visao=painel')
      if (cancelled) return
      setResumos(Array.isArray(payload.data?.slides) ? payload.data.slides : [])
      setFalha(false)
      setLoading(false)
    }
    load().catch((erro) => {
      if (cancelled || erro instanceof ConsultaCancelada) return
      setResumos([])
      setFalha(true)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [organizadorId, ativo])

  useEffect(() => {
    const resumo = resumos[index]
    if (!ativo || !resumo) {
      setData(null)
      return
    }
    let cancelled = false
    consultar<{ data?: PortalData }>(`/api/portal-home?ligaId=${resumo.id}`)
      .then((payload) => {
        if (!cancelled && payload.data) setData(payload.data)
      })
      .catch((erro) => {
        if (cancelled || erro instanceof ConsultaCancelada) return
        setFalha(true)
      })
    return () => {
      cancelled = true
    }
  }, [ativo, resumos, index])

  if (loading && resumos.length === 0) return <p className="px-4 py-10 text-sm font-bold text-white/50">Carregando...</p>
  if (falha && !data) return <p className="px-4 py-10 text-sm font-bold text-red-300">Não foi possível abrir o início.</p>
  if (resumos.length === 0) return <p className="px-4 py-10 text-sm font-semibold text-slate-200">Crie o primeiro campeonato para ver a agenda aqui.</p>
  if (!data) return <p className="px-4 py-10 text-sm font-bold text-white/50">Carregando campeonato...</p>
  const { scope, equipes, partidas, mensagens, premiacoes } = data

  return (
    <div>
      <section
        className="orange-wave w-full min-w-0 overflow-hidden"
      >
        <HeroSlide key={data.scope.selectedLiga?.id ?? index} slide={data} organizadorId={organizadorId} />
      </section>
      {resumos.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {resumos.map((resumo, posicao) => (
            <button
              key={resumo.id}
              type="button"
              onClick={() => setIndex(posicao)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${posicao === index ? 'bg-[#ffb331] text-slate-950' : 'border border-white/15 text-white'}`}
            >
              {resumo.nome}
            </button>
          ))}
        </div>
      )}

      {scope.organizadorId && !scope.selectedLiga ? (
        <CreatorEmptyState organizadorId={scope.organizadorId} title="Seu início ainda não tem campeonato." description="Crie uma competição para liberar agenda, classificação e equipes neste painel." />
      ) : (
        <>
          <section className="py-8">
            <SectionHeader label="Jogos" title="Jogos em destaque" />
            {partidas.length === 0 ? (
              <div className="mt-5"><EstadoVazio titulo="Nenhum jogo agendado" descricao="As partidas aparecerão aqui quando forem cadastradas." /></div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {partidas.map((partida, index) => <PartidaCard key={partida.id} partida={partida} atraso={`${Math.min(index, 8) * 30}ms`} />)}
              </div>
            )}
          </section>
          <section className="py-8">
            <SectionHeader label="Elencos" title="Equipes participantes" />
            {equipes.length === 0 ? (
              <div className="mt-5"><EstadoVazio titulo="Nenhuma equipe cadastrada" descricao="As equipes aparecem aqui quando a inscrição for concluída." /></div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {equipes.map((equipe, index) => <EquipeCard key={equipe.id} equipe={equipe} atraso={`${Math.min(index, 8) * 30}ms`} />)}
              </div>
            )}
          </section>
          <section className="grid gap-6 py-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="luva-card rounded-2xl p-5">
              <SectionHeader label="Premiação" title="Reconhecimentos" />
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">Campeões, destaques e campanhas ficam visíveis para atletas, patrocinadores e torcida.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {(premiacoes ?? []).map((premio) => (
                <article key={premio.id} className={`luva-card rounded-2xl p-5 ${mi.entrar} ${mi.cartao} ${premio.colocacao === 1 ? mi.campeao : ''}`}>
                  <Trophy size={22} className={`text-luva-amber ${premio.colocacao === 1 ? mi.pop : ''}`} />
                  <p className={`mt-4 text-4xl font-black text-white ${mi.numero}`}>{premio.colocacao}º</p>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-200">{premio.descricao}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="pb-4">
            <div className="luva-surface rounded-2xl p-5">
              <SectionHeader label="Torcida" title="Mural da liga" />
              {mensagens.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-200">Mural pronto para receber mensagens quando a organização liberar a publicação.</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {mensagens.map((mensagem) => (
                    <article key={mensagem.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="font-black text-white">{mensagem.autor}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">{mensagem.texto}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function HeroSlide({ slide, organizadorId }: { slide: PortalData; organizadorId: string }) {
  const { scope, liga, equipes, partidas, partidaDestaque, emAndamento, podium } = slide
  const totalAtletas = equipes.reduce((acc: number, equipe: any) => acc + Number(equipe.quantidadeJogadores ?? equipe.jogadores?.length ?? 0), 0)
  const descricao = liga?.descricao?.trim()

  return (
    <div className="grid w-full min-w-0 gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-center">
      <div>
        <p className="luva-kicker">{liga?.subtitulo ?? 'Portal do campeonato'}</p>
        <h2 className="mt-5 max-w-4xl font-display text-5xl font-black leading-[0.9] text-white md:text-7xl">
          {liga?.nome ?? 'Crie seu primeiro campeonato.'}
        </h2>
        {(descricao || !liga) && (
          <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-200">
            {descricao || 'O início fica pronto assim que você criar um campeonato.'}
          </p>
        )}
        {!(scope.organizadorId && !scope.selectedLiga) && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={scope.selectedLiga ? `/jogos?organizador=${encodeURIComponent(organizadorId)}&ligaId=${scope.selectedLiga.id}` : '/jogos'} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-luva-amber px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-amber-300">
              Ver calendário
              <ArrowRight size={18} />
            </Link>
            <Link href={scope.selectedLiga ? `/classificacao?organizador=${encodeURIComponent(organizadorId)}&ligaId=${scope.selectedLiga.id}` : '/classificacao'} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/8 px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:border-luva-amber/70">
              Ver classificação
            </Link>
          </div>
        )}
        <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
          <Metric label="Equipes" value={equipes.length} />
          <Metric label="Atletas" value={totalAtletas || 0} />
          <Metric label="Jogos" value={partidas.length} />
        </div>
        {podium.length > 0 && (
          <div className={`mt-10 max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-4 ${mi.entrar}`}>
            <p className="luva-kicker mb-3">Pódio final</p>
            <PodioFinal podium={podium} variant="hero" />
          </div>
        )}
      </div>
      <div className="luva-surface overflow-hidden rounded-[30px]">
        <div className="relative h-52 bg-slate-950/60">
          <Image src="/brand/volei-space_fundo-quadrado.png" alt="" fill sizes="500px" className="object-cover opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/90 via-slate-950/30 to-luva-amber/20" />
          <div className="absolute left-5 top-5 flex items-center gap-3">
            <span className="relative h-12 w-12 overflow-hidden rounded-xl">
              <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" fill sizes="48px" className="object-contain" />
            </span>
            <div>
              <p className="font-display text-lg font-black text-white">{liga?.nome ?? 'volei.space'}</p>
              <p className="text-xs font-bold text-slate-200">Central da competição</p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <p className="luva-kicker">{emAndamento ? 'Ao vivo agora' : 'Próximo jogo'}</p>
          {partidaDestaque ? (
            <Link href={`/partidas/${partidaDestaque.id}/ao-vivo`} className={`mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 hover:border-luva-amber/60 ${mi.cartao}`}>
              <TeamIdentity nome={partidaDestaque.equipeA?.nome || 'Equipe'} cor={partidaDestaque.equipeA?.corHex} compact />
              <span className={`rounded-2xl bg-luva-amber px-3 py-2 text-sm font-black text-slate-950 ${mi.numero}`}>
                {emAndamento ? `${partidaDestaque.setsPorA ?? 0}x${partidaDestaque.setsPorB ?? 0}` : 'VS'}
              </span>
              <TeamIdentity nome={partidaDestaque.equipeB?.nome || 'Equipe'} cor={partidaDestaque.equipeB?.corHex} align="right" compact />
            </Link>
          ) : (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-200">Calendário em montagem.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/8 p-4 shadow-sm backdrop-blur-xl ${mi.cartao}`}>
      <p className={`text-3xl font-black text-white ${mi.numero}`}>{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-200">{label}</p>
    </div>
  )
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <p className="luva-kicker">{label}</p>
      <h3 className="mt-2 font-display text-3xl font-black text-white">{title}</h3>
    </div>
  )
}
