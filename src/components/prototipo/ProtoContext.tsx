'use client'

import { createContext, useCallback, useContext, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react'
import { placarInicial, reducerPlacar, type AcaoPlacar, type EstadoPlacar } from '@/lib/prototipo/placar'
import { papeletaVazia, type Papeleta } from '@/lib/prototipo/papeleta'

interface ProtoValor {
  placar: EstadoPlacar
  dispatch: Dispatch<AcaoPlacar>
  papeleta: Papeleta
  setPapeleta: (p: Papeleta) => void
  papeletaEnviada: boolean
  setPapeletaEnviada: (v: boolean) => void
  versao: number
  reiniciar: () => void
}

const Ctx = createContext<ProtoValor | null>(null)

/** Estado apenas em memória: some ao recarregar a página. Nada vai para storage nem rede. */
export function ProtoProvider({ children }: { children: ReactNode }) {
  const [placar, dispatch] = useReducer(reducerPlacar, undefined, placarInicial)
  const [papeleta, setPapeleta] = useState<Papeleta>(papeletaVazia)
  const [papeletaEnviada, setPapeletaEnviada] = useState(false)
  const [versao, setVersao] = useState(0)

  const reiniciar = useCallback(() => {
    dispatch({ tipo: 'reiniciar' })
    setPapeleta(papeletaVazia())
    setPapeletaEnviada(false)
    setVersao((v) => v + 1)
  }, [])

  const valor = useMemo(
    () => ({ placar, dispatch, papeleta, setPapeleta, papeletaEnviada, setPapeletaEnviada, versao, reiniciar }),
    [placar, papeleta, papeletaEnviada, versao, reiniciar],
  )
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useProto(): ProtoValor {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProto fora do ProtoProvider')
  return v
}
