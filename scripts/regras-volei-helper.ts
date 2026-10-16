/** Mini-harness dos testes do motor de regras: o nome de cada caso começa com o ID da regra (RG-...). */
import assert from 'node:assert/strict'

let total = 0
const falhas: string[] = []

export function caso(nome: string, fn: () => void): void {
  total += 1
  if (!/^(RG|CJ)-[A-Z]+-?\d*/.test(nome)) {
    falhas.push(nome)
    console.error(`  FALHOU  ${nome}: o nome do caso precisa começar com o ID da regra (RG-XXX-000)`)
    return
  }
  try {
    fn()
    console.log(`  ok  ${nome}`)
  } catch (erro) {
    falhas.push(nome)
    console.error(`  FALHOU  ${nome}`)
    console.error(erro instanceof Error ? erro.message : erro)
  }
}

export function encerrar(arquivo: string): void {
  if (falhas.length > 0) {
    console.error(`\n${arquivo}: ${falhas.length} de ${total} casos falharam.`)
    process.exit(1)
  }
  console.log(`\n${arquivo}: ${total} casos ok.`)
}

export { assert }
