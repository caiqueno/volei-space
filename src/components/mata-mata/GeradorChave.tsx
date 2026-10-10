'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function GeradorChave({ ligaId, categoriaId }: { ligaId: number; categoriaId: string | null }) {
  const router = useRouter()

  useEffect(() => {
    let ativo = true
    fetch(`/api/organizador/ligas/${ligaId}/mata-mata/gerar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoriaCampeonatoId: categoriaId }),
    })
      .then(async (resposta) => {
        if (!ativo || !resposta.ok) return null
        return resposta.json().catch(() => null)
      })
      .then((json) => {
        if (ativo && Number(json?.data?.criados ?? 0) > 0) router.refresh()
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [categoriaId, ligaId, router])

  return null
}
