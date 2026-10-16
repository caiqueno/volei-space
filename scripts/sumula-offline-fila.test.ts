/**
 * Fila offline da súmula: cenários de ginásio G1 a G10 (docs/analise/10-estrategia-de-qualidade.md)
 * com fetch e armazenamento falsos. Servidor falso imita a rota POST /api/sumula/[token]/eventos.
 */
import assert from 'node:assert/strict'
import { criarArmazenamentoMemoria } from '../src/lib/sumula-offline/armazenamento'
import { calcularRecuo, chaveDaFila, FilaSumula } from '../src/lib/sumula-offline/fila'
import { textoDoIndicador } from '../src/lib/sumula-offline/texto'

const TOKEN = 'tok-123'
let contadorId = 0
const novoId = () => `00000000-0000-4000-8000-${String(++contadorId).padStart(12, '0')}`

interface Linha {
  clientEventId: string
  tipo: string
  seq: number
}

class ServidorFalso {
  log: Linha[] = []
  chamadas: any[] = []
  rede = true
  status: number | null = null // força status (404, 503, 500, 401)
  /** Eventos PONTO com payload.invalido são rejeitados por regra. */
  interferir: (() => void) | null = null
  fetch = async (_url: any, init: any): Promise<Response> => {
    if (!this.rede) throw new TypeError('Failed to fetch')
    const corpo = JSON.parse(init.body)
    this.chamadas.push(corpo)
    const resp = (status: number, json: unknown) => new Response(JSON.stringify(json), { status })
    if (this.status) return resp(this.status, { error: 'forçado' })
    this.interferir?.()
    this.interferir = null
    const ultimo = () => this.log.length
    const ids = new Set(this.log.map((l) => l.clientEventId))
    const novos = corpo.eventos.filter((e: any) => !ids.has(e.clientEventId))
    if (corpo.seqEsperado !== undefined && novos.length > 0 && corpo.seqEsperado !== ultimo()) {
      const aceitos = corpo.eventos
        .filter((e: any) => ids.has(e.clientEventId))
        .map((e: any, indice: number) => ({ indice, clientEventId: e.clientEventId, seq: this.log.find((l) => l.clientEventId === e.clientEventId)!.seq, duplicado: true }))
      return resp(409, { error: 'conflito', details: { codigo: 'RG-LOG-010', seqAtual: ultimo(), aceitos, estado: { ultimoSeq: ultimo() } } })
    }
    const aceitos: any[] = []
    const rejeitados: any[] = []
    let falhou = false
    corpo.eventos.forEach((e: any, indice: number) => {
      if (falhou) return void rejeitados.push({ indice, clientEventId: e.clientEventId, codigo: 'RG-LOG-012', mensagem: 'não processado', naoProcessado: true })
      const ja = this.log.find((l) => l.clientEventId === e.clientEventId)
      if (ja) return void aceitos.push({ indice, clientEventId: e.clientEventId, seq: ja.seq, duplicado: true })
      if (e.payload?.invalido) {
        falhou = true
        return void rejeitados.push({ indice, clientEventId: e.clientEventId, codigo: 'RG-PTO-001', mensagem: 'Ponto fora de rally.' })
      }
      const linha = { clientEventId: e.clientEventId, tipo: e.tipo, seq: this.log.length + 1 }
      this.log.push(linha)
      aceitos.push({ indice, clientEventId: e.clientEventId, seq: linha.seq, duplicado: false })
    })
    return resp(200, { data: { aceitos, rejeitados, estado: { ultimoSeq: this.log.length } } })
  }
}

function montar(servidor: ServidorFalso, armazenamento = criarArmazenamentoMemoria(), extra: Record<string, unknown> = {}) {
  const ctx = {
    online: true,
    timers: [] as Array<{ fn: () => void; ms: number; vivo: boolean }>,
    relogio: 1_000_000,
  }
  const fila = new FilaSumula({
    token: TOKEN,
    armazenamento,
    fetchImpl: servidor.fetch as unknown as typeof fetch,
    gerarId: novoId,
    aleatorio: () => 0.5,
    agora: () => ctx.relogio,
    estaOnline: () => ctx.online,
    agendar: (fn, ms) => {
      const t = { fn, ms, vivo: true }
      ctx.timers.push(t)
      return t
    },
    cancelar: (h) => {
      ;(h as { vivo: boolean }).vivo = false
    },
    ...extra,
  })
  return { fila, ctx, armazenamento }
}

const ponto = (equipe: 'A' | 'B' = 'A', extra: Record<string, unknown> = {}) => ({ tipo: 'PONTO' as const, payload: { equipe, ...extra } })

async function main() {
  // Recuo exponencial com jitter
  assert.equal(calcularRecuo(1, 1000, 60000, () => 0), 500)
  assert.equal(calcularRecuo(1, 1000, 60000, () => 1), 1000)
  assert.equal(calcularRecuo(3, 1000, 60000, () => 1), 4000)
  assert.equal(calcularRecuo(20, 1000, 60000, () => 1), 60000)

  // Caminho feliz: aceito sai da fila; seqEsperado avança.
  {
    const s = new ServidorFalso()
    const { fila } = montar(s)
    await fila.enfileirar(ponto())
    await fila.enfileirar(ponto('B'))
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().pendentes, 0)
    assert.equal(fila.getSnapshot().status, 'online')
    assert.equal(fila.getSnapshot().seqServidor, 2)
    assert.equal(s.chamadas[0].seqEsperado, 0)
    assert.equal(s.log.length, 2)
    await fila.enfileirar(ponto())
    await fila.sincronizar()
    assert.equal(s.chamadas[1].seqEsperado, 2)
  }

  // G1 + G2: cai a rede no meio do set; placar segue; volta e reenvia em ordem, sem duplicar.
  {
    const s = new ServidorFalso()
    const { fila, ctx } = montar(s)
    await fila.enfileirar(ponto())
    await fila.sincronizar()
    s.rede = false
    ctx.online = false
    fila.definirOnline(false)
    assert.equal(fila.getSnapshot().status, 'offline')
    const a = await fila.enfileirar(ponto('B', { n: 1 }))
    const b = await fila.enfileirar(ponto('A', { n: 2 }))
    const c = await fila.enfileirar(ponto('B', { n: 3 }))
    assert.equal(fila.getSnapshot().pendentes, 3)
    assert.match(textoDoIndicador(fila.getSnapshot()), /Sem conexão: 3 eventos guardados/)
    assert.equal(s.chamadas.length, 1, 'offline não chama a rede')
    // Rede cai sem o navegador avisar (online=true mas fetch falha): recuo, sem erro ao usuário.
    ctx.online = true
    fila.definirOnline(true)
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().erro, null)
    assert.equal(fila.getSnapshot().pendentes, 3)
    assert.ok(ctx.timers.some((t) => t.vivo && t.ms > 0), 'recuo agendado')
    // Volta de verdade.
    s.rede = true
    fila.definirOnline(false)
    ctx.online = true
    fila.definirOnline(true)
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().pendentes, 0)
    assert.deepEqual(s.log.map((l) => l.clientEventId).slice(1), [a!.clientEventId, b!.clientEventId, c!.clientEventId])
    assert.equal(s.log.length, 4, 'sem duplicar')
  }

  // G3: duplo toque (mesmo clientEventId) e reenvio após resposta perdida não duplicam ponto.
  {
    const s = new ServidorFalso()
    const { fila } = montar(s)
    const id = novoId()
    await fila.enfileirar({ ...ponto(), clientEventId: id })
    await fila.enfileirar({ ...ponto(), clientEventId: id })
    assert.equal(fila.getSnapshot().pendentes, 1)
    // Resposta perdida: servidor gravou mas o cliente não soube.
    const original = s.fetch
    let perdida = false
    s.fetch = async (u: any, i: any) => {
      const r = await original(u, i)
      if (!perdida) {
        perdida = true
        throw new TypeError('resposta perdida')
      }
      return r
    }
    const { fila: f2 } = montar(s)
    await f2.enfileirar({ ...ponto(), clientEventId: novoId() })
    await f2.sincronizar()
    assert.equal(f2.getSnapshot().pendentes, 1)
    await f2.sincronizar()
    assert.equal(f2.getSnapshot().pendentes, 0)
    assert.equal(s.log.length, 1, 'reenvio idempotente')
  }

  // G4/G5: reabrir o app com pendências recupera a fila exata e a ordem.
  {
    const s = new ServidorFalso()
    s.rede = false
    const mem = criarArmazenamentoMemoria()
    const { fila } = montar(s, mem)
    const ids: string[] = []
    for (let i = 0; i < 4; i++) ids.push((await fila.enfileirar(ponto('A', { i })))!.clientEventId)
    assert.ok(mem.dados.has(chaveDaFila(TOKEN)))
    fila.destruir() // app morto
    s.rede = true
    const { fila: reaberta } = montar(s, mem)
    await reaberta.iniciar()
    assert.equal(reaberta.getSnapshot().pendentes, 4)
    assert.deepEqual(reaberta.itensPendentes().map((i) => i.clientEventId), ids)
    const nova = await reaberta.enfileirar(ponto())
    assert.equal(nova!.seqLocal, 5, 'seqLocal continua de onde parou')
    await reaberta.sincronizar()
    assert.deepEqual(s.log.map((l) => l.clientEventId).slice(0, 4), ids)
  }

  // Armazenamento corrompido não derruba a tela.
  {
    const s = new ServidorFalso()
    const mem = criarArmazenamentoMemoria({ [chaveDaFila(TOKEN)]: '{lixo' })
    const { fila } = montar(s, mem)
    await fila.iniciar()
    assert.equal(fila.getSnapshot().pendentes, 0)
  }

  // G8: ordem pelo seq local, nunca pela hora do aparelho (relógio anda para trás).
  {
    const s = new ServidorFalso()
    const { fila, ctx } = montar(s)
    ctx.relogio = 5_000_000_000
    const x = await fila.enfileirar(ponto('A', { n: 1 }))
    ctx.relogio = 1_000 // relógio do aparelho voltou no tempo
    const y = await fila.enfileirar(ponto('B', { n: 2 }))
    assert.ok(new Date(y!.ocorridoEm) < new Date(x!.ocorridoEm))
    await fila.sincronizar()
    assert.deepEqual(s.log.map((l) => l.clientEventId), [x!.clientEventId, y!.clientEventId])
    assert.deepEqual(s.chamadas[0].eventos.map((e: any) => e.payload.n), [1, 2])
  }

  // G6/G7: 409 reconcilia com o estado do servidor, registra o conflito e reenvia com seq novo.
  {
    const s = new ServidorFalso()
    const { fila } = montar(s)
    await fila.enfileirar(ponto())
    await fila.sincronizar()
    s.interferir = () => {
      s.log.push({ clientEventId: novoId(), tipo: 'PONTO', seq: s.log.length + 1 }) // outro apontador lançou
    }
    await fila.enfileirar(ponto('B'))
    await fila.sincronizar()
    const snap = fila.getSnapshot()
    assert.equal(snap.pendentes, 0)
    assert.equal(s.log.length, 3)
    assert.equal(snap.seqServidor, 3)
    assert.ok(snap.ultimoConflito && snap.ultimoConflito.seqAtual === 2)
    assert.equal(s.chamadas.at(-1).seqEsperado, 2)
  }

  // Rota desligada (404/503): fila mantida, modo local, sem erro; depois liga e sincroniza.
  for (const codigo of [404, 503]) {
    const s = new ServidorFalso()
    s.status = codigo
    const { fila, ctx } = montar(s)
    await fila.enfileirar(ponto())
    await fila.enfileirar(ponto('B'))
    await fila.sincronizar()
    const snap = fila.getSnapshot()
    assert.equal(snap.pendentes, 2)
    assert.equal(snap.modoLocal, true)
    assert.equal(snap.erro, null)
    assert.notEqual(snap.status, 'erro')
    assert.match(textoDoIndicador(snap), /Salvo neste aparelho/)
    assert.ok(ctx.timers.some((t) => t.vivo && t.ms >= 60_000), 'espera longa em modo local')
    s.status = null
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().pendentes, 0)
    assert.equal(fila.getSnapshot().modoLocal, false)
  }

  // Regra rejeitada: vira pendência com código e mensagem; os seguintes não processados continuam na fila e vão depois.
  {
    const s = new ServidorFalso()
    const { fila } = montar(s)
    const ruim = (await fila.enfileirar(ponto('A', { invalido: true })))!
    const depois = (await fila.enfileirar(ponto('B')))!
    await fila.sincronizar()
    const snap = fila.getSnapshot()
    assert.equal(snap.pendencias.length, 1)
    assert.equal(snap.pendencias[0].clientEventId, ruim.clientEventId)
    assert.equal(snap.pendencias[0].codigo, 'RG-PTO-001')
    assert.equal(snap.pendencias[0].mensagem, 'Ponto fora de rally.')
    assert.equal(snap.pendentes, 0)
    assert.deepEqual(s.log.map((l) => l.clientEventId), [depois.clientEventId])
    assert.equal(snap.erro, null)
    await fila.resolverPendencia(ruim.clientEventId)
    assert.equal(fila.getSnapshot().pendencias.length, 0)
  }

  // G9: sessão expirada para o envio sem perder nada; retomar depois do login.
  {
    const s = new ServidorFalso()
    s.status = 401
    const { fila } = montar(s)
    await fila.enfileirar(ponto())
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().status, 'erro')
    assert.equal(fila.getSnapshot().pendentes, 1)
    const antes = s.chamadas.length
    await fila.sincronizar()
    assert.equal(s.chamadas.length, antes, 'não insiste com sessão expirada')
    s.status = null
    fila.retomar()
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().pendentes, 0)
    assert.equal(fila.getSnapshot().status, 'online')
  }

  // 500: erro com recuo exponencial; some quando volta a funcionar.
  {
    const s = new ServidorFalso()
    s.status = 500
    const { fila, ctx } = montar(s)
    await fila.enfileirar(ponto())
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().status, 'erro')
    const t1 = ctx.timers.filter((t) => t.vivo).at(-1)!.ms
    await fila.sincronizar()
    const t2 = ctx.timers.filter((t) => t.vivo).at(-1)!.ms
    assert.ok(t2 > t1, 'recuo cresce')
    s.status = null
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().status, 'online')
  }

  // G10: rede lenta: ciclos simultâneos não enviam em paralelo e toque duplicado não entra.
  {
    const s = new ServidorFalso()
    let liberar!: () => void
    const trava = new Promise<void>((r) => (liberar = r))
    const original = s.fetch
    let emVoo = 0
    let maxVoo = 0
    s.fetch = async (u: any, i: any) => {
      emVoo++
      maxVoo = Math.max(maxVoo, emVoo)
      await trava
      emVoo--
      return original(u, i)
    }
    const { fila } = montar(s)
    const id = novoId()
    await fila.enfileirar({ ...ponto(), clientEventId: id })
    const p1 = fila.sincronizar()
    const p2 = fila.sincronizar()
    await fila.enfileirar({ ...ponto(), clientEventId: id })
    assert.equal(fila.getSnapshot().status, 'sincronizando')
    liberar()
    await Promise.all([p1, p2])
    assert.equal(maxVoo, 1)
    assert.equal(s.log.length, 1)
  }

  // 422 em lote: isola o evento ruim (lote de 1) em vez de travar a fila.
  {
    const s = new ServidorFalso()
    const original = s.fetch
    s.fetch = async (u: any, i: any) => {
      const c = JSON.parse(i.body)
      if (c.eventos.some((e: any) => e.payload.schema)) return new Response(JSON.stringify({ error: 'Dados inválidos' }), { status: 422 })
      return original(u, i)
    }
    const { fila } = montar(s)
    await fila.enfileirar(ponto())
    await fila.enfileirar(ponto('A', { schema: true }))
    await fila.enfileirar(ponto('B'))
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().pendentes, 0)
    assert.equal(s.log.length, 2)
    assert.equal(fila.getSnapshot().pendencias[0].codigo, 'RG-LOG-011')
  }

  // Lotes de no máximo 50, em ordem.
  {
    const s = new ServidorFalso()
    const { fila } = montar(s)
    for (let i = 0; i < 120; i++) await fila.enfileirar(ponto('A', { i }))
    await fila.sincronizar()
    assert.deepEqual(s.chamadas.map((c) => c.eventos.length), [50, 50, 20])
    assert.deepEqual(s.log.map((l) => l.seq), Array.from({ length: 120 }, (_, i) => i + 1))
  }

  // Indicador de texto.
  assert.equal(textoDoIndicador({ status: 'online', pendentes: 0, enviando: 0, erro: null, modoLocal: false }), 'Online')
  assert.equal(textoDoIndicador({ status: 'sincronizando', pendentes: 3, enviando: 3, erro: null, modoLocal: false }), 'Sincronizando 3 eventos')
  assert.equal(textoDoIndicador({ status: 'pendente', pendentes: 1, enviando: 0, erro: null, modoLocal: false }), '1 evento pendente')

  console.log('sumula-offline-fila: ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
