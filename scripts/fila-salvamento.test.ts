import assert from 'node:assert/strict'
import { criarFilaSalvamento } from '../src/lib/fila-salvamento'

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

  console.log('fila-salvamento ok')
}

main()
