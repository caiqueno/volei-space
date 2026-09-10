'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
      if (res.ok) {
        router.refresh()
      } else {
        const j = await res.json()
        setErro(j.error ?? 'Erro ao aprovar')
      }
    } catch {
      setErro('Falha na conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleAprovar}
        disabled={loading}
        className="text-xs bg-luva-amber text-luva-navy font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? '...' : 'Aprovar'}
      </button>
      {erro && <p className="text-xs text-red-500 mt-1">{erro}</p>}
    </div>
  )
}
