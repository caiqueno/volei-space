'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarPlus, Trophy } from 'lucide-react'
import PageLoading from '@/components/ui/page-loading'
import { formatLigaFormato, formatLigaStatusLabel, type LigaPanel } from '@/lib/liga-panel'

type Session = {
  tipo: string
  candidaturaId?: string | null
}

export default function MeusCampeonatosPage() {
  const [hydrated, setHydrated] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [ligas, setLigas] = useState<LigaPanel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      setSession(JSON.parse(window.localStorage.getItem('luva_session') ?? 'null'))
    } catch {
      setSession(null)
    }
    setHydrated(true)
  }, [])

  const organizadorId = session?.candidaturaId

  useEffect(() => {
    if (!organizadorId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/ligas?organizadorId=${encodeURIComponent(organizadorId)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        setLigas(Array.isArray(json.data) ? json.data : [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizadorId])

  if (!hydrated || loading) {
    return (
      <main className="luva-shell public-dashboard creator-dashboard min-h-screen">
        <PageLoading label="Carregando seus campeonatos..." />
      </main>
    )
  }

  if (!session || session.tipo !== 'organizador') {
    return (
      <main className="luva-shell public-dashboard min-h-screen px-4 py-10 text-white">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="font-display text-3xl font-black">Acesso restrito</h1>
          <p className="mt-3 text-sm font-semibold text-slate-300">Entre com sua conta de organizador para ver seus campeonatos.</p>
          <Link href="/painel" className="mt-6 inline-flex rounded-full bg-[#ffb331] px-5 py-3 text-sm font-black text-white">Voltar ao painel</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="luva-shell public-dashboard creator-dashboard min-h-screen text-white">
      <section className="border-b border-white/10 bg-[#061426]/95 px-4 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/painel" className="inline-flex items-center gap-2 text-sm font-black text-luva-amber">
              <ArrowLeft size={18} />
              Voltar ao painel
            </Link>
            <p className="luva-kicker mt-5">Biblioteca</p>
            <h1 className="type-page-title mt-2">Meus campeonatos</h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        {ligas.length === 0 ? (
          <div className="creator-empty-mini rounded-2xl border p-6 text-center">
            <p className="font-black text-white">Você ainda não criou nenhum campeonato.</p>
            <Link
              href="/painel"
              className="public-primary-action mt-4 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition"
            >
              <CalendarPlus size={18} />
              Criar meu primeiro campeonato
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {ligas.map((liga) => (
              <div key={liga.id} className="creator-league-card relative rounded-2xl border p-4 transition hover:-translate-y-0.5">
                <Link
                  href={`/painel/parametrizacao?ligaId=${liga.id}`}
                  className="absolute inset-0 z-0 rounded-2xl"
                  aria-label={`Configurar ${liga.nome}`}
                />
                <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-display text-xl font-black text-white">
                      <Trophy size={18} className="shrink-0 text-luva-amber" />
                      {liga.nome}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-200">
                      {liga.subtitulo || 'Campeonato sem subtítulo'} · {formatLigaFormato(liga.formato)}
                    </p>
                  </div>
                  <span className="w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-black tracking-[0.04em] text-luva-amber">
                    {formatLigaStatusLabel(liga.status)}
                  </span>
                </div>
                <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                  <Link href={`/portal?ligaId=${liga.id}`} className="creator-mini-action">Portal</Link>
                  <Link href={`/classificacao?ligaId=${liga.id}`} className="creator-mini-action">Classificação</Link>
                  <Link href={`/jogos?ligaId=${liga.id}`} className="creator-mini-action">Jogos</Link>
                  <Link href={`/campeonatos/${liga.slug}`} className="creator-mini-action">Link público</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
