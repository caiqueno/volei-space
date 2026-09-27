export const dynamic = 'force-dynamic'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BarChart3, CalendarDays, ClipboardCheck, QrCode, Trophy, Users } from 'lucide-react'
import { EquipeCard } from '@/components/equipes/EquipeCard'
import { TeamIdentity } from '@/components/equipes/TeamIdentity'
import { PartidaCard } from '@/components/partidas/PartidaCard'
import { PodioFinal } from '@/components/classificacao/PodioFinal'
import { CreatorEmptyState, LeagueScopeBar } from '@/components/organizador/LeagueScope'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { readPublicSession } from '@/lib/auth'
import { getPortalHome } from '@/lib/portal-home'
import { createPageMetadata } from '@/lib/seo'

export const metadata = createPageMetadata({
  title: 'Portal dos campeonatos',
  description: 'Acompanhe campeonatos de vôlei, equipes, próximos jogos, resultados e destaques no portal público da volei.space.',
  path: '/portal',
})

type PageProps = {
  searchParams?: Promise<{ organizador?: string; ligaId?: string; candidaturaId?: string; embed?: string }>
}

export default async function PortalPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {}
  const { scope, liga, equipes, partidas, partidaDestaque, emAndamento, podium, mensagens, premiacoes } = await getPortalHome(params)
  const totalAtletas = equipes.reduce((acc: number, equipe: any) => acc + Number(equipe.quantidadeJogadores ?? equipe.jogadores?.length ?? 0), 0)
  const session = await readPublicSession()
  const perfilPublico = session?.tipo === 'publico'
  const esconderGuia = perfilPublico || params.embed === '1'

  return (
    <main className="luva-shell min-h-screen overflow-hidden pb-28 lg:pb-0">
      <section className="orange-wave">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[1fr_500px] lg:items-center lg:py-16">
          <div className="motion-in">
            <p className="luva-kicker">{liga?.subtitulo ?? 'Portal do campeonato'}</p>
            <h1 className="mt-5 max-w-4xl font-display text-5xl font-black leading-[0.9] text-white md:text-7xl">
              {liga?.nome ?? 'Crie seu primeiro campeonato.'}
            </h1>
            <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-200">
              {liga?.descricao ?? 'O portal ficará pronto assim que você criar um campeonato no painel do criador.'}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {scope.organizadorId && !scope.selectedLiga ? (
                <Link href="/painel" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-luva-amber px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-amber-300">
                  Criar campeonato
                  <ArrowRight size={18} />
                </Link>
              ) : (
                <>
                  <Link href={scope.selectedLiga ? buildScopedHref('/jogos', scope) : '/jogos'} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-luva-amber px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-amber-300">
                    Ver calendário
                    <ArrowRight size={18} />
                  </Link>
                  <Link href={scope.selectedLiga ? buildScopedHref('/classificacao', scope) : '/classificacao'} className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/8 px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:border-luva-amber/70">
                    Ver classificação
                  </Link>
                </>
              )}
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              <Metric label="Equipes" value={equipes.length} />
              <Metric label="Atletas" value={totalAtletas || 0} />
              <Metric label="Jogos" value={partidas.length} />
            </div>

            {podium.length > 0 && (
              <div className="mt-10 max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="luva-kicker mb-3">Pódio final</p>
                <PodioFinal podium={podium} variant="hero" />
              </div>
            )}
          </div>

          <div className="motion-in-delay luva-surface overflow-hidden rounded-[30px]">
            <div className="relative h-52 bg-slate-950/60">
              <Image src="/brand/volei-space_fundo-quadrado.png" alt="volei.space" fill sizes="500px" className="object-cover opacity-50" priority />
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/90 via-slate-950/30 to-luva-amber/20" />
              <div className="absolute left-5 top-5 flex items-center gap-3">
                <span className="relative h-12 w-12 overflow-hidden rounded-xl">
                  <Image src="/brand/volei-space_simbolo-orbital_transparente.png" alt="volei.space" fill sizes="48px" className="object-contain" />
                </span>
                <div>
                  <p className="font-display text-lg font-black text-[#ffffff]">{liga?.nome ?? 'volei.space'}</p>
                  <p className="text-xs font-bold text-slate-200">Central da competição</p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="luva-kicker">{emAndamento ? 'Ao vivo agora' : 'Próximo jogo'}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-200">{emAndamento ? 'Acompanhe a partida em tempo real' : 'Agenda da rodada'}</p>
                </div>
                {emAndamento ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-black text-sky-200">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />
                    Ao vivo
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200">Agendado</span>
                )}
              </div>

              {partidaDestaque ? (
                <Link
                  href={`/partidas/${partidaDestaque.id}/ao-vivo`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:border-luva-amber/60"
                >
                  <TeamPreview equipe={partidaDestaque.equipeA} />
                  <span className="rounded-2xl bg-luva-amber px-3 py-2 text-sm font-black text-slate-950">
                    {emAndamento ? `${partidaDestaque.setsPorA ?? 0}x${partidaDestaque.setsPorB ?? 0}` : 'VS'}
                  </span>
                  <TeamPreview equipe={partidaDestaque.equipeB} align="right" />
                </Link>
              ) : (
                <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-200">Calendário em montagem.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <LeagueScopeBar ligas={scope.ligas} selected={scope.selectedLiga} organizadorId={scope.organizadorId} basePath="/portal" />

      {scope.organizadorId && !scope.selectedLiga ? (
        <CreatorEmptyState organizadorId={scope.organizadorId} title="Seu portal ainda não tem campeonato." description="Crie uma competição no painel do criador para liberar agenda, classificação, rankings e galeria filtrados pela sua conta." />
      ) : (
        <>
          {!esconderGuia && (
            <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 md:grid-cols-4">
              <FeatureCard icon={<QrCode size={22} />} title="QR Code" text="Validação individual de atletas antes das partidas." />
              <FeatureCard icon={<ClipboardCheck size={22} />} title="Súmula" text="Registro digital de presença, sets, eventos e resultado." />
              <FeatureCard icon={<BarChart3 size={22} />} title="Tabela" text="Classificação organizada para consulta rápida." />
              <FeatureCard icon={<CalendarDays size={22} />} title="Agenda" text="Rodadas, horários e locais em uma única visão." />
            </section>
          )}

          <section className={`mx-auto grid max-w-7xl gap-8 px-4 py-8 ${esconderGuia ? '' : 'lg:grid-cols-[1.15fr_0.85fr]'}`}>
            <div>
              <SectionHeader label={perfilPublico ? 'Jogos' : 'Agenda'} title="Jogos em destaque" />
              {partidas.length === 0 ? (
                <EstadoVazio titulo="Nenhum jogo agendado" descricao="As partidas aparecerão aqui quando forem cadastradas pela organização." />
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {partidas.map((partida: any) => <PartidaCard key={partida.id} partida={partida} />)}
                </div>
              )}
            </div>

            {!esconderGuia && (
              <div>
                <SectionHeader label="Operação" title="Fluxo da competição" />
                <div className="luva-surface mt-5 overflow-hidden rounded-2xl">
                  {['Cadastrar equipes e atletas', 'Gerar QR Codes de inscrição', 'Registrar súmula da partida', 'Aprovar resultado e atualizar tabela'].map((item, index) => (
                    <div key={item} className="flex items-center gap-4 border-b border-white/10 p-4 last:border-b-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-luva-amber text-sm font-black text-slate-950">{index + 1}</span>
                      <p className="text-sm font-bold text-slate-100">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="mx-auto max-w-7xl px-4 py-10">
              <SectionHeader label="Elencos" title="Equipes participantes" />
              {equipes.length === 0 ? (
                <div className="mt-5"><EstadoVazio titulo="Nenhuma equipe cadastrada" descricao="As equipes serão exibidas aqui quando a organização ativar a temporada." /></div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {equipes.map((e: any) => <EquipeCard key={e.id} equipe={e} />)}
                </div>
              )}
            </div>
          </section>

          <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="luva-card rounded-2xl p-5">
              <SectionHeader label="Premiação" title="Reconhecimentos" />
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">Campeões, destaques e campanhas ficam visíveis para atletas, patrocinadores e torcida.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {(premiacoes ?? []).map((premio: any) => (
                <article key={premio.id} className="luva-card rounded-2xl p-5">
                  <Trophy size={22} className="text-luva-amber" />
                  <p className="mt-4 text-4xl font-black text-white">{premio.colocacao}º</p>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-200">{premio.descricao}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-12">
            <div className="luva-surface rounded-2xl p-5">
              <SectionHeader label="Torcida" title="Mural da liga" />
              {mensagens.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-bold text-slate-200">Mural pronto para receber mensagens quando a organização liberar a publicação.</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {mensagens.map((mensagem: any) => (
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
    </main>
  )
}

function buildScopedHref(path: string, scope: { organizadorId: string | null; selectedLiga: { id: number } | null }) {
  const params = new URLSearchParams()
  if (scope.organizadorId) params.set('organizador', scope.organizadorId)
  if (scope.selectedLiga) params.set('ligaId', String(scope.selectedLiga.id))
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4 shadow-sm backdrop-blur-xl">
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-200">{label}</p>
    </div>
  )
}

function TeamPreview({ equipe, align = 'left' }: { equipe: any; align?: 'left' | 'right' }) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
      <TeamIdentity nome={equipe.nome} cor={equipe.corHex} align={align} compact />
    </div>
  )
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="luva-card rounded-2xl p-5">
      <span className="text-luva-amber">{icon}</span>
      <h2 className="mt-4 font-display text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{text}</p>
    </article>
  )
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <p className="luva-kicker">{label}</p>
      <h2 className="mt-2 font-display text-3xl font-black text-white">{title}</h2>
    </div>
  )
}
