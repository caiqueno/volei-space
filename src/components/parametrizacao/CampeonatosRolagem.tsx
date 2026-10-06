'use client'

import { useEffect, useState } from 'react'
import { consultar } from '@/lib/api-cliente'
import { useRouter } from 'next/navigation'

type CampeonatoAba = { id: number; nome: string }

export function CampeonatosRolagem({
  ligas,
  selecionado,
  onSelect,
}: {
  ligas: CampeonatoAba[]
  selecionado: number | null
  onSelect: (id: number) => void
}) {
  if (ligas.length === 0) return null
  const ativo = ligas.some((liga) => liga.id === selecionado) ? selecionado : ligas[0].id

  return (
    <div className="is-scroll-row flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Campeonatos cadastrados">
      {ligas.map((liga) => {
        const ativa = liga.id === ativo
        return (
          <button
            key={liga.id}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => onSelect(liga.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${ativa ? 'bg-luva-amber text-[#050914]' : 'border border-white/15 text-white hover:border-luva-amber/60'}`}
          >
            {liga.nome}
          </button>
        )
      })}
    </div>
  )
}

export function CampeonatosRolagemDaSecao({ ligaId, secao }: { ligaId: number; secao: string }) {
  const router = useRouter()
  const [ligas, setLigas] = useState<CampeonatoAba[]>([])

  useEffect(() => {
    const stored = JSON.parse(window.localStorage.getItem('luva_session') ?? 'null') as { candidaturaId?: string } | null
    const organizadorId = stored?.candidaturaId
    if (!organizadorId) return
    let cancelled = false
    const controlador = new AbortController()
    consultar<{ data?: Array<{ id: number; nome: string }> }>(`/api/ligas?organizadorId=${encodeURIComponent(organizadorId)}`, { signal: controlador.signal })
      .then((payload) => {
        if (cancelled) return
        const rows = Array.isArray(payload.data) ? payload.data : []
        setLigas(rows.map((liga: { id: number; nome: string }) => ({ id: liga.id, nome: liga.nome })))
      })
      .catch(() => {})
    return () => {
      cancelled = true
      controlador.abort()
    }
  }, [])

  return (
    <CampeonatosRolagem
      ligas={ligas}
      selecionado={ligaId}
      onSelect={(id) => {
        if (id === ligaId) return
        router.push(`/painel/parametrizacao/${secao}?ligaId=${id}`)
      }}
    />
  )
}
