export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { EscolhaCampeonato } from '@/components/portal/EscolhaCampeonato'
import { PortalAgenda } from '@/components/portal/PortalAgenda'
import { LinksCategoriaPublica } from '@/components/portal/LinksCategoriaPublica'
import { VistaChavePublica } from '@/components/portal/VistaChavePublica'
import { getPortalHome } from '@/lib/portal-home'
import { carregarChavePublica } from '@/lib/portal-chave'
import { capaDoCampeonato } from '@/lib/capa-publica'
import { createPageMetadata } from '@/lib/seo'

export const metadata = createPageMetadata({
  title: 'Portal dos campeonatos',
  description: 'Escolha um campeonato e acompanhe o ao vivo, os próximos jogos e os últimos resultados.',
  path: '/portal',
})

type PageProps = {
  searchParams?: Promise<{ organizador?: string; ligaId?: string; candidaturaId?: string; embed?: string; categoria?: string }>
}

export default async function PortalPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {}
  if (!params.ligaId) {
    return (
      <main className="luva-shell min-h-screen overflow-hidden pb-28 lg:pb-0">
        <EscolhaCampeonato />
      </main>
    )
  }

  const { liga, grupos, temMais, partidasFalha, agendaGlobal, categorias, categoriaCampeonatoId } = await getPortalHome({ ligaId: params.ligaId, categoria: params.categoria })
  if (agendaGlobal || !liga) {
    return (
      <main className="luva-shell min-h-screen overflow-hidden pb-28 lg:pb-0">
        <EscolhaCampeonato />
      </main>
    )
  }

  const ligaId = liga.id as number
  const chave = await carregarChavePublica(ligaId, categoriaCampeonatoId)

  return (
    <main className="luva-shell min-h-screen overflow-hidden pb-28 lg:pb-0">
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          <div className="aspect-[21/9] bg-slate-950">
            <img src={capaDoCampeonato(ligaId, liga.capaUrl, liga.logoUrl)} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffb331]">Campeonato</p>
            <h1 className="mt-2 font-display text-4xl font-black text-white">{liga.nome}</h1>
            {liga.subtitulo && <p className="mt-2 text-sm font-semibold text-slate-300">{liga.subtitulo}</p>}
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          <LinksCategoriaPublica
            categorias={categorias ?? []}
            atual={categoriaCampeonatoId ?? null}
            href={(id) => `/portal?ligaId=${ligaId}&categoria=${encodeURIComponent(id)}`}
          />
          <VistaChavePublica ligaId={ligaId} chave={chave} campeonato={liga.nome} />
          <PortalAgenda ligaId={ligaId} inicial={grupos} temMaisInicial={temMais} falhaInicial={partidasFalha} categoriaId={categoriaCampeonatoId ?? null} compartilhar campeonato={liga.nome} />
        </div>
        <p className="mt-6">
          <Link href="/portal" className="text-sm font-black text-[#ffb331]">Escolher outro campeonato</Link>
        </p>
      </section>
    </main>
  )
}
