'use client'

/**
 * Hook da fila offline da súmula.
 *
 * PONTO DE INTEGRAÇÃO (rodada seguinte): em src/app/sumula/[token]/lancar/page.tsx, chamar
 * `const fila = useFilaSumula(token)`, trocar o envio direto de cada toque por `fila.enfileirar({ tipo, payload })`
 * (o placar da tela vem do estado local; a fila só sincroniza) e renderizar <IndicadorConexao snapshot={fila.snapshot} />.
 * Hoje a tela usa PUT /api/sumula/[token]; a fila só funciona com SUMULA_EVENTOS_ATIVO=1 (senão a rota responde 404
 * e a fila permanece local, sem erro).
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { escolherArmazenamento } from './armazenamento'
import { FilaSumula } from './fila'
import type { ArmazenamentoFila, EventoNovo, OpcoesFila } from './tipos'

export function useFilaSumula(token: string, opcoes: Partial<Omit<OpcoesFila, 'token'>> = {}) {
  const armazenamento = opcoes.armazenamento
  const fila = useMemo(
    () => new FilaSumula({ ...opcoes, token, armazenamento: armazenamento ?? (escolherArmazenamento() as ArmazenamentoFila) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, armazenamento]
  )

  useEffect(() => {
    void fila.iniciar()
    const desligar = fila.conectarEventosDoNavegador()
    return () => {
      desligar()
      fila.destruir()
    }
  }, [fila])

  const snapshot = useSyncExternalStore(fila.subscribe, fila.getSnapshot, fila.getSnapshot)

  return {
    snapshot,
    enfileirar: (evento: EventoNovo) => fila.enfileirar(evento),
    sincronizar: () => fila.sincronizar(),
    retomar: () => fila.retomar(),
    resolverPendencia: (id: string) => fila.resolverPendencia(id),
    fila,
  }
}
