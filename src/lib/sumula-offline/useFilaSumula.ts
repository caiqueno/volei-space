'use client'

/**
 * Hook da fila offline da súmula.
 *
 * INTEGRAÇÃO (rodada 11, offline-first): com NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO=1 a tela (lancar/page.tsx) renderiza
 * <EspelhoFilaSumula> (src/components/sumula-offline), que usa este hook e recebe as ocorrências traduzidas por
 * src/lib/sumula-ui/fila-adaptador.ts. Cada ocorrência vira evento na fila persistida e é enviada a
 * POST /api/sumula/[token]/eventos (clientEventId + seqEsperado), com indicador fixo, reenvio com recuo, conflito
 * reconciliado e bloqueio de fechamento. O PUT legado segue em paralelo até o modo sombra provar equivalência;
 * se a rota responder 404/503 a fila fica local (modoLocal) e o fluxo legado continua sozinho.
 * Ver docs/analise/06-arquitetura-frontend.md, seção 4.1.
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
    fila.reativar()
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
    limpar: () => fila.limpar(),
    reconhecerConflito: () => fila.reconhecerConflito(),
    fila,
  }
}
