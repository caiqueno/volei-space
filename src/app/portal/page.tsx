export const dynamic = 'force-dynamic'

import { BarChart3, CalendarDays, ClipboardCheck, QrCode, Trophy } from 'lucide-react'
import { EquipeCard } from '@/components/equipes/EquipeCard'
import { PortalAtivosCarousel } from '@/components/portal/PortalAtivosCarousel'
import { PortalAgenda } from '@/components/portal/PortalAgenda'
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
  const { scope, liga, equipes, grupos, partidasFalha, agendaGlobal, mensagens, premiacoes } = await getPortalHome(params)
  const session = await readPublicSession()
  const perfilPublico = session?.tipo === 'publico'
  const esconderGuia = perfilPublico || params.embed === '1'

  return (
    <main className="luva-shell min-h-screen overflow-hidden pb-28 lg:pb-0">
      <PortalAtivosCarousel />

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

          <section className="mx-auto max-w-7xl px-4 py-8">
            <SectionHeader label={agendaGlobal ? 'Todos os campeonatos' : (liga?.nome || (perfilPublico ? 'Jogos' : 'Agenda'))} title="Jogos do campeonato" />
            <div className="mt-5">
              <PortalAgenda ligaId={agendaGlobal ? null : liga?.id ?? null} global={agendaGlobal} inicial={grupos} falhaInicial={partidasFalha} />
            </div>
          </section>

          {!esconderGuia && (
          <section className="mx-auto max-w-7xl px-4">
              <SectionHeader label="Operação" title="Fluxo da competição" />
                <div className="luva-surface mt-5 overflow-hidden rounded-2xl">
                  {['Cadastrar equipes e atletas', 'Gerar QR Codes de inscrição', 'Registrar súmula da partida', 'Aprovar resultado e atualizar tabela'].map((item, index) => (
                    <div key={item} className="flex items-center gap-4 border-b border-white/10 p-4 last:border-b-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-luva-amber text-sm font-black text-slate-950">{index + 1}</span>
                      <p className="text-sm font-bold text-slate-100">{item}</p>
                    </div>
                  ))}
                </div>
            </section>
          )}

          <section>
            <div className="mx-auto max-w-7xl px-4 py-10">
              <SectionHeader label={liga?.nome || 'Elencos'} title="Equipes participantes" />
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
