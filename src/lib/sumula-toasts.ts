export const DURACAO_AVISO_SUMULA_MS = 3000
export const LIMITE_AVISOS_SUMULA = 2

export const AVISO_INICIO_SEM_SINCRONISMO =
  'Pontuação liberada localmente. Não foi possível sincronizar o início agora.'

export type AvisoSumula = {
  id: string
  message: string
}

type MarcarTempo = (callback: () => void, ms: number) => number
type CancelarTempo = (id: number) => void

/**
 * O GET e o PUT de /api/sumula/{token} respondem a token-demo sem gravar partida.
 * POST /api/arbitro/partidas/{token}/iniciar não tem esse atalho: procura um
 * acesso de árbitro e falha (401 sem sessão, 404 se a sessão não achar a partida).
 */

export function tokenDeDemonstracao(token: string) {
  return token.includes('demo')
}

export function criarFilaAvisos(tempo: { marcar: MarcarTempo; cancelar: CancelarTempo }) {
  let seq = 0
  let itens: AvisoSumula[] = []
  let morto = false
  const timers = new Map<string, number>()
  const ouvintes = new Set<(lista: AvisoSumula[]) => void>()

  function emitir() {
    const copia = itens.slice()
    ouvintes.forEach((ouvinte) => ouvinte(copia))
  }

  function dispensar(id: string) {
    const timer = timers.get(id)
    if (timer !== undefined) {
      tempo.cancelar(timer)
      timers.delete(id)
    }
    if (morto) return
    const proximo = itens.filter((item) => item.id !== id)
    if (proximo.length === itens.length) return
    itens = proximo
    emitir()
  }

  return {
    inscrever(ouvinte: (lista: AvisoSumula[]) => void) {
      ouvintes.add(ouvinte)
      ouvinte(itens.slice())
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
    publicar(message: string) {
      if (morto) return null
      const existente = itens.find((item) => item.message === message)
      if (existente) {
        const timer = timers.get(existente.id)
        if (timer !== undefined) tempo.cancelar(timer)
        timers.set(existente.id, tempo.marcar(() => dispensar(existente.id), DURACAO_AVISO_SUMULA_MS))
        itens = [...itens.filter((item) => item.id !== existente.id), existente]
        emitir()
        return existente.id
      }
      const id = `toast-${++seq}`
      const proximo = [...itens, { id, message }]
      for (const antigo of proximo.slice(0, -LIMITE_AVISOS_SUMULA)) {
        const timer = timers.get(antigo.id)
        if (timer !== undefined) {
          tempo.cancelar(timer)
          timers.delete(antigo.id)
        }
      }
      itens = proximo.slice(-LIMITE_AVISOS_SUMULA)
      timers.set(id, tempo.marcar(() => dispensar(id), DURACAO_AVISO_SUMULA_MS))
      emitir()
      return id
    },
    desmontar() {
      morto = true
      timers.forEach((timer) => tempo.cancelar(timer))
      timers.clear()
      itens = []
      ouvintes.clear()
    },
    lista() {
      return itens.slice()
    },
  }
}
