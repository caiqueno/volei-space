'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function EscalarArbitroButton({ candidaturaId }: { candidaturaId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleClick() {
    setErro('')
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/partidas-candidaturas/${candidaturaId}/aprovar`, { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? 'Erro ao escalar árbitro.')
      router.refresh()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao escalar árbitro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-full bg-luva-amber px-3 py-1.5 text-xs font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Escalando...' : 'Escalar'}
      </button>
      {erro && <p className="max-w-48 text-xs font-bold text-red-300">{erro}</p>}
    </div>
  )
}
