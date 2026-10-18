// Rodada 13 (backend): limitador assíncrono com fallback, cron de expurgo, evento DESAFIO no log e
// placar/rotação derivados do log no scout. Sem rede nem banco real: stores e bancos falsos.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import {
  MemoryRateLimitStore,
  RateLimitStoreComFallback,
  consumirLimiteAsync,
  definirStoreDeRateLimit,
  modoDeFalhaDoMetodo,
  type RateLimitStore,
} from '../src/lib/rate-limit'
import { cabecalhoCronValido, expurgarPreviasImportacao, segredoDoCron } from '../src/lib/meu-time-fase2/expurgo'
import {
  clientEventIdDoDesafio,
  configDaPartida,
  loteSchema,
  processarLote,
  registrarDecisaoDesafioNoLog,
  type EntradaPartida,
} from '../src/lib/sumula-eventos'
import { derivarPlacar } from '../src/lib/regras-volei'
import { criarDerivadorDoLog, estadoDoSetNoMomento, registrarAcao } from '../src/lib/scout'
import { linhasParaLog } from '../src/lib/sumula-eventos/mapeamento'
import { criarBancoEventos } from './helpers/fake-supabase-eventos'

const PARTIDA = { id: 7, equipeAId: 100, equipeBId: 200 }
const ORIGEM = { autorTipo: 'ARBITRO' as const, autorRef: '5' }
const CONFIG = configDaPartida({ setsPorPartida: 3, pontosPorSet: 25, tieBreakUltimoSet: true, pontosUltimoSet: 15 })
const CONTEXTO = { elenco: { A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], B: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20] } }
const ENTRADA: EntradaPartida = { partida: PARTIDA, config: CONFIG, contexto: CONTEXTO }

type Ev = { clientEventId: string; tipo: string; payload: Record<string, unknown> }
const ev = (tipo: string, payload: Record<string, unknown> = {}): Ev => ({ clientEventId: randomUUID(), tipo, payload })
const inicioSet = () =>
  ev('SET_INICIADO', { numeroSet: 1, formacaoA: [1, 2, 3, 4, 5, 6], formacaoB: [11, 12, 13, 14, 15, 16], saqueInicial: 'A', liberosA: [10], liberosB: [20] })
const ponto = (equipe: 'A' | 'B') => ev('PONTO', { equipe })
const lote = (eventos: Ev[]) => {
  const r = loteSchema.safeParse({ eventos })
  if (!r.success) throw new Error(JSON.stringify(r.error.flatten()))
  return r.data
}
const novoBanco = (extra: Partial<Parameters<typeof criarBancoEventos>[0]> = {}) =>
  criarBancoEventos({ partidaId: PARTIDA.id, equipeAId: PARTIDA.equipeAId, equipeBId: PARTIDA.equipeBId, ...extra })

let total = 0
const falhas: string[] = []
async function caso(nome: string, fn: () => Promise<void> | void) {
  total += 1
  try {
    await fn()
    console.log(`  ok  ${nome}`)
  } catch (e) {
    falhas.push(nome)
    console.error(`  FALHOU  ${nome}\n${e instanceof Error ? e.stack : e}`)
  }
}

const silenciar = async <T>(fn: () => Promise<T>) => {
  const aviso = console.warn
  const erro = console.error
  console.warn = () => undefined
  console.error = () => undefined
  try {
    return await fn()
  } finally {
    console.warn = aviso
    console.error = erro
  }
}

class StoreQuebrado implements RateLimitStore {
  async consumir(): Promise<never> {
    throw new Error('store fora do ar')
  }
  async consultar(): Promise<never> {
    throw new Error('store fora do ar')
  }
  async zerar(): Promise<never> {
    throw new Error('store fora do ar')
  }
}

async function main() {
  // ---------------------------------------------------------------- rate limit
  await caso('limitador assíncrono: conta no store, bloqueia no limite e informa o retry', async () => {
    definirStoreDeRateLimit(new MemoryRateLimitStore())
    const agora = 1_000_000
    for (let i = 0; i < 3; i += 1) assert.equal((await consumirLimiteAsync('k:1', 3, 60_000, 'FECHADO', agora)).ok, true)
    const bloqueado = await consumirLimiteAsync('k:1', 3, 60_000, 'FECHADO', agora + 1000)
    assert.equal(bloqueado.ok, false)
    assert.equal(bloqueado.retryAfterSeconds, 59)
    assert.equal((await consumirLimiteAsync('k:2', 3, 60_000, 'FECHADO', agora)).ok, true, 'outra chave tem balde próprio')
    assert.equal((await consumirLimiteAsync('k:1', 3, 60_000, 'FECHADO', agora + 61_000)).ok, true, 'a janela reinicia')
  })

  await caso('limitador: store que lança = falha-aberto na leitura e falha-fechado na escrita', async () => {
    definirStoreDeRateLimit(new StoreQuebrado())
    await silenciar(async () => {
      const leitura = await consumirLimiteAsync('k', 1, 1000, 'ABERTO')
      assert.equal(leitura.ok, true)
      assert.equal(leitura.indisponivel, true)
      const escrita = await consumirLimiteAsync('k', 1, 1000, 'FECHADO')
      assert.equal(escrita.ok, false)
      assert.ok(escrita.retryAfterSeconds >= 1)
    })
    assert.equal(modoDeFalhaDoMetodo('GET'), 'ABERTO')
    assert.equal(modoDeFalhaDoMetodo('head'), 'ABERTO')
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(modoDeFalhaDoMetodo(m), 'FECHADO')
  })

  await caso('limitador: principal indisponível cai para a memória e o limite continua valendo', async () => {
    definirStoreDeRateLimit(new RateLimitStoreComFallback(new StoreQuebrado()))
    await silenciar(async () => {
      assert.equal((await consumirLimiteAsync('fb', 2, 60_000, 'FECHADO')).ok, true)
      assert.equal((await consumirLimiteAsync('fb', 2, 60_000, 'FECHADO')).ok, true)
      const terceiro = await consumirLimiteAsync('fb', 2, 60_000, 'FECHADO')
      assert.equal(terceiro.ok, false)
      assert.notEqual(terceiro.indisponivel, true, 'o fallback respondeu, o limitador não ficou indisponível')
    })
  })

  await caso('limitador: o store persistente é compartilhado entre chamadas (mesmas chaves e limites)', async () => {
    const store = new MemoryRateLimitStore()
    definirStoreDeRateLimit(store)
    await consumirLimiteAsync('banco:ip:1.2.3.4', 120, 60_000, 'ABERTO')
    assert.equal((await store.consultar('banco:ip:1.2.3.4')).contagem, 1)
  })

  // ---------------------------------------------------------------- cron de expurgo
  await caso('cron: segredo ausente = desligado; Bearer comparado em tempo constante', () => {
    assert.equal(segredoDoCron({}), null)
    assert.equal(segredoDoCron({ CRON_SECRET: '   ' }), null)
    assert.equal(segredoDoCron({ CRON_SECRET: ' abc ' }), 'abc')
    assert.equal(cabecalhoCronValido('Bearer abc', 'abc'), true)
    for (const ruim of [null, undefined, '', 'abc', 'Bearer', 'Bearer abd', 'bearer abc', 'Bearer abc ', 'Bearer abcd']) {
      assert.equal(cabecalhoCronValido(ruim, 'abc'), false, String(ruim))
    }
  })

  await caso('cron: a rota responde 404 sem CRON_SECRET, 401 sem credencial e nunca vaza o segredo', async () => {
    const rota = await import('../src/app/api/cron/expurgo-previas/route')
    const req = (auth?: string) =>
      new NextRequest('http://127.0.0.1:3001/api/cron/expurgo-previas', { method: 'POST', headers: auth ? { authorization: auth } : {} })
    const antes = process.env.CRON_SECRET
    try {
      delete process.env.CRON_SECRET
      assert.equal((await rota.POST(req('Bearer qualquer'))).status, 404)
      process.env.CRON_SECRET = 'segredo-do-cron-de-teste'
      assert.equal((await rota.POST(req())).status, 401)
      const errada = await rota.POST(req('Bearer outro'))
      assert.equal(errada.status, 401)
      assert.ok(!JSON.stringify(await errada.json()).includes('segredo-do-cron'))
      assert.equal(typeof (rota as Record<string, unknown>).GET, 'function', 'GET aceito (Vercel cron), sempre com o segredo')
    } finally {
      if (antes === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = antes
    }
  })

  await caso('cron: chama a função de expurgo por RPC e devolve a contagem; função ausente = indisponível', async () => {
    const chamadas: string[] = []
    const com = (data: unknown, error: { code?: string; message?: string } | null = null) => ({
      rpc: (nome: string) => {
        chamadas.push(nome)
        return Promise.resolve({ data, error })
      },
    })
    assert.deepEqual(await expurgarPreviasImportacao(com(3)), { tipo: 'OK', apagadas: 3 })
    assert.deepEqual(await expurgarPreviasImportacao(com([{ expurgar_previas_importacao: 5 }])), { tipo: 'OK', apagadas: 5 })
    assert.deepEqual(await expurgarPreviasImportacao(com(null)), { tipo: 'OK', apagadas: 0 })
    assert.ok(chamadas.every((n) => n === 'expurgar_previas_importacao'))
    await silenciar(async () => {
      assert.deepEqual(await expurgarPreviasImportacao(com(null, { code: '42883' })), { tipo: 'INDISPONIVEL' })
      assert.deepEqual(await expurgarPreviasImportacao(com(null, { code: 'PGRST202' })), { tipo: 'INDISPONIVEL' })
      assert.deepEqual(await expurgarPreviasImportacao(com(null, { code: '57014', message: 'timeout' })), { tipo: 'ERRO' })
      assert.deepEqual(await expurgarPreviasImportacao({ rpc: () => Promise.reject(new Error('rede')) }), { tipo: 'ERRO' })
    })
  })

  // ---------------------------------------------------------------- evento DESAFIO no log
  const desafio = (extra: Partial<{ id: string; setNumero: number; equipeId: number; estado: string }> = {}) => ({
    id: randomUUID(),
    setNumero: 1,
    equipeId: PARTIDA.equipeAId,
    estado: 'MANTIDA',
    ...extra,
  })
  const ENV_LIGADO = { SUMULA_EVENTOS_ATIVO: '1' }

  await caso('DESAFIO no log: registra os quatro resultados com o payload definido, sem mexer no placar', async () => {
    for (const resultado of ['MANTIDA', 'REVERTIDA', 'INCONCLUSIVA', 'CANCELADO']) {
      const { cliente, linhas } = novoBanco()
      await processarLote(cliente, ENTRADA, lote([inicioSet(), ponto('A'), ponto('B'), ponto('A')]), ORIGEM)
      const antes = derivarPlacar(linesToLog(linhas), CONFIG, CONTEXTO)
      const d = desafio({ estado: resultado, equipeId: PARTIDA.equipeBId })
      const r = await registrarDecisaoDesafioNoLog(cliente, ENTRADA, d, ORIGEM, ENV_LIGADO)
      assert.deepEqual(r, { tipo: 'REGISTRADO', duplicado: false }, resultado)
      const ultima = linhas[linhas.length - 1]!
      assert.equal(ultima.tipo, 'DESAFIO')
      assert.equal(ultima.equipeId, PARTIDA.equipeBId)
      assert.equal(ultima.setNumero, 1)
      assert.equal(ultima.clientEventId, clientEventIdDoDesafio(d.id))
      assert.deepEqual(
        { ...ultima.payload },
        { equipe: 'B', setNumero: 1, resultado, desafioId: d.id, _motor: 'DESAFIO' },
      )
      const depois = derivarPlacar(linesToLog(linhas), CONFIG, CONTEXTO)
      assert.deepEqual(depois.setAtual?.placar, antes.setAtual?.placar, 'placar intacto')
      assert.equal(depois.setAtual?.rallysRepetidos, antes.setAtual?.rallysRepetidos, 'não repete rally')
      assert.equal(depois.saca, antes.saca)
      assert.deepEqual(depois.formacaoA, antes.formacaoA)
      assert.equal(depois.inconsistencias.length, antes.inconsistencias.length)
    }
  })

  await caso('DESAFIO no log: idempotente pelo id do desafio (clientEventId determinístico)', async () => {
    const { cliente, linhas } = novoBanco()
    await processarLote(cliente, ENTRADA, lote([inicioSet(), ponto('A')]), ORIGEM)
    const d = desafio()
    assert.deepEqual(await registrarDecisaoDesafioNoLog(cliente, ENTRADA, d, ORIGEM, ENV_LIGADO), { tipo: 'REGISTRADO', duplicado: false })
    const total = linhas.length
    assert.deepEqual(await registrarDecisaoDesafioNoLog(cliente, ENTRADA, d, ORIGEM, ENV_LIGADO), { tipo: 'REGISTRADO', duplicado: true })
    assert.equal(linhas.length, total, 'não grava de novo')
    assert.equal(clientEventIdDoDesafio(d.id), clientEventIdDoDesafio(d.id.toUpperCase()))
    assert.notEqual(clientEventIdDoDesafio(d.id), clientEventIdDoDesafio(randomUUID()))
    assert.match(clientEventIdDoDesafio(d.id), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  await caso('DESAFIO no log: pode ser registrado com a partida encerrada e antes do primeiro set', async () => {
    const { cliente, linhas } = novoBanco()
    const antesDoSet = await registrarDecisaoDesafioNoLog(cliente, ENTRADA, desafio(), ORIGEM, ENV_LIGADO)
    assert.equal(antesDoSet.tipo, 'REGISTRADO')
    assert.equal(linhas.length, 1)
  })

  await caso('DESAFIO no log: flag desligada, estado não final e equipe alheia são ignorados', async () => {
    const { cliente, linhas } = novoBanco()
    assert.deepEqual(await registrarDecisaoDesafioNoLog(cliente, ENTRADA, desafio(), ORIGEM, {}), { tipo: 'IGNORADO', motivo: 'FLAG_DESLIGADA' })
    assert.deepEqual(
      await registrarDecisaoDesafioNoLog(cliente, ENTRADA, desafio({ estado: 'EM_ANALISE' }), ORIGEM, ENV_LIGADO),
      { tipo: 'IGNORADO', motivo: 'ESTADO_NAO_FINAL' },
    )
    assert.deepEqual(
      await registrarDecisaoDesafioNoLog(cliente, ENTRADA, desafio({ equipeId: 999 }), ORIGEM, ENV_LIGADO),
      { tipo: 'IGNORADO', motivo: 'EQUIPE_FORA_DA_PARTIDA' },
    )
    assert.equal(linhas.length, 0)
  })

  await caso('DESAFIO no log: tabela ou RPC ausente não lança (falha vira resultado)', async () => {
    await silenciar(async () => {
      for (const opcoes of [{ tabelaExiste: false }, { rpcExiste: false }, { oficializada: true }]) {
        const { cliente } = novoBanco(opcoes)
        const r = await registrarDecisaoDesafioNoLog(cliente, ENTRADA, desafio(), ORIGEM, ENV_LIGADO)
        assert.equal(r.tipo, 'FALHOU', JSON.stringify(opcoes))
      }
      const explosivo = { from: () => { throw new Error('boom') }, rpc: () => { throw new Error('boom') } }
      assert.equal((await registrarDecisaoDesafioNoLog(explosivo as never, ENTRADA, desafio(), ORIGEM, ENV_LIGADO)).tipo, 'FALHOU')
    })
  })

  // ---------------------------------------------------------------- scout: placar e rotação do log
  await caso('scout: estadoDoSetNoMomento deriva placar e rotação do set a partir do log', async () => {
    const { cliente, linhas } = novoBanco()
    // A saca; B ganha (side-out, B rotaciona) e ganha de novo (já saca, sem nova rotação)
    await processarLote(cliente, ENTRADA, lote([inicioSet(), ponto('B'), ponto('B')]), ORIGEM)
    const log = linesToLog(linhas)
    assert.deepEqual(estadoDoSetNoMomento(log, CONFIG, 1, CONTEXTO), { placarA: 0, placarB: 2, rotacaoA: 1, rotacaoB: 2 })
    assert.equal(estadoDoSetNoMomento(log, CONFIG, 2, CONTEXTO), null, 'set não iniciado')
    assert.equal(estadoDoSetNoMomento([], CONFIG, 1, CONTEXTO), null)
  })

  await caso('scout: registrarAcao preenche placar e rotação ausentes pelo log, sem sobrescrever o informado', async () => {
    const { cliente: eventos, linhas } = novoBanco()
    await processarLote(eventos, ENTRADA, lote([inicioSet(), ponto('B'), ponto('B')]), ORIGEM)
    const derivar = criarDerivadorDoLog(eventos, PARTIDA.id, async () => ({ config: CONFIG, contexto: CONTEXTO }), ENV_LIGADO)
    assert.ok(derivar)
    assert.equal(criarDerivadorDoLog(eventos, PARTIDA.id, async () => ({ config: CONFIG }), {}), undefined, 'flag desligada: sem derivador')

    const gravadas: Record<string, unknown>[] = []
    const bancoScout = {
      from: (tabela: string) => {
        const filtros: Array<[string, unknown]> = []
        const b: any = {
          select: () => b,
          eq: (c: string, v: unknown) => (filtros.push([c, v]), b),
          maybeSingle: () => Promise.resolve({ data: tabela === 'ScoutAcao' ? null : { id: 11, equipeId: 100, banido: false }, error: null }),
          insert: (v: Record<string, unknown>) => {
            gravadas.push(v)
            return { select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: gravadas.length, ...v }, error: null }) }) }
          },
        }
        return b
      },
    }
    const base = { setNumero: 1, equipeId: 100, fundamento: 'ATAQUE', resultado: 'PONTO' }
    const r = await registrarAcao(bancoScout, PARTIDA, { ...base, clientEventId: 'a-1' }, 'u', derivar)
    assert.equal(r.tipo, 'OK')
    assert.deepEqual(
      { placarA: gravadas[0]!.placarA, placarB: gravadas[0]!.placarB, rotacao: gravadas[0]!.rotacao },
      { placarA: 0, placarB: 2, rotacao: 1 },
    )
    // equipe B: rotação própria da equipe B
    await registrarAcao(bancoScout, PARTIDA, { ...base, equipeId: 200, clientEventId: 'a-2' }, 'u', derivar)
    assert.equal(gravadas[1]!.rotacao, 2)
    // informado pelo cliente prevalece
    await registrarAcao(bancoScout, PARTIDA, { ...base, clientEventId: 'a-3', placarA: 9, placarB: 8, rotacao: 4 }, 'u', derivar)
    assert.deepEqual({ placarA: gravadas[2]!.placarA, placarB: gravadas[2]!.placarB, rotacao: gravadas[2]!.rotacao }, { placarA: 9, placarB: 8, rotacao: 4 })
    // set sem log: segue como antes (null)
    await registrarAcao(bancoScout, PARTIDA, { ...base, setNumero: 2, clientEventId: 'a-4' }, 'u', derivar)
    assert.deepEqual({ placarA: gravadas[3]!.placarA, rotacao: gravadas[3]!.rotacao }, { placarA: null, rotacao: null })
    // derivador que falha não derruba o lançamento
    const quebrado = async () => {
      throw new Error('log ilegível')
    }
    assert.equal((await registrarAcao(bancoScout, PARTIDA, { ...base, clientEventId: 'a-5' }, 'u', quebrado)).tipo, 'OK')
    assert.equal(gravadas[4]!.placarA, null)
    // sem derivador: comportamento anterior
    await registrarAcao(bancoScout, PARTIDA, { ...base, clientEventId: 'a-6' }, 'u')
    assert.equal(gravadas[5]!.placarA, null)
    assert.equal(linhas.length, 3, 'o scout não escreve no log')
  })

  if (falhas.length > 0) {
    console.error(`\nr13-backend: ${falhas.length} de ${total} falharam: ${falhas.join('; ')}`)
    process.exit(1)
  }
  console.log(`\nr13-backend: ${total} casos ok`)
}

function linesToLog(linhas: Array<Record<string, any>>) {
  return linhasParaLog(linhas as never).log
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
