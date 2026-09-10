import Link from 'next/link'
import { CalendarPlus, ChevronDown, Trophy } from 'lucide-react'

type LigaScope = {
  id: number
  nome: string
  slug: string
  status?: string
}

type LeagueScopeBarProps = {
  ligas: LigaScope[]
  selected?: LigaScope | null
  organizadorId?: string | null
  basePath: string
}

export function LeagueScopeBar({ ligas, selected, organizadorId, basePath }: LeagueScopeBarProps) {
  if (!organizadorId) return null

  return (
    <section className="mx-auto max-w-7xl px-4 pt-8">
      <div className="creator-scope-bar flex flex-col gap-4 rounded-[1.5rem] border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-luva-amber">Área do criador</p>
          <h2 className="mt-1 truncate font-display text-2xl font-black text-white">
            {selected?.nome ?? 'Nenhum campeonato criado'}
          </h2>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {ligas.length > 0 && (
            <details className="creator-league-menu relative">
              <summary className="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-black">
                Trocar campeonato
                <ChevronDown size={16} />
              </summary>
              <div className="absolute right-0 z-20 mt-2 grid min-w-72 gap-2 rounded-2xl border p-2 shadow-2xl">
                {ligas.map((liga) => (
                  <Link
                    key={liga.id}
                    href={`${basePath}?organizador=${encodeURIComponent(organizadorId)}&ligaId=${liga.id}`}
                    className={`rounded-xl px-3 py-3 text-sm font-black transition ${selected?.id === liga.id ? 'is-active' : ''}`}
                  >
                    {liga.nome}
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.14em]">{liga.status ?? 'EM_BREVE'}</span>
                  </Link>
                ))}
              </div>
            </details>
          )}

          <Link href="/painel" className="creator-create-link inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black">
            <CalendarPlus size={17} />
            Gerenciar campeonatos
          </Link>
        </div>
      </div>
    </section>
  )
}

export function CreatorEmptyState({ organizadorId, title, description }: { organizadorId?: string | null; title: string; description: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="creator-empty-state rounded-[2rem] border p-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
          <Trophy size={30} />
        </span>
        <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-black text-white">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-200">{description}</p>
        {organizadorId && (
          <Link href="/painel" className="creator-create-link mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black">
            <CalendarPlus size={17} />
            Criar primeiro campeonato
          </Link>
        )}
      </div>
    </section>
  )
}
