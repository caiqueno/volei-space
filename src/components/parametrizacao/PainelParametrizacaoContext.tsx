'use client'

import { createContext, useContext, type ReactNode } from 'react'

type PainelParametrizacao = {
  openSection: (section: string) => void
}

const PainelParametrizacaoContext = createContext<PainelParametrizacao | null>(null)

export function ParametrizacaoNoPainelProvider({
  openSection,
  children,
}: {
  openSection: (section: string) => void
  children: ReactNode
}) {
  return <PainelParametrizacaoContext.Provider value={{ openSection }}>{children}</PainelParametrizacaoContext.Provider>
}

export function useParametrizacaoNoPainel() {
  return useContext(PainelParametrizacaoContext) !== null
}

export function useAbrirSecaoParametrizacao() {
  return useContext(PainelParametrizacaoContext)?.openSection ?? null
}
