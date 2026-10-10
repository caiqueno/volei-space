export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { formatLigaFormato, formatLigaStatus } from '@/lib/format-liga'
import { isSupabaseConfigured } from '@/lib/supabase'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin'
import { createPageMetadata } from '@/lib/seo'
import { LIGA_COLUNAS_PUBLICAS } from '@/lib/liga-colunas'
import mi from '@/styles/microinteracoes.module.css'

export const metadata = createPageMetadata({
  title: 'Campeonatos de vôlei',
  description: 'Encontre campeonatos de vôlei, confira informações, participantes e inscrições disponíveis na volei.space.',
  path: '/campeonatos',
})

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'EM_BREVE', label: 'Em breve' },
  { value: 'ATIVA', label: 'Ativos' },
  { value: 'ENCERRADA', label: 'Encerrados' },
  { value: 'FINALIZADO', label: 'Finalizados' },
]

type PageProps = {
  searchParams?: Promise<{ status?: string; q?: string }>
}

export default async function CampeonatosPage({ searchParams }: PageProps) {
  noStore()
  const params = searchParams ? await searchParams : {}
  const status = params.status ?? ''
  const busca = (params.q ?? '').trim()
  let campeonatos: any[] = []

  if (isSupabaseConfigured) {
    let query = supabase
      .from('Liga')
      .select(LIGA_COLUNAS_PUBLICAS as '*')
      .eq('simulacao', false)
      .order('criadoEm', { ascending: false })

    if (status) query = query.eq('status', status)
    if (busca) {
      const safeBusca = busca.replace(/[%_,]/g, ' ')
      query = query.or(`nome.ilike.%${safeBusca}%,subtitulo.ilike.%${safeBusca}%,descricao.ilike.%${safeBusca}%`)
    }
    const { data } = await query
    campeonatos = data ?? []
  }

  function statusHref(value: string) {
    const search = new URLSearchParams()
    if (value) search.set('status', value)
    if (busca) search.set('q', busca)
    const query = search.toString()
    return query ? `/campeonatos?${query}` : '/campeonatos'
  }

  return (
    <main className="luva-shell min-h-screen">
      <section className={`orange-wave ${mi.entrar}`}>
        <div className="mx-auto max-w-7xl px-4 py-14">
          <p className="luva-kicker">Campeonatos</p>
          <h1 className="type-page-title mt-3 max-w-4xl">Campeonatos publicados</h1>
          <p className="type-lead mt-4 max-w-2xl">
            Escolha um campeonato para acompanhar a tabela, os jogos e as equipes.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="championship-filter-bar flex flex-col gap-3 rounded-[1.5rem] border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="type-kicker text-luva-amber">Filtro</p>
            <p className={`type-lead mt-1 ${mi.numero}`}>{campeonatos.length === 1 ? '1 campeonato nesta lista' : `${campeonatos.length} campeonatos nesta lista`}</p>
          </div>
          <form action="/campeonatos" className="flex flex-col gap-2 sm:min-w-[280px] sm:flex-row">
            {status && <input type="hidden" name="status" value={status} />}
            <input
              name="q"
              defaultValue={busca}
              placeholder="Buscar campeonato..."
              className="championship-search-input rounded-full border px-4 py-2 text-sm font-bold"
            />
            <button className="championship-filter-button rounded-full px-4 py-2 text-sm font-black">Buscar</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <Link
                key={option.value || 'todos'}
                href={statusHref(option.value)}
                className={`championship-filter-button rounded-full px-4 py-2 text-sm font-black ${status === option.value ? 'is-active' : ''}`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        {campeonatos.length === 0 ? (
          <div className="mt-8">
            <EstadoVazio titulo="Nenhum campeonato publicado" descricao="Quando organizadores criarem campeonatos, eles aparecerão nesta página." />
          </div>
        ) : (
          <div className="championship-list mt-8">
            <div className="championship-list-row championship-list-head">
              <span>Nome</span>
              <span>Status</span>
              <span>Descrição</span>
              <span>Equipes</span>
              <span>Formato</span>
              <span>Inscrições</span>
              <span>Ação</span>
            </div>
            {campeonatos.map((liga, index) => (
              <article key={liga.id} className={`championship-list-row ${mi.linha} ${mi.entrar}`} style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
                <div className="championship-list-main">
                  <h2>{liga.nome}</h2>
                  {liga.subtitulo && <small>{liga.subtitulo}</small>}
                </div>
                <span data-label="Status">{formatLigaStatus(liga.status)}</span>
                <span className="championship-list-description" data-label="Descrição">{liga.descricao || 'Campeonato publicado na plataforma volei.space.'}</span>
                <span className={mi.numero} data-label="Equipes">{liga.quantidadeEquipes ?? 'A definir'}</span>
                <span data-label="Formato">{formatLigaFormato(liga.formato)}</span>
                <span data-label="Inscrições">{liga.inscricoesAbertas === false ? 'Fechadas' : 'Abertas'}</span>
                <Link href={`/campeonatos/${liga.slug}`} className="championship-list-link">
                  Ver campeonato
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
