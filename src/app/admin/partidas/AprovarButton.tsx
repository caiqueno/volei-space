'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionBar } from '@/components/ui/action-bar'

export function AprovarButton({ partidaId }: { partidaId: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleAprovar() {
    if (!confirm('Aprovar esta súmula? A classificação será recalculada.')) return
    setErro('')
    setLoading(true)
    try {
      const res = await fetch(`/api/partidas/${partidaId}/aprovar`, { method: 'POST' })
      const json = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao aprovar')
      router.refresh()
    } catch (err) {
      if (err instanceof TypeError) setErro('Falha na conexão')
      else setErro(err instanceof Error ? err.message : 'Erro ao aprovar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <ActionBar
        onClick={handleAprovar}
        loading={loading}
        loadingLabel="Aprovando"
        className="text-xs bg-luva-amber text-luva-navy font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        Aprovar
      </ActionBar>
      {erro && <p className="text-xs text-red-500 mt-1">{erro}</p>}
    </div>
  )
}
