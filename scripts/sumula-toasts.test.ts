import assert from 'node:assert/strict'
import {
  AVISO_INICIO_SEM_SINCRONISMO,
  DURACAO_AVISO_SUMULA_MS,
  LIMITE_AVISOS_SUMULA,
  criarFilaAvisos,
  tokenDeDemonstracao,
} from '../src/lib/sumula-toasts'

type Pendente = { id: number; callback: () => void; em: number }

function relogioFalso() {
  let agora = 0
  let seq = 0
  const pendentes: Pendente[] = []
  const fila = criarFilaAvisos({
    marcar: (callback, ms) => {
      const id = ++seq
      pendentes.push({ id, callback, em: agora + ms })
      return id
    },
    cancelar: (id) => {
      const indice = pendentes.findIndex((item) => item.id === id)
      if (indice >= 0) pendentes.splice(indice, 1)
    },
  })

  return {
    fila,
    pendentes,
    avancar(ms: number) {
      agora += ms
      const vencidos = pendentes.filter((item) => item.em <= agora)
      for (const item of vencidos) {
        const indice = pendentes.findIndex((atual) => atual.id === item.id)
        if (indice >= 0) pendentes.splice(indice, 1)
        item.callback()
      }
    },
  }
}

const filaCheia = relogioFalso()
filaCheia.fila.publicar('Escalação do Set Point confirmada.')
filaCheia.fila.publicar('Escalação confirmada. Confira quem saca antes de iniciar a partida.')
filaCheia.fila.publicar('Partida iniciada. Pontuação liberada.')
assert.equal(LIMITE_AVISOS_SUMULA, 2)
assert.equal(filaCheia.fila.lista().length, 2)
assert.deepEqual(
  filaCheia.fila.lista().map((aviso) => aviso.message),
  [
    'Escalação confirmada. Confira quem saca antes de iniciar a partida.',
    'Partida iniciada. Pontuação liberada.',
  ],
)
assert.equal(filaCheia.pendentes.length, 2)

filaCheia.avancar(DURACAO_AVISO_SUMULA_MS - 1)
assert.equal(filaCheia.fila.lista().length, 2)
filaCheia.avancar(1)
assert.deepEqual(filaCheia.fila.lista(), [])
assert.equal(filaCheia.pendentes.length, 0)

const filaSolta = relogioFalso()
filaSolta.fila.publicar('Partida iniciada. Pontuação liberada.')
filaSolta.fila.desmontar()
assert.deepEqual(filaSolta.fila.lista(), [])
assert.equal(filaSolta.pendentes.length, 0)
filaSolta.avancar(DURACAO_AVISO_SUMULA_MS)
assert.equal(filaSolta.fila.publicar('Não deve voltar'), null)
assert.deepEqual(filaSolta.fila.lista(), [])

assert.equal(
  AVISO_INICIO_SEM_SINCRONISMO,
  'Pontuação liberada localmente. Não foi possível sincronizar o início agora.',
)
assert.equal(AVISO_INICIO_SEM_SINCRONISMO.includes('Pontuacao'), false)
assert.equal(AVISO_INICIO_SEM_SINCRONISMO.includes('Nao foi'), false)
assert.equal(tokenDeDemonstracao('token-demo-1-luva2026'), true)
assert.equal(tokenDeDemonstracao('token-demo-1-luv2026'), true)
assert.equal(tokenDeDemonstracao('8f3c1a2e-4b90-4d1e-9c55-0a1b2c3d4e5f'), false)

const repetido = relogioFalso()
repetido.fila.publicar('Partida encerrada. Enviando súmula final...')
repetido.fila.publicar('Partida encerrada. Enviando súmula final...')
repetido.fila.publicar('Partida encerrada. Enviando súmula final...')
assert.equal(repetido.fila.lista().length, 1)
assert.equal(repetido.fila.lista()[0]?.message, 'Partida encerrada. Enviando súmula final...')
assert.equal(repetido.pendentes.length, 1)
repetido.avancar(DURACAO_AVISO_SUMULA_MS)
assert.deepEqual(repetido.fila.lista(), [])

console.log('sumula-toasts: ok')
