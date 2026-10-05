export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { EscolhaCampeonato } from '@/components/portal/EscolhaCampeonato'
import { PortalAgenda } from '@/components/portal/PortalAgenda'
import { CreatorEmptyState } from '@/components/organizador/LeagueScope'
import { readPublicSession } from '@/lib/auth'
import { getPortalHome } from '@/lib/portal-home'
import { createPageMetadata } from '@/lib/seo'

export const metadata = createPageMetadata({
  title: 'Portal dos campeonatos',
  description: 'Escolha um campeonato e acompanhe o ao vivo, os próximos jogos e os últimos resultados.',
  path: '/portal',
})

type PageProps = {
  searchParams?: Promise<{ organizador?: string; ligaId?: string; candidaturaId?: string; embed?: string }>
}

export default async function PortalPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {}
  const session = await readPublicSession()
  if (!params.ligaId && !params.organizador && !params.candidaturaId && session?.tipo !== 'organizador') {
    return (
      <main className="luva-shell min-h-screen overflow-hidden pb-28 lg:pb-0">
        <EscolhaCampeonato />
      </main>
    )
  }

  const { scope, liga, grupos, temMais, partidasFalha, agendaGlobal } = await getPortalHome(params)
  if (agendaGlobal || !liga) {
    return (
      <main className="luva-shell min-h-screen overflow-hidden pb-28 lg:pb-0">
        {scope.organizadorId && !scope.selectedLiga ? (
          <CreatorEmptyState organizadorId={scope.organizadorId} title="Seu portal ainda não tem campeonato." description="Crie uma competição no painel para liberar a agenda deste campeonato." />
        ) : (
          <EscolhaCampeonato />
        )}
      </main>
    )
  }

  const ligaId = liga.id as number
  const consulta = `ligaId=${ligaId}`

  return (
    <main className="luva-shell min-h-screen overflow-hidden pb-28 lg:pb-0">
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          <div className="aspect-[21/9] bg-slate-950">
            {liga.capaUrl ? (
              <img src={liga.capaUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-black text-slate-400">Sem foto principal</div>
            )}
          </div>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">Campeonato</p>
            <h1 className="mt-2 font-display text-4xl font-black text-white">{liga.nome}</h1>
            {liga.subtitulo && <p className="mt-2 text-sm font-semibold text-slate-300">{liga.subtitulo}</p>}
          </div>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <Link className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white" href={`/portal?${consulta}`}>Portal</Link>
          <Link className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white" href={`/jogos?${consulta}`}>Jogos</Link>
          <Link className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white" href={`/ao-vivo?${consulta}`}>Ao vivo</Link>
          <Link className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white" href={`/classificacao?${consulta}`}>Classificação</Link>
          <Link className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white" href={`/rankings?${consulta}`}>Rankings</Link>
          <Link className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white" href={`/galeria?${consulta}`}>Galeria</Link>
        </nav>

        <div className="mt-8">
          <PortalAgenda ligaId={ligaId} inicial={grupos} temMaisInicial={temMais} falhaInicial={partidasFalha} />
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Link href={`/classificacao?${consulta}`} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Classificação</p>
            <p className="mt-2 text-lg font-black text-white">Tabela deste campeonato</p>
          </Link>
          <Link href={`/rankings?${consulta}`} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Rankings</p>
            <p className="mt-2 text-lg font-black text-white">Destaques deste campeonato</p>
          </Link>
          <Link href={`/galeria?${consulta}`} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Galeria</p>
            <p className="mt-2 text-lg font-black text-white">Fotos deste campeonato</p>
          </Link>
        </div>
        <p className="mt-6">
          <Link href="/portal" className="text-sm font-black text-[#ffb331]">Escolher outro campeonato</Link>
        </p>
      </section>
    </main>
  )
}
