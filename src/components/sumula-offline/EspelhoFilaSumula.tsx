'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'
import { IndicadorConexao } from '@/components/sumula-offline/IndicadorConexao'
import { useFilaSumula } from '@/lib/sumula-offline/useFilaSumula'
import { espelharOcorrencia, LivroEspelho, type Ocorrencia } from '@/lib/sumula-ui/fila-adaptador'

/** API que a tela usa para alimentar a fila. Só existe enquanto este componente está montado (flag ligada). */
export interface EspelhoApi {
  /** Traduz e enfileira. Nunca lança; falha de tradução descarta o evento com log discreto. */
  espelhar(ocorrencia: Ocorrencia): void
  /** Encerra a partida: tenta um último envio e apaga a fila deste token. */
  encerrar(): Promise<void>
}

const ESPERA_MAXIMA_ENCERRAR_MS = 4000

interface Props {
  token: string
  apiRef: MutableRefObject<EspelhoApi | null>
}

/**
 * Modo sombra da fila offline (só é renderizado com NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO=1).
 * Não grava nada da súmula: o PUT continua sendo a fonte. Mostra o estado da conexão e as pendências do motor.
 * Fica fixo no topo, ao centro, sem cobrir os botões de ponto; o painel de pendências só abre por toque.
 */
export function EspelhoFilaSumula({ token, apiRef }: Props) {
  const fila = useFilaSumula(token)
  const filaRef = useRef(fila)
  filaRef.current = fila
  const livroRef = useRef(new LivroEspelho())
  const encerradaRef = useRef(false)

  useEffect(() => {
    livroRef.current = new LivroEspelho()
    encerradaRef.current = false
    apiRef.current = {
      espelhar(ocorrencia) {
        if (encerradaRef.current) return
        espelharOcorrencia(
          { enfileirar: (evento) => filaRef.current.enfileirar(evento) },
          livroRef.current,
          ocorrencia,
          (motivo) => console.debug('[sumula-fila] evento descartado:', motivo),
        )
      },
      async encerrar() {
        if (encerradaRef.current) return
        encerradaRef.current = true
        try {
          await Promise.race([filaRef.current.sincronizar(), new Promise((resolve) => setTimeout(resolve, ESPERA_MAXIMA_ENCERRAR_MS))])
        } catch {
          // Sem rede: a limpeza abaixo segue valendo, o PUT é a fonte da súmula.
        }
        try {
          await filaRef.current.limpar()
        } catch {
          // Armazenamento indisponível: nada a fazer.
        }
      },
    }
    return () => {
      apiRef.current = null
    }
  }, [token, apiRef])

  const { snapshot } = fila
  const pendencias = snapshot.pendencias

  return (
    <div
      className="pointer-events-none fixed left-1/2 z-30 flex max-w-[92vw] -translate-x-1/2 flex-col items-center gap-1 print:hidden"
      style={{ top: 'max(4px, env(safe-area-inset-top))' }}
      data-testid="espelho-fila-sumula"
    >
      <IndicadorConexao
        snapshot={snapshot}
        aoTentarDeNovo={() => filaRef.current.retomar()}
        className="pointer-events-auto !min-h-[28px] !py-0.5 text-xs shadow-sm"
      />
      {pendencias.length > 0 && (
        <details className="pointer-events-auto w-full max-w-sm rounded-lg border border-amber-300 bg-amber-50 text-xs text-amber-950 shadow-md">
          <summary className="flex min-h-[44px] cursor-pointer items-center px-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            Ver pendências do apontador
          </summary>
          <ul className="max-h-[40vh] space-y-2 overflow-y-auto px-3 pb-3">
            {pendencias.map((p) => (
              <li key={p.clientEventId} className="rounded-md bg-white/80 p-2">
                <p className="font-semibold">
                  {p.tipo} <span className="font-mono">{p.codigo}</span>
                </p>
                <p>{p.mensagem}</p>
                <button
                  type="button"
                  onClick={() => void filaRef.current.resolverPendencia(p.clientEventId)}
                  className="mt-1 min-h-[44px] rounded-md border border-amber-400 px-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  Dispensar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
