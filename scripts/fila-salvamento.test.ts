import assert from 'node:assert/strict'
import { criarFilaSalvamento, criarSalvamentoCoalescido } from '../src/lib/fila-salvamento'

async function main() {
  const fila = criarFilaSalvamento()
  const ordem: string[] = []
  let liberarPrimeira: () => void = () => undefined
  const primeira = new Promise<void>((resolve) => {
    liberarPrimeira = resolve
  })

  const a = fila(async () => {
    ordem.push('a-inicio')
    await primeira
    ordem.push('a-fim')
  })
  const b = fila(async () => {
    ordem.push('b')
  })

  await Promise.resolve()
  assert.deepEqual(ordem, ['a-inicio'])
  liberarPrimeira()
  await a
  await b
  assert.deepEqual(ordem, ['a-inicio', 'a-fim', 'b'])

  const falha = fila(async () => {
    throw new Error('x')
  })
  const depois = fila(async () => {
    ordem.push('depois')
  })
  await falha.catch(() => undefined)
  await depois
  assert.equal(ordem.at(-1), 'depois')

  const salvar = criarSalvamentoCoalescido()
  let liberar: () => void = () => undefined
  const espera = new Promise<void>((resolve) => {
    liberar = resolve
  })
  const corrida: string[] = []
  const primeiro = salvar(async () => {
    corrida.push('a')
    await espera
  })
  const segundo = salvar(async () => {
    corrida.push('b')
  })
  const terceiro = salvar(async () => {
    corrida.push('c')
  })
  await Promise.resolve()
  assert.deepEqual(corrida, ['a'])
  liberar()
  await primeiro
  await segundo
  await terceiro
  assert.deepEqual(corrida, ['a', 'c'])

  const falhou = criarSalvamentoCoalescido()
  const depoisDaFalha: string[] = []
  const rejeitada = falhou(async () => {
    depoisDaFalha.push('falha')
    throw new Error('x')
  })
  const seguinte = falhou(async () => {
    depoisDaFalha.push('seguinte')
  })
  await rejeitada
  await seguinte
  assert.deepEqual(depoisDaFalha, ['falha', 'seguinte'])

  const esperaFila = criarSalvamentoCoalescido()
  let liberarEspera: () => void = () => undefined
  const trava = new Promise<void>((resolve) => {
    liberarEspera = resolve
  })
  let filaTerminou = false
  void esperaFila(async () => {
    await trava
  })
  const aguardou = esperaFila.aguardar().then(() => {
    filaTerminou = true
  })
  await Promise.resolve()
  assert.equal(filaTerminou, false)
  liberarEspera()
  await aguardou
  assert.equal(filaTerminou, true)
  await esperaFila.aguardar()

  console.log('fila-salvamento ok')
}

main()
