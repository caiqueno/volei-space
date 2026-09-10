'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChampionshipSetupDashboard } from '@/components/parametrizacao/ChampionshipSetupDashboard'
import { EstadoVazio } from '@/components/ui/EstadoVazio'

function ParametrizacaoContent() {
  const searchParams = useSearchParams()
  const ligaId = Number(searchParams.get('ligaId'))

  if (!Number.isInteger(ligaId) || ligaId <= 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EstadoVazio
          titulo="Campeonato não informado"
          descricao="Acesse a Central de Parametrização a partir do card do campeonato no painel."
        />
      </div>
    )
  }

  return <ChampionshipSetupDashboard ligaId={ligaId} />
}

export default function ParametrizacaoPage() {
  return (
    <main className="luva-shell public-dashboard creator-dashboard min-h-screen text-white">
      <Suspense fallback={<main className="luva-shell public-dashboard min-h-screen p-8 text-white">Carregando...</main>}>
        <ParametrizacaoContent />
      </Suspense>
    </main>
  )
}
