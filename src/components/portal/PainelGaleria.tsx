'use client'

import { useEffect, useState } from 'react'

type Midia = { id: number; tipo: string; url: string; thumbUrl: string | null; titulo: string | null }

export function PainelGaleria({ ligaId }: { ligaId: number }) {
  const [midias, setMidias] = useState<Midia[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const controle = new AbortController()
    fetch(`/api/portal/galeria?ligaId=${ligaId}`, { signal: controle.signal })
      .then(async (resposta) => {
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json.error || 'Falha')
        setMidias(json.data?.midias ?? [])
      })
      .catch((causa) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setErro('Erro ao carregar dados')
      })
    return () => controle.abort()
  }, [ligaId])

  if (erro) return <p className="text-sm font-bold text-red-200">{erro}</p>
  if (!midias) return <p className="text-sm font-semibold text-slate-300">Carregando...</p>
  const fotos = midias.filter((midia) => midia.tipo !== 'VIDEO')
  if (fotos.length === 0) return <p className="text-sm font-semibold text-slate-300">Nenhuma imagem disponível</p>

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {fotos.map((foto) => (
        <figure key={foto.id} className="overflow-hidden rounded-2xl border border-white/10">
          <img src={foto.thumbUrl || foto.url} alt={foto.titulo ?? 'Foto do campeonato'} className="aspect-video w-full object-cover" loading="lazy" decoding="async" />
        </figure>
      ))}
    </div>
  )
}
