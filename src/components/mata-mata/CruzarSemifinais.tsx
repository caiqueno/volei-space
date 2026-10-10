'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CruzarSemifinais({ ligaId, categoriaId }: { ligaId: number; categoriaId: string | null }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [mensagem, setMensagem] = useState('')

  async function cruzar() {
    if (!categoriaId) {
      setMensagem('Escolha a categoria antes de cruzar as semifinais.')
      return
    }
    setOcupado(true)
    setMensagem('')
    try {
      const resposta = await fetch(`/api/organizador/ligas/${ligaId}/mata-mata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'cruzar-grupos', categoriaCampeonatoId: categoriaId }),
      })
      const json = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(json.error || 'Não foi possível cruzar as semifinais.')
      router.refresh()
    } catch (falha) {
      setMensagem(falha instanceof Error ? falha.message : 'Não foi possível cruzar as semifinais.')
      setOcupado(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-[#ffb331]/30 bg-[#ffb331]/10 p-4">
      <p className="text-sm font-bold text-white">Semifinais: 1º do Grupo A × 2º do Grupo B e 1º do Grupo B × 2º do Grupo A. A final e o 3º lugar entram depois do resultado.</p>
      <button type="button" onClick={() => void cruzar()} disabled={ocupado} className="mt-3 rounded-full bg-[#ffb331] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-950 disabled:opacity-60">
        {ocupado ? 'Cruzando' : 'Cruzar semifinais'}
      </button>
      {mensagem ? <p className="mt-2 text-sm font-bold text-red-200">{mensagem}</p> : null}
    </div>
  )
}
