/**
 * Fila offline com DESFAZ por referência e limpeza ao encerrar (partida diferente = chave diferente).
 */
import assert from 'node:assert/strict'
import { criarArmazenamentoMemoria } from '../src/lib/sumula-offline/armazenamento'
import { chaveDaFila, FilaSumula } from '../src/lib/sumula-offline/fila'

let n = 0
const novoId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

class Servidor {
  log: Array<{ clientEventId: string; tipo: string; seq: number; desfazId?: number }> = []
  chamadas: any[] = []
  fetch = async (_u: any, init: any): Promise<Response> => {
    const corpo = JSON.parse(init.body)
    this.chamadas.push(corpo)
    const aceitos = corpo.eventos.map((e: any, indice: number) => {
      const linha = { clientEventId: e.clientEventId, tipo: e.tipo, seq: this.log.length + 1, desfazId: e.desfazId }
      this.log.push(linha)
      return { indice, clientEventId: e.clientEventId, seq: linha.seq, duplicado: false }
    })
    return new Response(JSON.stringify({ data: { aceitos, rejeitados: [], estado: { ultimoSeq: this.log.length } } }), { status: 200 })
  }
}

function montar(token: string, servidor: Servidor, armazenamento = criarArmazenamentoMemoria()) {
  const fila = new FilaSumula({
    token,
    armazenamento,
    fetchImpl: servidor.fetch as unknown as typeof fetch,
    gerarId: novoId,
    estaOnline: () => true,
    agendar: () => 0,
    cancelar: () => undefined,
  })
  return { fila, armazenamento }
}

async function main() {
  // DESFAZ de evento já confirmado: usa o seq que o servidor devolveu
  {
    const s = new Servidor()
    const { fila } = montar('t1', s)
    const p1 = await fila.enfileirar({ tipo: 'PONTO', payload: { equipe: 'A' } })
    await fila.sincronizar()
    await fila.enfileirar({ tipo: 'DESFAZ', desfazClientEventId: p1!.clientEventId })
    await fila.sincronizar()
    assert.equal(s.log.length, 2)
    assert.equal(s.log[1].tipo, 'DESFAZ')
    assert.equal(s.log[1].desfazId, 1)
    assert.equal(fila.getSnapshot().pendentes, 0)
  }

  // Alvo e DESFAZ juntos na fila (offline): o lote corta antes do DESFAZ e ele sai no ciclo seguinte, com o seq certo
  {
    const s = new Servidor()
    const { fila } = montar('t2', s)
    await fila.enfileirar({ tipo: 'PONTO', payload: { equipe: 'A' } })
    const p2 = await fila.enfileirar({ tipo: 'PONTO', payload: { equipe: 'B' } })
    await fila.enfileirar({ tipo: 'DESFAZ', desfazClientEventId: p2!.clientEventId })
    await fila.sincronizar()
    assert.equal(s.chamadas.length, 2, 'dois lotes: [P,P] e [DESFAZ]')
    assert.equal(s.chamadas[0].eventos.length, 2)
    assert.equal(s.chamadas[1].eventos[0].desfazId, 2)
    assert.equal(fila.getSnapshot().pendentes, 0)
  }

  // Alvo que nunca chegou ao servidor: o DESFAZ é descartado, nada é enviado para ele
  {
    const s = new Servidor()
    const { fila } = montar('t3', s)
    await fila.enfileirar({ tipo: 'DESFAZ', desfazClientEventId: 'nunca-existiu' })
    await fila.sincronizar()
    assert.equal(s.chamadas.length, 0)
    assert.equal(fila.getSnapshot().pendentes, 0)
    assert.equal(fila.getSnapshot().pendencias.length, 0)
  }

  // Seq sobrevive a reabrir o app (persistido)
  {
    const s = new Servidor()
    const arm = criarArmazenamentoMemoria()
    const a = montar('t4', s, arm)
    const p = await a.fila.enfileirar({ tipo: 'PONTO', payload: { equipe: 'A' } })
    await a.fila.sincronizar()
    const b = montar('t4', s, arm)
    await b.fila.iniciar()
    await b.fila.enfileirar({ tipo: 'DESFAZ', desfazClientEventId: p!.clientEventId })
    await b.fila.sincronizar()
    assert.equal(s.log[1].desfazId, 1)
  }

  // limpar(): zera memória e armazenamento; outra partida (outro token) não é tocada
  {
    const s = new Servidor()
    const arm = criarArmazenamentoMemoria()
    const a = montar('partida-1', new Servidor(), arm)
    const b = montar('partida-2', s, arm)
    await a.fila.enfileirar({ tipo: 'PONTO', payload: { equipe: 'A' } })
    await b.fila.enfileirar({ tipo: 'PONTO', payload: { equipe: 'B' } })
    assert.ok(await arm.carregar(chaveDaFila('partida-1')))
    assert.ok(await arm.carregar(chaveDaFila('partida-2')))
    assert.notEqual(chaveDaFila('partida-1'), chaveDaFila('partida-2'))
    await a.fila.limpar()
    assert.equal(await arm.carregar(chaveDaFila('partida-1')), null)
    assert.ok(await arm.carregar(chaveDaFila('partida-2')), 'a outra partida continua')
    assert.equal(a.fila.getSnapshot().pendentes, 0)
    await a.fila.sincronizar()
    assert.equal(s.chamadas.length, 0)
  }

  // reativar(): destruir + reativar (StrictMode) volta a sincronizar
  {
    const s = new Servidor()
    const { fila } = montar('t6', s)
    fila.destruir()
    fila.reativar()
    await fila.enfileirar({ tipo: 'PONTO', payload: { equipe: 'A' } })
    await fila.sincronizar()
    assert.equal(s.log.length, 1)
  }

  console.log('sumula-fila-desfaz: ok')
}

void main()
