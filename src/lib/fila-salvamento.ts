/** Uma gravação por vez. A próxima espera a anterior, para um placar antigo não chegar por último. */
export function criarFilaSalvamento() {
  let corrente: Promise<void> = Promise.resolve()

  return function enfileirar(tarefa: () => Promise<void>): Promise<void> {
    const execucao = corrente.then(tarefa, tarefa)
    corrente = execucao.then(() => undefined, () => undefined)
    return execucao
  }
}
