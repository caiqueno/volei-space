'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PageLoading from '@/components/ui/page-loading'
import { EstadoVazio } from '@/components/ui/EstadoVazio'
import { ChampionshipSetupCardList } from './ChampionshipSetupCardList'
import { LinkDoTime } from '@/components/painel/organizador/LinkDoTime'
import type { ChampionshipSetupOverviewDTO } from '@/types/championship-setup'

export function ChampionshipSetupDashboard({ ligaId }: { ligaId: number }) {
  const [overview, setOverview] = useState<ChampionshipSetupOverviewDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErrorMessage(null)

    fetch(`/api/organizador/ligas/${ligaId}/setup`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Erro ao carregar a parametrização do campeonato.')
        return payload.data as ChampionshipSetupOverviewDTO
      })
      .then((data) => {
        if (!cancelled) setOverview(data)
      })
      .catch((err) => {
        if (!cancelled) setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar a parametrização do campeonato.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ligaId])

  if (loading) return <PageLoading label="Carregando parametrização..." />

  if (errorMessage || !overview) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EstadoVazio
          titulo="Não foi possível carregar a parametrização"
          descricao={errorMessage ?? 'Campeonato não encontrado.'}
          acao={
            <Link href="/painel" className="public-secondary-action inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black">
              <ArrowLeft size={16} /> Voltar ao painel
            </Link>
          }
        />
      </div>
    )
  }

  const { progress, cards } = overview

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/painel" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white">
        <ArrowLeft size={16} /> Voltar ao painel
      </Link>

      <p className="luva-kicker mt-6">Parametrização do campeonato</p>
      <h1 className="mt-3 font-display text-3xl font-black text-white md:text-4xl">Central de Parametrização</h1>
      <div className="mt-6">
        <LinkDoTime ligaId={ligaId} nome={overview.nome} />
      </div>

      {/* <p>/<strong>, não <span>: dentro de main.luva-shell, cor de texto em
          <span> é neutralizada por uma regra global mais específica. */}
      <div className="mt-6 flex items-center justify-between text-sm font-semibold text-slate-300">
        <p>{progress.completedSections} de {progress.totalSections} sessões configuradas</p>
        <strong className="font-display text-lg font-black text-luva-amber">{progress.percent}%</strong>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-luva-amber transition-all duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="mt-8">
        <ChampionshipSetupCardList cards={cards} />
      </div>
    </div>
  )
}
