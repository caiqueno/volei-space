export const dynamic = 'force-dynamic'

import { Camera, Image as ImageIcon, PlaySquare } from 'lucide-react'
import { PageHero } from '@/components/layout/PageHero'
import { CreatorEmptyState, LeagueScopeBar } from '@/components/organizador/LeagueScope'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { getCreatorLeagueScope } from '@/lib/league-scope'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { createPageMetadata } from '@/lib/seo'

export const metadata = createPageMetadata({
  title: 'Galeria dos campeonatos',
  description: 'Veja fotos, vídeos, cobertura e momentos dos campeonatos de vôlei publicados na volei.space.',
  path: '/galeria',
})

const demoMidias = [
  { id: 1, tipo: 'FOTO', url: '/brand/banner-oficial.png', titulo: 'Abertura da temporada', tag: 'Destaque' },
  { id: 2, tipo: 'FOTO', url: '/brand/volei-space_simbolo-orbital_transparente.png', titulo: 'Identidade volei.space', tag: 'Liga' },
]

type PageProps = {
  searchParams?: Promise<{ organizador?: string; ligaId?: string }>
}

export default async function GaleriaPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {}
  const scope = isSupabaseConfigured ? await getCreatorLeagueScope(params) : { organizadorId: null, ligas: [], selectedLiga: null }
  let midias: any[] = demoMidias

  if (isSupabaseConfigured) {
    if (scope.organizadorId && !scope.selectedLiga) {
      midias = []
    } else if (!scope.selectedLiga) {
      midias = []
    } else {
      const { data } = await supabase.from('Midia').select('id,ligaId,tipo,url,thumbUrl,titulo,tag,criadoEm').eq('ligaId', scope.selectedLiga.id).order('criadoEm', { ascending: false }).limit(24)
      midias = data ?? []
    }
  }

  const fotos = midias.filter((midia: any) => midia.tipo === 'FOTO')
  const videos = midias.filter((midia: any) => midia.tipo === 'VIDEO')

  return (
    <main className="luva-shell min-h-screen pb-28 lg:pb-0">
      <PageHero
        eyebrow={<><Camera size={16} /> Bastidores</>}
        title={scope.selectedLiga ? `Galeria - ${scope.selectedLiga.nome}` : 'Galeria da liga'}
        description={scope.organizadorId ? 'Fotos e vídeos filtrados pelo campeonato selecionado.' : 'Fotos, vídeos e registros da temporada para atletas, equipes, patrocinadores e torcida.'}
        aside={
          <div className="grid grid-cols-3 gap-3">
            <Metric label="mídias" value={midias.length} />
            <Metric label="fotos" value={fotos.length} />
            <Metric label="vídeos" value={videos.length} />
          </div>
        }
      />

      <LeagueScopeBar ligas={scope.ligas} selected={scope.selectedLiga} organizadorId={scope.organizadorId} basePath="/galeria" />

      <section className="mx-auto max-w-7xl px-4 py-8">
        {scope.organizadorId && !scope.selectedLiga ? (
          <CreatorEmptyState organizadorId={scope.organizadorId} title="Nenhuma galeria disponível." description="Crie um campeonato no painel do criador. As mídias poderão ser organizadas por competição." />
        ) : !scope.selectedLiga ? (
          <EstadoVazio titulo="Escolha um campeonato" descricao="A galeria abre dentro do campeonato." acao={<a href="/portal" className="inline-flex rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-slate-950">Ir ao portal</a>} />
        ) : midias.length === 0 ? (
          <EstadoVazio titulo="Nenhuma mídia disponível ainda" descricao="As fotos e vídeos da temporada aparecerão aqui quando forem publicados." />
        ) : (
          <div className="grid gap-10">
            {fotos.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <ImageIcon size={20} className="text-luva-amber" />
                  <h2 className="font-display text-2xl font-black text-white">Fotos</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {fotos.map((foto: any, index: number) => (
                    <figure key={foto.id} className={`gallery-card overflow-hidden rounded-2xl border ${index === 0 ? 'sm:col-span-2 sm:row-span-2' : ''}`}>
                      <div className={`${index === 0 ? 'aspect-[16/10]' : 'aspect-square'} bg-slate-950/60`}>
                        <a href={foto.url} target="_blank" rel="noreferrer">
                          <img src={foto.thumbUrl || foto.url} alt={foto.titulo ?? 'Foto do campeonato'} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                        </a>
                      </div>
                      <figcaption className="p-4">
                        <p className="font-black text-white">{foto.titulo ?? 'Registro da temporada'}</p>
                        {foto.tag && <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-200">{foto.tag}</p>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {videos.length > 0 && (
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <PlaySquare size={20} className="text-luva-amber" />
                  <h2 className="font-display text-2xl font-black text-white">Vídeos</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {videos.map((video: any) => (
                    <div key={video.id} className="gallery-card overflow-hidden rounded-2xl border">
                      <div className="aspect-video bg-slate-950/60">
                        <iframe src={video.url} className="h-full w-full" allowFullScreen title={video.titulo ?? 'Vídeo da liga'} />
                      </div>
                      <div className="p-4">
                        <p className="font-black text-white">{video.titulo ?? 'Vídeo da temporada'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
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
