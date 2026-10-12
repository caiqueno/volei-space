/** Uma gravação por vez. A próxima espera a anterior, para um placar antigo não chegar por último. */
export function criarFilaSalvamento() {
  let corrente: Promise<void> = Promise.resolve()

  return function enfileirar(tarefa: () => Promise<void>): Promise<void> {
    const execucao = corrente.then(tarefa, tarefa)
    corrente = execucao.then(() => undefined, () => undefined)
    return execucao
  }
}

/**
 * Uma gravação por vez. Se outras chegarem no meio, só a última roda depois.
 * A tarefa precisa ler o estado na hora de enviar.
 */
export type SalvamentoCoalescido = ((tarefa: () => Promise<void>) => Promise<void>) & {
  aguardar: () => Promise<void>
}

export function criarSalvamentoCoalescido(): SalvamentoCoalescido {
  let emVoo: Promise<void> | null = null
  let pendente: (() => Promise<void>) | null = null

  function bombear(): Promise<void> {
    if (emVoo) return emVoo
    emVoo = (async () => {
      try {
        while (pendente) {
          const tarefa = pendente
          pendente = null
          try {
            await tarefa()
          } catch (err) {
            if (!pendente) throw err
          }
        }
      } finally {
        emVoo = null
      }
    })()
    return emVoo
  }

  function agendar(tarefa: () => Promise<void>): Promise<void> {
    pendente = tarefa
    return bombear()
  }

  agendar.aguardar = () => emVoo ?? Promise.resolve()
  return agendar
}
