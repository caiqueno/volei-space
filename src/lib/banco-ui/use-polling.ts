'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { intervaloPolling, semConexao as calcSemConexao } from './polling'

/**
 * Executa `tarefa` já e depois a cada 3 s (recuo exponencial em falha). Pausa com a aba oculta e retoma, com uma
 * rodada imediata, ao voltar à aba ou quando a rede volta. A tarefa lança erro para contar falha e devolve 'parar'
 * para encerrar o polling (ex.: link revogado).
 */
export function usePolling(tarefa: () => Promise<'parar' | void>, ativo = true) {
  const tarefaRef = useRef(tarefa)
  const falhasRef = useRef(0)
  const rodarRef = useRef<() => void>(() => {})
  const [falhas, setFalhas] = useState(0)
  const [ultima, setUltima] = useState<Date | null>(null)

  useEffect(() => {
    tarefaRef.current = tarefa
  })

  useEffect(() => {
    if (!ativo) return
    let cancelado = false
    let parado = false
    let rodando = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const agendar = () => {
      if (cancelado || parado || document.hidden) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(ciclo, intervaloPolling(falhasRef.current))
    }
    async function ciclo() {
      if (cancelado || rodando) return
      rodando = true
      try {
        const r = await tarefaRef.current()
        if (cancelado) return
        if (r === 'parar') parado = true
        falhasRef.current = 0
        setFalhas(0)
        setUltima(new Date())
      } catch {
        if (cancelado) return
        falhasRef.current += 1
        setFalhas(falhasRef.current)
      } finally {
        rodando = false
      }
      agendar()
    }
    const aoMudarVisibilidade = () => {
      if (timer) clearTimeout(timer)
      if (!document.hidden && !parado) void ciclo()
    }
    const aoVoltarRede = () => {
      if (timer) clearTimeout(timer)
      if (!parado) void ciclo()
    }
    rodarRef.current = () => {
      if (timer) clearTimeout(timer)
      void ciclo()
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    window.addEventListener('online', aoVoltarRede)
    void ciclo()
    return () => {
      cancelado = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      window.removeEventListener('online', aoVoltarRede)
    }
  }, [ativo])

  const atualizarAgora = useCallback(() => rodarRef.current(), [])
  return { falhas, semConexao: calcSemConexao(falhas), ultimaAtualizacao: ultima, atualizarAgora }
}
