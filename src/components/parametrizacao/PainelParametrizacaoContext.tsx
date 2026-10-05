'use client'

import { createContext, useContext, type ReactNode } from 'react'

type PainelParametrizacao = {
  openSection: (section: string, etapa?: number) => void
  definirFormato: (formato: string | null) => void
  categoriaAtivaId: string | null
  definirCategoriaAtiva: (id: string) => void
}

const PainelParametrizacaoContext = createContext<PainelParametrizacao | null>(null)

export function ParametrizacaoNoPainelProvider({
  openSection,
  definirFormato,
  categoriaAtivaId,
  definirCategoriaAtiva,
  children,
}: {
  openSection: (section: string, etapa?: number) => void
  definirFormato: (formato: string | null) => void
  categoriaAtivaId: string | null
  definirCategoriaAtiva: (id: string) => void
  children: ReactNode
}) {
  return (
    <PainelParametrizacaoContext.Provider value={{ openSection, definirFormato, categoriaAtivaId, definirCategoriaAtiva }}>
      {children}
    </PainelParametrizacaoContext.Provider>
  )
}

export function useParametrizacaoNoPainel() {
  return useContext(PainelParametrizacaoContext) !== null
}

export function useAbrirSecaoParametrizacao() {
  return useContext(PainelParametrizacaoContext)?.openSection ?? null
}

export function useDefinirFormatoCampeonato() {
  return useContext(PainelParametrizacaoContext)?.definirFormato ?? null
}

export function useDefinirCategoriaAtiva() {
  return useContext(PainelParametrizacaoContext)?.definirCategoriaAtiva ?? null
}

/** `undefined` fora do painel, para a rota usar a URL. No painel, `null` significa que ainda não há categoria ativa. */
export function useCategoriaAtivaNoPainel() {
  const painel = useContext(PainelParametrizacaoContext)
  if (!painel) return undefined
  return painel.categoriaAtivaId
}
