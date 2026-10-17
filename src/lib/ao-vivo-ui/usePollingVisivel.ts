'use client'

import { useEffect, useRef, useState } from 'react'
import { devePausar, INTERVALO_AO_VIVO_MS, INTERVALO_MAXIMO_MS, intervaloComRecuo } from './polling'

/** 'ok' atualiza a hora; 'falha' aplica recuo; 'parar' encerra o polling (404, partida finalizada). */
export type ResultadoConsulta = 'ok' | 'falha' | 'parar'

interface Opcoes {
  ativo?: boolean
  baseMs?: number
  maxMs?: number
}

/**
 * Consulta periódica (3 s por padrão) que:
 *  - PAUSA com a aba oculta ou sem rede e consulta na hora ao voltar (visibilitychange / online);
 *  - recua exponencialmente após falhas seguidas e zera o recuo quando a rede volta;
 *  - nunca roda duas consultas ao mesmo tempo e aborta a em voo ao desmontar.
 * `consultar` guarda o estado da tela por conta própria; o hook só controla o ritmo e a hora da última atualização.
 */
export function usePollingVisivel(consultar: (sinal: AbortSignal) => Promise<ResultadoConsulta>, opcoes: Opcoes = {}) {
  const { ativo = true, baseMs = INTERVALO_AO_VIVO_MS, maxMs = INTERVALO_MAXIMO_MS } = opcoes
  const [atualizadoEm, setAtualizadoEm] = useState<number | null>(null)
  const [falhasSeguidas, setFalhasSeguidas] = useState(0)
  const [parado, setParado] = useState(false)
  const consultarRef = useRef(consultar)
  consultarRef.current = consultar

  useEffect(() => {
    if (!ativo) return
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let controlador: AbortController | null = null
    let emVoo = false
    let falhas = 0

    const limpar = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
    }
    const estado = () => ({ visivel: document.visibilityState === 'visible', online: navigator.onLine !== false })

    const rodar = async () => {
      limpar()
      if (!vivo || emVoo || devePausar(estado())) return
      emVoo = true
      controlador = new AbortController()
      let resultado: ResultadoConsulta = 'falha'
      try {
        resultado = await consultarRef.current(controlador.signal)
      } catch {
        resultado = 'falha'
      }
      emVoo = false
      if (!vivo) return
      if (resultado === 'parar') {
        setParado(true)
        return
      }
      if (resultado === 'ok') {
        falhas = 0
        setAtualizadoEm(Date.now())
      } else {
        falhas += 1
      }
      setFalhasSeguidas(falhas)
      if (!devePausar(estado())) timer = setTimeout(() => void rodar(), intervaloComRecuo(falhas, baseMs, maxMs))
    }

    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') void rodar()
      else limpar()
    }
    const aoFicarOnline = () => {
      falhas = 0
      void rodar()
    }
    const aoFicarOffline = () => limpar()

    setParado(false)
    void rodar()
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('online', aoFicarOnline)
    window.addEventListener('offline', aoFicarOffline)
    return () => {
      vivo = false
      limpar()
      controlador?.abort()
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      window.removeEventListener('online', aoFicarOnline)
      window.removeEventListener('offline', aoFicarOffline)
    }
  }, [ativo, baseMs, maxMs])

  return { atualizadoEm, falhasSeguidas, parado }
}
