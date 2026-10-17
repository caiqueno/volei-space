'use client'

/**
 * Hook da fila offline da súmula.
 *
 * INTEGRAÇÃO (rodada 6, modo sombra): src/app/sumula/[token]/lancar/page.tsx renderiza <EspelhoFilaSumula>
 * (src/components/sumula-offline) só com NEXT_PUBLIC_SUMULA_EVENTOS_ATIVO=1; ele usa este hook e recebe as ocorrências
 * traduzidas por src/lib/sumula-ui/fila-adaptador.ts. A tela continua gravando por PUT /api/sumula/[token]; a fila só
 * sincroniza com a rota /eventos, que responde 404 sem SUMULA_EVENTOS_ATIVO=1 (a fila permanece local, sem erro).
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
    fila,
  }
}
