'use client'

import { createContext, useContext, type ReactNode } from 'react'

type PainelParametrizacao = {
  openSection: (section: string, etapa?: number) => void
  definirFormato: (formato: string | null) => void
}

const PainelParametrizacaoContext = createContext<PainelParametrizacao | null>(null)

export function ParametrizacaoNoPainelProvider({
  openSection,
  definirFormato,
  children,
}: {
  openSection: (section: string, etapa?: number) => void
  definirFormato: (formato: string | null) => void
  children: ReactNode
}) {
  return <PainelParametrizacaoContext.Provider value={{ openSection, definirFormato }}>{children}</PainelParametrizacaoContext.Provider>
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
