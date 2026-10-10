'use client'

import { useEffect, useState } from 'react'

export type CategoriaPublica = { id: string; nome: string }

export function useCategoriaDoCampeonato(ligaId: number | null, preferida?: string | null) {
  const [categorias, setCategorias] = useState<CategoriaPublica[]>([])
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    if (!ligaId) {
      setCategorias([])
      setCategoriaId(null)
      setPronto(true)
      return
    }
    const controle = new AbortController()
    setPronto(false)
    fetch(`/api/categorias?ligaId=${ligaId}`, { signal: controle.signal, cache: 'no-store' })
      .then(async (resposta) => {
        const json = await resposta.json()
        if (!resposta.ok) throw new Error(json.error || 'Falha')
        const lista = (Array.isArray(json.data) ? json.data : []) as CategoriaPublica[]
        setCategorias(lista)
        setCategoriaId((atual) => {
          if (atual && lista.some((item) => item.id === atual)) return atual
          if (preferida && lista.some((item) => item.id === preferida)) return preferida
          return lista[0]?.id ?? null
        })
      })
      .catch((causa) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        setCategorias([])
        setCategoriaId(null)
      })
      .finally(() => {
        if (!controle.signal.aborted) setPronto(true)
      })
    return () => controle.abort()
  }, [ligaId, preferida])

  return { categorias, categoriaId, setCategoriaId, pronto }
}

export function SeletorCategoria({
  categorias,
  valor,
  onChange,
}: {
  categorias: CategoriaPublica[]
  valor: string | null
  onChange: (id: string) => void
}) {
  if (categorias.length === 0) return null
  if (categorias.length === 1) {
    return <p className="text-sm font-bold text-slate-300">Categoria: {categorias[0].nome}</p>
  }
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categoria">
      {categorias.map((categoria) => {
        const ativa = categoria.id === valor
        return (
          <button
            key={categoria.id}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => onChange(categoria.id)}
            className={`rounded-full px-4 py-2 text-sm font-black ${ativa ? 'bg-[#ffb331] text-slate-950' : 'border border-white/15 text-white'}`}
          >
            {categoria.nome}
          </button>
        )
      })}
    </div>
  )
}

export function queryCategoria(categoriaId: string | null) {
  return categoriaId ? `&categoriaCampeonatoId=${encodeURIComponent(categoriaId)}` : ''
}
