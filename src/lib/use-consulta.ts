'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ConsultaCancelada, consultar } from '@/lib/api-cliente'
import { LIMIAR_INDICADOR_MS, type EstadoConsulta } from '@/lib/desempenho'

export function useConsulta<T>(url: string | null) {
  const [estado, setEstado] = useState<EstadoConsulta>('idle')
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [lento, setLento] = useState(false)
  const dadosRef = useRef<T | null>(null)

  const executar = useCallback((forcar = false) => {
    if (!url) {
      setEstado('idle')
      return () => {}
    }
    const controlador = new AbortController()
    const tinhaDados = dadosRef.current != null
    setEstado(tinhaDados ? 'refetching' : 'loading')
    setErro(null)
    setLento(false)
    const aviso = window.setTimeout(() => setLento(true), LIMIAR_INDICADOR_MS)

    consultar<T>(url, { signal: controlador.signal, forcar })
      .then((payload) => {
        dadosRef.current = payload
        setDados(payload)
        setEstado('success')
      })
      .catch((erroConsulta: unknown) => {
        if (erroConsulta instanceof ConsultaCancelada || controlador.signal.aborted) return
        setErro(erroConsulta instanceof Error ? erroConsulta.message : 'Não foi possível carregar os dados.')
        setEstado('error')
      })
      .finally(() => {
        window.clearTimeout(aviso)
        setLento(false)
      })

    return () => controlador.abort()
  }, [url])

  useEffect(() => {
    return executar()
  }, [executar])

  return {
    estado,
    dados,
    erro,
    lento,
    carregando: estado === 'loading',
    atualizando: estado === 'refetching',
    tentarNovamente: () => executar(true),
  }
}
