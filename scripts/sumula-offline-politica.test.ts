/**
 * Offline-first da súmula (rodada 11): reconciliação de conflito, indicador fixo, bloqueio de fechamento,
 * ordem, recuo, persistência e fallback 404/503. Servidor falso com POST e GET de /eventos.
 */
import assert from 'node:assert/strict'
import { criarArmazenamentoMemoria } from '../src/lib/sumula-offline/armazenamento'
import { calcularRecuo, FilaSumula } from '../src/lib/sumula-offline/fila'
import { bloqueioDeFechamento, contarEventosExternos, lerLinhasDoLog, modeloDoIndicador } from '../src/lib/sumula-offline/politica'

let n = 0
const novoId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

class Servidor {
  log: Array<{ clientEventId: string; seq: number; equipe: string }> = []
  posts: any[] = []
  gets: string[] = []
  rede = true
  status: number | null = null
  getQuebrado = false
  interferir: (() => void) | null = null
  fetch = async (url: any, init: any): Promise<Response> => {
    if (!this.rede) throw new TypeError('Failed to fetch')
    const resp = (status: number, json: unknown) => new Response(JSON.stringify(json), { status })
    if (init?.method === 'GET') {
      this.gets.push(String(url))
      if (this.getQuebrado) return resp(500, { error: 'x' })
      const de = Number(new URL(String(url), 'http://x').searchParams.get('apartirDeSeq') ?? 0)
      return resp(200, { data: { estado: { ultimoSeq: this.log.length }, eventos: this.log.filter((l) => l.seq > de) } })
    }
    const corpo = JSON.parse(init.body)
    this.posts.push(corpo)
    if (this.status) return resp(this.status, { error: 'forçado' })
    this.interferir?.()
    this.interferir = null
    const ids = new Set(this.log.map((l) => l.clientEventId))
    const novos = corpo.eventos.filter((e: any) => !ids.has(e.clientEventId))
    if (novos.length > 0 && corpo.seqEsperado !== this.log.length) {
      const aceitos = corpo.eventos
        .filter((e: any) => ids.has(e.clientEventId))
        .map((e: any) => ({ clientEventId: e.clientEventId, seq: this.log.find((l) => l.clientEventId === e.clientEventId)!.seq }))
      return resp(409, { error: 'conflito', details: { seqAtual: this.log.length, aceitos, estado: { ultimoSeq: this.log.length } } })
    }
    const aceitos = corpo.eventos.map((e: any) => {
      let l = this.log.find((x) => x.clientEventId === e.clientEventId)
      if (!l) {
        l = { clientEventId: e.clientEventId, seq: this.log.length + 1, equipe: e.payload?.equipe }
        this.log.push(l)
      }
      return { clientEventId: l.clientEventId, seq: l.seq }
    })
    return resp(200, { data: { aceitos, rejeitados: [], estado: { ultimoSeq: this.log.length } } })
  }
}

function montar(s: Servidor, armazenamento = criarArmazenamentoMemoria()) {
  const ctx = { online: true, timers: [] as Array<{ fn: () => void; ms: number; vivo: boolean }> }
  const fila = new FilaSumula({
    token: 'tok',
    armazenamento,
    fetchImpl: s.fetch as unknown as typeof fetch,
    gerarId: novoId,
    aleatorio: () => 0.5,
    estaOnline: () => ctx.online,
    agendar: (fn, ms) => {
      const t = { fn, ms, vivo: true }
      ctx.timers.push(t)
      return t
    },
    cancelar: (h) => {
      ;(h as { vivo: boolean }).vivo = false
    },
  })
  return { fila, ctx, armazenamento }
}
const ponto = (equipe: 'A' | 'B') => ({ tipo: 'PONTO' as const, payload: { equipe } })

async function main() {
  // --- funções puras ---
  assert.equal(contarEventosExternos({ seqAnterior: 2, seqAtual: 5, idsNossos: new Set(), aceitosNossos: 1 }), 2)
  assert.equal(contarEventosExternos({ seqAnterior: 2, seqAtual: 3, idsNossos: new Set(), aceitosNossos: 1 }), 0)
  assert.equal(contarEventosExternos({ seqAnterior: 5, seqAtual: 3, idsNossos: new Set(), aceitosNossos: 0 }), 0, 'nunca negativo')
  assert.equal(
    contarEventosExternos({
      seqAnterior: 1,
      seqAtual: 4,
      idsNossos: new Set(['a']),
      aceitosNossos: 0,
      log: [
        { clientEventId: 'a', seq: 2 },
        { clientEventId: 'z', seq: 3 },
        { clientEventId: 'y', seq: 4 },
      ],
    }),
    2,
    'o log manda: eventos nossos não contam'
  )
  assert.deepEqual(lerLinhasDoLog({ data: { eventos: [{ clientEventId: 'a', seq: 3 }, { x: 1 }, null] } }), [{ clientEventId: 'a', seq: 3 }])
  assert.deepEqual(lerLinhasDoLog('lixo'), [])

  const base = { enviando: 0, erro: null, modoLocal: false }
  assert.equal(modeloDoIndicador({ ...base, status: 'online', pendentes: 0 }).rotulo, 'Salvo')
  assert.equal(modeloDoIndicador({ ...base, status: 'pendente', pendentes: 1 }).rotulo, '1 pendente')
  assert.equal(modeloDoIndicador({ ...base, status: 'pendente', pendentes: 3 }).rotulo, '3 pendentes')
  assert.equal(modeloDoIndicador({ ...base, status: 'sincronizando', pendentes: 3, enviando: 2 }).rotulo, '2 pendentes')
  assert.equal(modeloDoIndicador({ ...base, status: 'offline', pendentes: 2 }).rotulo, 'Sem conexão')
  assert.equal(modeloDoIndicador({ ...base, status: 'offline', pendentes: 2, conflitoAberto: true, externos: 2 }).rotulo, 'Conflito', 'conflito tem prioridade')
  assert.equal(modeloDoIndicador({ ...base, status: 'pendente', pendentes: 2, modoLocal: true }).rotulo, 'Salvo', 'rota desligada não é alarme')

  const livre = { pendentes: 0, pendencias: [], modoLocal: false }
  assert.equal(bloqueioDeFechamento(livre).bloqueado, false)
  assert.equal(bloqueioDeFechamento({ ...livre, pendentes: 2 }).bloqueado, true)
  assert.match(bloqueioDeFechamento({ ...livre, pendentes: 1 }).motivo ?? '', /1 lançamento/)
  assert.equal(bloqueioDeFechamento({ ...livre, pendentes: 2, modoLocal: true }).bloqueado, false, 'fallback legado não bloqueia')
  assert.equal(bloqueioDeFechamento({ ...livre, conflitoAberto: true }).bloqueado, true)
  assert.equal(
    bloqueioDeFechamento({ ...livre, pendencias: [{ clientEventId: 'a', seqLocal: 1, tipo: 'PONTO', payload: {}, codigo: 'X', mensagem: 'm', em: '' }] }).bloqueado,
    true
  )

  // recuo cresce e respeita o teto
  assert.ok(calcularRecuo(2, 1000, 60000, () => 0.5) > calcularRecuo(1, 1000, 60000, () => 0.5))
  assert.equal(calcularRecuo(30, 1000, 60000, () => 1), 60000)

  // --- fila: offline guarda em ordem, bloqueia fechamento, volta e envia ---
  {
    const s = new Servidor()
    const { fila, ctx } = montar(s)
    ctx.online = false
    fila.definirOnline(false)
    for (const e of ['A', 'B', 'A'] as const) await fila.enfileirar(ponto(e))
    let snap = fila.getSnapshot()
    assert.equal(modeloDoIndicador(snap).rotulo, 'Sem conexão')
    assert.equal(bloqueioDeFechamento(snap).bloqueado, true)
    assert.equal(s.posts.length, 0)
    ctx.online = true
    fila.definirOnline(true)
    await fila.sincronizar()
    snap = fila.getSnapshot()
    assert.equal(snap.pendentes, 0)
    assert.equal(modeloDoIndicador(snap).rotulo, 'Salvo')
    assert.equal(bloqueioDeFechamento(snap).bloqueado, false)
    assert.deepEqual(s.log.map((l) => l.equipe), ['A', 'B', 'A'], 'ordem preservada')
  }

  // --- conflito: outro aparelho lançou; nossos lançamentos não se perdem; aviso até "Entendi" ---
  {
    const s = new Servidor()
    const { fila } = montar(s)
    await fila.enfileirar(ponto('A'))
    await fila.sincronizar()
    s.interferir = () => {
      s.log.push({ clientEventId: novoId(), seq: s.log.length + 1, equipe: 'B' })
      s.log.push({ clientEventId: novoId(), seq: s.log.length + 1, equipe: 'B' })
    }
    await fila.enfileirar(ponto('A'))
    await fila.enfileirar(ponto('A'))
    await fila.sincronizar()
    const snap = fila.getSnapshot()
    assert.equal(snap.pendentes, 0)
    assert.equal(s.log.length, 5, 'nada perdido: 1 + 2 externos + 2 nossos')
    assert.equal(snap.ultimoConflito?.externos, 2)
    assert.equal(snap.conflitoAberto, true)
    assert.equal(modeloDoIndicador({ ...snap, externos: snap.ultimoConflito?.externos }).rotulo, 'Conflito')
    assert.equal(bloqueioDeFechamento(snap).bloqueado, true)
    assert.ok(s.gets.some((u) => u.includes('apartirDeSeq=1')), 'rebuscou o log a partir do último seq')
    await fila.reconhecerConflito()
    assert.equal(fila.getSnapshot().conflitoAberto, false)
    assert.equal(bloqueioDeFechamento(fila.getSnapshot()).bloqueado, false)
  }

  // --- conflito com GET quebrado: cai para a aritmética, ainda sem perder nada ---
  {
    const s = new Servidor()
    s.getQuebrado = true
    const { fila } = montar(s)
    await fila.enfileirar(ponto('A'))
    await fila.sincronizar()
    s.interferir = () => s.log.push({ clientEventId: novoId(), seq: s.log.length + 1, equipe: 'B' })
    await fila.enfileirar(ponto('A'))
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().ultimoConflito?.externos, 1)
    assert.equal(fila.getSnapshot().pendentes, 0)
    assert.equal(s.log.length, 3)
  }

  // --- 409 só por reenvio dos nossos (resposta perdida) não gera aviso ---
  {
    const s = new Servidor()
    const { fila } = montar(s)
    await fila.enfileirar(ponto('A'))
    s.interferir = () => {
      // o servidor já gravou o evento (resposta perdida) e o cliente ainda acha que seq=0
      const item = fila.itensPendentes()[0]
      s.log.push({ clientEventId: item.clientEventId, seq: 1, equipe: 'A' })
    }
    await fila.enfileirar(ponto('B'))
    await fila.sincronizar()
    assert.equal(fila.getSnapshot().pendentes, 0)
    assert.equal(fila.getSnapshot().conflitoAberto, false)
    assert.equal(s.log.length, 2)
  }

  // --- persistência: recarregar a tela com pendências reenvia em ordem ---
  {
    const s = new Servidor()
    const arm = criarArmazenamentoMemoria()
    const a = montar(s, arm)
    a.ctx.online = false
    a.fila.definirOnline(false)
    await a.fila.enfileirar(ponto('B'))
    await a.fila.enfileirar(ponto('A'))
    const b = montar(s, arm)
    await b.fila.iniciar()
    assert.equal(b.fila.getSnapshot().pendentes, 2)
    await b.fila.sincronizar()
    assert.deepEqual(s.log.map((l) => l.equipe), ['B', 'A'])
  }

  // --- rota desligada (404/503): fallback legado, nada de erro nem bloqueio ---
  for (const codigo of [404, 503]) {
    const s = new Servidor()
    s.status = codigo
    const { fila } = montar(s)
    await fila.enfileirar(ponto('A'))
    await fila.sincronizar()
    const snap = fila.getSnapshot()
    assert.equal(snap.modoLocal, true)
    assert.equal(snap.erro, null)
    assert.equal(modeloDoIndicador(snap).rotulo, 'Salvo')
    assert.equal(bloqueioDeFechamento(snap).bloqueado, false)
  }

  console.log('sumula-offline-politica: ok')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
