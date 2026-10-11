'use client'

import { useEffect, useState } from 'react'
import { VistaChavePublica } from '@/components/portal/VistaChavePublica'
import { queryCategoria } from '@/components/portal/SeletorCategoria'
import type { ChavePublica } from '@/lib/portal-chave'

const VAZIA: ChavePublica = { temMataMata: false, rounds: [], champion: null, thirdPlace: null, podium: [] }

export function PainelChavePublica({ ligaId, categoriaId }: { ligaId: number; categoriaId: string | null }) {
  const [chave, setChave] = useState<ChavePublica | null>(null)

  useEffect(() => {
    const controle = new AbortController()
    setChave(null)
    fetch(`/api/portal/mata-mata?ligaId=${ligaId}${queryCategoria(categoriaId)}`, { cache: 'no-store', signal: controle.signal })
      .then(async (resposta) => {
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json.error || 'Falha')
        setChave(json.data ?? VAZIA)
      })
      .catch((causa) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setChave(VAZIA)
      })
    return () => controle.abort()
  }, [ligaId, categoriaId])

  if (!chave?.temMataMata) return null
  return <VistaChavePublica ligaId={ligaId} chave={chave} categoriaId={categoriaId} />
}
