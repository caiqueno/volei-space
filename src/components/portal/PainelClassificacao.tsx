'use client'

import { QuadroPublico } from '@/components/portal/QuadroPublico'
import { SeletorCategoria, useCategoriaDoCampeonato } from '@/components/portal/SeletorCategoria'

export function PainelClassificacao({ ligaId, categoriaInicial = null, campeonato }: { ligaId: number; categoriaInicial?: string | null; campeonato?: string }) {
  const { categorias, categoriaId, setCategoriaId, pronto } = useCategoriaDoCampeonato(ligaId, categoriaInicial)
  if (!pronto) return <p className="text-sm font-semibold text-vs-muted">Carregando...</p>
  return (
    <div className="grid gap-4">
      <SeletorCategoria categorias={categorias} valor={categoriaId} onChange={setCategoriaId} />
      <QuadroPublico ligaId={ligaId} categoriaId={categoriaId} destaque="classificacao" campeonato={campeonato} />
    </div>
  )
}
